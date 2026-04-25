package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"navi-desktop/model"
	"navi-desktop/repository"

	"github.com/glebarez/sqlite"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func newTestApp(t *testing.T) *App {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := model.AutoMigrate(db); err != nil {
		t.Fatalf("migrate sqlite failed: %v", err)
	}

	return &App{
		ctx:    context.Background(),
		db:     db,
		repos:  repository.NewRepositories(db),
		logger: zap.NewNop().Sugar(),
		remote: newRemoteAccessState(),
	}
}

func TestJellyfinAuthenticateAndListItems(t *testing.T) {
	app := newTestApp(t)
	mediaDir := t.TempDir()
	mediaPath := filepath.Join(mediaDir, "movie.mkv")
	if err := os.WriteFile(mediaPath, []byte("fake-video"), 0o644); err != nil {
		t.Fatalf("write media file failed: %v", err)
	}

	library := &model.Library{
		Name: "Movies",
		Path: mediaDir,
		Type: "movie",
	}
	if err := app.repos.Library.Create(library); err != nil {
		t.Fatalf("create library failed: %v", err)
	}

	media := &model.Media{
		LibraryID: library.ID,
		Title:     "Example Movie",
		FilePath:  mediaPath,
		MediaType: "movie",
		FileSize:  10,
		Duration:  120,
	}
	if err := app.repos.Media.Create(media); err != nil {
		t.Fatalf("create media failed: %v", err)
	}

	settings := &DesktopSettings{
		RemoteBindHost:     defaultRemoteBindHost,
		RemoteUsername:     "infuse",
		RemotePassword:     "secret",
		JellyfinServerName: "Test Sidecar",
	}
	handler := app.newJellyfinMux(settings)

	loginBody, _ := json.Marshal(map[string]string{
		"Username": "infuse",
		"Pw":       "secret",
	})
	loginReq := httptest.NewRequest(http.MethodPost, "/Users/AuthenticateByName", bytes.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginReq.Header.Set("X-Emby-Authorization", `MediaBrowser Client="Infuse", Device="iPhone", DeviceId="device-1", Version="8.0"`)
	loginResp := httptest.NewRecorder()
	handler.ServeHTTP(loginResp, loginReq)
	if loginResp.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginResp.Code, loginResp.Body.String())
	}

	var authResult struct {
		AccessToken string `json:"AccessToken"`
	}
	if err := json.Unmarshal(loginResp.Body.Bytes(), &authResult); err != nil {
		t.Fatalf("decode auth result failed: %v", err)
	}
	if authResult.AccessToken == "" {
		t.Fatalf("expected access token in auth result")
	}

	itemsReq := httptest.NewRequest(http.MethodGet, "/Items?recursive=true&includeItemTypes=Movie", nil)
	itemsReq.Header.Set("X-MediaBrowser-Token", authResult.AccessToken)
	itemsResp := httptest.NewRecorder()
	handler.ServeHTTP(itemsResp, itemsReq)
	if itemsResp.Code != http.StatusOK {
		t.Fatalf("items status = %d, body = %s", itemsResp.Code, itemsResp.Body.String())
	}

	var queryResult struct {
		Items []map[string]interface{} `json:"Items"`
	}
	if err := json.Unmarshal(itemsResp.Body.Bytes(), &queryResult); err != nil {
		t.Fatalf("decode items result failed: %v", err)
	}
	if len(queryResult.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(queryResult.Items))
	}
	if queryResult.Items[0]["Name"] != "Example Movie" {
		t.Fatalf("expected movie name Example Movie, got %#v", queryResult.Items[0]["Name"])
	}

	groupingReq := httptest.NewRequest(http.MethodGet, "/UserViews/GroupingOptions?userId="+jellyfinUserID, nil)
	groupingReq.Header.Set("X-MediaBrowser-Token", authResult.AccessToken)
	groupingResp := httptest.NewRecorder()
	handler.ServeHTTP(groupingResp, groupingReq)
	if groupingResp.Code != http.StatusOK {
		t.Fatalf("grouping options status = %d, body = %s", groupingResp.Code, groupingResp.Body.String())
	}

	var groupingResult []map[string]interface{}
	if err := json.Unmarshal(groupingResp.Body.Bytes(), &groupingResult); err != nil {
		t.Fatalf("decode grouping options failed: %v", err)
	}
	if len(groupingResult) != 0 {
		t.Fatalf("expected empty grouping options, got %d", len(groupingResult))
	}
}
