package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"alex-desktop/model"
	"go.uber.org/zap"
)

const malformedURLNFO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <plot><![CDATA[A & B]]></plot>
  <releasedate>2025-09-04</releasedate>
  <premiered>2025-09-04</premiered>
  <release>2025-09-04</release>
  <num>SONE-871</num>
  <title>SONE-871 title</title>
  <originaltitle>SONE-871 original</originaltitle>
  <actor>
    <name>Actor One</name>
  </actor>
  <rating>4.3</rating>
  <year>2025</year>
  <runtime>139</runtime>
  <studio>S1 NO.1 STYLE</studio>
  <maker>S1 NO.1 STYLE</maker>
  <label>S1 NO.1 STYLE</label>
  <genre>4K</genre>
  <tag>无码破解</tag>
  <dmmid>https://video.dmm.co.jp/av/content/?id=sone00871&i3_ref=search&i3_ord=1</dmmid>
</movie>
`

func writeTempNFO(t *testing.T, content string) string {
	t.Helper()

	dir := t.TempDir()
	path := filepath.Join(dir, "sample.nfo")
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("write temp nfo: %v", err)
	}
	return path
}

func TestParseMovieNFOToleratesBareAmpersandInURL(t *testing.T) {
	service := NewNFOService(zap.NewNop().Sugar())
	media := &model.Media{FilePath: `C:\videos\SONE-871.mp4`}

	nfoPath := writeTempNFO(t, malformedURLNFO)
	if err := service.ParseMovieNFO(nfoPath, media); err != nil {
		t.Fatalf("ParseMovieNFO returned error: %v", err)
	}

	if media.Title != "SONE-871 title" {
		t.Fatalf("expected title from NFO, got %q", media.Title)
	}
	if media.ReleaseDateNormalized != "2025-09-04" {
		t.Fatalf("expected normalized release date, got %q", media.ReleaseDateNormalized)
	}
	if media.Runtime != 139 {
		t.Fatalf("expected runtime 139, got %d", media.Runtime)
	}
	if media.Overview != "A & B" {
		t.Fatalf("expected CDATA plot to stay intact, got %q", media.Overview)
	}
	if media.Code != "SONE-871" {
		t.Fatalf("expected derived code SONE-871, got %q", media.Code)
	}
	if media.Maker != "S1 NO.1 STYLE" {
		t.Fatalf("expected maker from NFO, got %q", media.Maker)
	}
	if !strings.Contains(media.Genres, "4K") || !strings.Contains(media.Genres, "无码破解") {
		t.Fatalf("expected merged genres/tags, got %q", media.Genres)
	}
	if media.NfoRawXml == "" {
		t.Fatal("expected raw NFO XML to be retained")
	}
}

func TestGetActorsFromNFOToleratesBareAmpersandInURL(t *testing.T) {
	service := NewNFOService(zap.NewNop().Sugar())
	nfoPath := writeTempNFO(t, malformedURLNFO)

	actors, directors, err := service.GetActorsFromNFO(nfoPath)
	if err != nil {
		t.Fatalf("GetActorsFromNFO returned error: %v", err)
	}
	if len(actors) != 1 || actors[0].Name != "Actor One" {
		t.Fatalf("expected actor from malformed NFO, got %+v", actors)
	}
	if len(directors) != 0 {
		t.Fatalf("expected no directors, got %+v", directors)
	}
}
