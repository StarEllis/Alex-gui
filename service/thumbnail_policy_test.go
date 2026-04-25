package service

import (
	"os"
	"path/filepath"
	"testing"

	"navi-desktop/model"
)

func TestHasAllThumbnailAssetsRequiresPrimaryArtworkOnly(t *testing.T) {
	dir := t.TempDir()
	mediaPath := filepath.Join(dir, "FC2-676186.mp4")
	if err := os.WriteFile(mediaPath, []byte("video"), 0644); err != nil {
		t.Fatalf("write media file: %v", err)
	}
	if err := os.WriteFile(generatedPosterPath(mediaPath), []byte("poster"), 0644); err != nil {
		t.Fatalf("write poster: %v", err)
	}
	if err := os.WriteFile(generatedBackdropPath(mediaPath), []byte("fanart"), 0644); err != nil {
		t.Fatalf("write fanart: %v", err)
	}

	sidecars := collectDirectorySidecarFiles(dir)
	media := &model.Media{FilePath: mediaPath}
	if !HasAllThumbnailAssets(media, sidecars, DefaultThumbnailSettings()) {
		t.Fatalf("expected poster+fanart to satisfy generated threshold without previews")
	}
}

func TestResolveThumbnailStateFromDiskTreatsPrimaryArtworkAsGenerated(t *testing.T) {
	dir := t.TempDir()
	mediaPath := filepath.Join(dir, "FC2-676186.mp4")
	if err := os.WriteFile(mediaPath, []byte("video"), 0644); err != nil {
		t.Fatalf("write media file: %v", err)
	}
	if err := os.WriteFile(generatedPosterPath(mediaPath), []byte("poster"), 0644); err != nil {
		t.Fatalf("write poster: %v", err)
	}
	if err := os.WriteFile(generatedBackdropPath(mediaPath), []byte("fanart"), 0644); err != nil {
		t.Fatalf("write fanart: %v", err)
	}

	media := &model.Media{
		FilePath:        mediaPath,
		MediaType:       "movie",
		Duration:        3600,
		ThumbnailStatus: ThumbnailStatusNone,
	}
	status, fingerprint, err := ResolveThumbnailStateFromDisk(media, nil, DefaultThumbnailSettings())
	if err != nil {
		t.Fatalf("resolve thumbnail state from disk: %v", err)
	}
	if status != ThumbnailStatusGenerated {
		t.Fatalf("expected generated status with primary artwork present, got %q", status)
	}
	if fingerprint == "" {
		t.Fatalf("expected non-empty fingerprint after disk inspection")
	}
}

func TestResolveThumbnailStateMarksGeneratedMediaStaleWhenAllPreviewsAreGone(t *testing.T) {
	dir := t.TempDir()
	mediaPath := filepath.Join(dir, "FC2-676186.mp4")
	if err := os.WriteFile(mediaPath, []byte("video"), 0644); err != nil {
		t.Fatalf("write media file: %v", err)
	}
	if err := os.WriteFile(generatedPosterPath(mediaPath), []byte("poster"), 0644); err != nil {
		t.Fatalf("write poster: %v", err)
	}
	if err := os.WriteFile(generatedBackdropPath(mediaPath), []byte("fanart"), 0644); err != nil {
		t.Fatalf("write fanart: %v", err)
	}

	media := &model.Media{
		FilePath:             mediaPath,
		MediaType:            "movie",
		Duration:             3600,
		ThumbnailStatus:      ThumbnailStatusGenerated,
		ThumbnailFingerprint: "1|1",
	}
	status, _, err := ResolveThumbnailStateFromDisk(media, nil, DefaultThumbnailSettings())
	if err != nil {
		t.Fatalf("resolve thumbnail state from disk: %v", err)
	}
	if status != ThumbnailStatusStale {
		t.Fatalf("expected stale status when generated media loses all previews, got %q", status)
	}
}
