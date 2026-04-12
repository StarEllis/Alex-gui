package service

import (
	"testing"

	"alex-desktop/model"
)

func TestApplyDerivedMediaFields(t *testing.T) {
	media := &model.Media{
		Title:          "Test Title",
		Overview:       "Plot",
		Genres:         "剧情,OL",
		PosterPath:     "C:\\covers\\poster.jpg",
		FilePath:       "C:\\videos\\abc123\\ABC-123.mp4",
		NfoExtraFields: `{"maker":"S1","label":"NO.1 STYLE","num":"ABC-123"}`,
		Year:           2024,
		Runtime:        120,
		Rating:         4.2,
	}

	derived := ApplyDerivedMediaFields(media)

	if derived.Maker != "S1" || media.Maker != "S1" {
		t.Fatalf("expected maker to be derived from NFO, got %q / %q", derived.Maker, media.Maker)
	}
	if derived.Label != "NO.1 STYLE" || media.Label != "NO.1 STYLE" {
		t.Fatalf("expected label to be derived from NFO, got %q / %q", derived.Label, media.Label)
	}
	if media.Code != "ABC-123" {
		t.Fatalf("expected normalized code ABC-123, got %q", media.Code)
	}
	if media.CodePrefix != "ABC" {
		t.Fatalf("expected code prefix ABC, got %q", media.CodePrefix)
	}
	if media.MetadataScore <= 0 {
		t.Fatalf("expected metadata score to be positive, got %d", media.MetadataScore)
	}
}

func TestParseCodePrefix(t *testing.T) {
	tests := map[string]string{
		"ABC-123":  "ABC",
		"ipx001":   "IPX",
		"foo bar":  "",
		"":         "",
		"ABW 777":  "ABW",
		"abc_1234": "ABC",
	}

	for input, want := range tests {
		if got := ParseCodePrefix(input); got != want {
			t.Fatalf("ParseCodePrefix(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestNeedsLocalMetadataRepair(t *testing.T) {
	tests := []struct {
		name  string
		media *model.Media
		want  bool
	}{
		{
			name: "raw nfo without parsed fields",
			media: &model.Media{
				NfoRawXml:      "<movie><title>demo</title></movie>",
				NfoExtraFields: "",
			},
			want: true,
		},
		{
			name: "blank metadata payload",
			media: &model.Media{
				Title: "demo",
			},
			want: true,
		},
		{
			name: "already hydrated",
			media: &model.Media{
				Overview:              "plot",
				Genres:                "tag1,tag2",
				Code:                  "SONE-871",
				ReleaseDateNormalized: "2025-09-04",
				Year:                  2025,
				NfoExtraFields:        `{"num":"SONE-871"}`,
			},
			want: false,
		},
	}

	for _, tt := range tests {
		if got := NeedsLocalMetadataRepair(tt.media); got != tt.want {
			t.Fatalf("%s: NeedsLocalMetadataRepair() = %v, want %v", tt.name, got, tt.want)
		}
	}
}
