package service

import (
	"encoding/json"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"alex-desktop/model"
)

var mediaCodePattern = regexp.MustCompile(`(?i)\b([A-Z0-9]{2,10})[-_ ](\d{2,6})\b`)
var compactMediaCodePattern = regexp.MustCompile(`(?i)\b([A-Z]{2,10})(\d{2,6})\b`)

const (
	MetadataPhaseQuick  = "quick"
	MetadataPhaseFull   = "full"
	MetadataPhaseFailed = "failed"
)

type DerivedMediaMetadata struct {
	Maker         string
	Label         string
	Code          string
	CodePrefix    string
	MetadataScore int
}

func parseNFOExtraFields(raw string) NFOExtraFields {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return NFOExtraFields{}
	}

	var extra NFOExtraFields
	if err := json.Unmarshal([]byte(raw), &extra); err != nil {
		return NFOExtraFields{}
	}
	return extra
}

func firstNonEmptyTrimmed(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}

func normalizeMediaCode(raw string) string {
	raw = strings.ToUpper(strings.TrimSpace(raw))
	if raw == "" {
		return ""
	}

	match := mediaCodePattern.FindStringSubmatch(raw)
	if len(match) < 3 {
		match = compactMediaCodePattern.FindStringSubmatch(raw)
	}
	if len(match) < 3 {
		return ""
	}

	prefix := strings.ToUpper(strings.TrimSpace(match[1]))
	number := strings.TrimSpace(match[2])
	if prefix == "" || number == "" {
		return ""
	}

	return prefix + "-" + number
}

func findMediaCode(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}

		if normalized := normalizeMediaCode(value); normalized != "" {
			return normalized
		}

		if match := mediaCodePattern.FindStringSubmatch(strings.ToUpper(value)); len(match) >= 3 {
			return strings.ToUpper(strings.TrimSpace(match[1])) + "-" + strings.TrimSpace(match[2])
		}
		if match := compactMediaCodePattern.FindStringSubmatch(strings.ToUpper(value)); len(match) >= 3 {
			return strings.ToUpper(strings.TrimSpace(match[1])) + "-" + strings.TrimSpace(match[2])
		}
	}
	return ""
}

func ParseCodePrefix(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	match := mediaCodePattern.FindStringSubmatch(strings.ToUpper(raw))
	if len(match) < 2 {
		match = compactMediaCodePattern.FindStringSubmatch(strings.ToUpper(raw))
	}
	if len(match) < 2 {
		return ""
	}
	return strings.ToUpper(strings.TrimSpace(match[1]))
}

func ComputeMetadataScore(media *model.Media) int {
	if media == nil {
		return 0
	}

	score := 0
	if strings.TrimSpace(media.Title) != "" {
		score += 20
	}
	if strings.TrimSpace(media.Overview) != "" {
		score += 15
	}
	if strings.TrimSpace(media.Genres) != "" {
		score += 15
	}
	if strings.TrimSpace(media.ReleaseDateNormalized) != "" || media.Year > 0 {
		score += 10
	}
	if strings.TrimSpace(media.PosterPath) != "" {
		score += 15
	}
	if strings.TrimSpace(media.BackdropPath) != "" {
		score += 5
	}
	if firstNonEmptyTrimmed(media.Studio, media.Maker, media.Label) != "" {
		score += 10
	}
	if strings.TrimSpace(media.Code) != "" {
		score += 5
	}
	if media.Duration > 0 || media.Runtime > 0 {
		score += 5
	}
	if media.Rating > 0 {
		score += 5
	}
	return score
}

func ExtractDerivedMediaMetadata(media *model.Media) DerivedMediaMetadata {
	if media == nil {
		return DerivedMediaMetadata{}
	}

	extra := parseNFOExtraFields(media.NfoExtraFields)
	filename := filepath.Base(strings.TrimSpace(media.FilePath))
	stem := strings.TrimSuffix(filename, filepath.Ext(filename))
	sortTitle := strings.TrimSpace(extra.SortTitle)
	code := firstNonEmptyTrimmed(
		normalizeMediaCode(media.Code),
		normalizeMediaCode(extra.Num),
		findMediaCode(stem, media.Title, media.OrigTitle, sortTitle),
	)

	metadata := DerivedMediaMetadata{
		Maker:      firstNonEmptyTrimmed(media.Maker, extra.Maker),
		Label:      firstNonEmptyTrimmed(media.Label, extra.Label, extra.Publisher),
		Code:       code,
		CodePrefix: ParseCodePrefix(code),
	}

	if strings.TrimSpace(media.Studio) == "" {
		media.Studio = firstNonEmptyTrimmed(extra.Publisher, extra.Maker, extra.Label)
	}
	metadata.MetadataScore = ComputeMetadataScore(media)
	return metadata
}

func ApplyDerivedMediaFields(media *model.Media) DerivedMediaMetadata {
	if media == nil {
		return DerivedMediaMetadata{}
	}

	metadata := ExtractDerivedMediaMetadata(media)
	if media.Maker == "" {
		media.Maker = metadata.Maker
	}
	if media.Label == "" {
		media.Label = metadata.Label
	}
	if media.Code == "" {
		media.Code = metadata.Code
	}
	if media.CodePrefix == "" {
		media.CodePrefix = metadata.CodePrefix
	}
	media.MetadataScore = metadata.MetadataScore
	return metadata
}

func NormalizeMetadataPhase(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case MetadataPhaseQuick:
		return MetadataPhaseQuick
	case MetadataPhaseFailed:
		return MetadataPhaseFailed
	default:
		return MetadataPhaseFull
	}
}

func NeedsMetadataCompletion(media *model.Media) bool {
	if media == nil {
		return false
	}

	switch NormalizeMetadataPhase(media.MetadataPhase) {
	case MetadataPhaseQuick, MetadataPhaseFailed:
		return true
	default:
		return false
	}
}

func NeedsLocalMetadataRepair(media *model.Media) bool {
	if media == nil {
		return false
	}

	if strings.TrimSpace(media.NfoRawXml) != "" && strings.TrimSpace(media.NfoExtraFields) == "" {
		return true
	}

	return strings.TrimSpace(media.ReleaseDateNormalized) == "" &&
		strings.TrimSpace(media.Overview) == "" &&
		strings.TrimSpace(media.Genres) == "" &&
		strings.TrimSpace(media.Code) == "" &&
		media.Year == 0
}

func scoreFromMetadata(value int, max int) float64 {
	if value <= 0 || max <= 0 {
		return 0
	}
	if value >= max {
		return 1
	}
	return float64(value) / float64(max)
}

func parseIntSetting(raw string, fallback int) int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}
