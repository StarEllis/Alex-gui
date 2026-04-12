package service

import (
	"testing"

	"alex-desktop/model"
)

func TestGetNormalizedGenres(t *testing.T) {
	svc := &DetailRecommendationService{
		normalizedGenres: make(map[string]normalizedGenres),
	}

	media := &model.Media{
		ID:     "media-1",
		Genres: "剧情,OL,美少女,巨乳,单体,中文字幕,片商: S1,ABC-123,SNIS,AIKA",
	}
	actors := []actorRef{{Name: "AIKA"}}

	got := svc.getNormalizedGenres(media, actors)

	assertContains := func(values []string, expected string) {
		t.Helper()
		for _, value := range values {
			if value == expected {
				return
			}
		}
		t.Fatalf("expected %q in %v", expected, values)
	}

	assertNotContains := func(values []string, expected string) {
		t.Helper()
		for _, value := range values {
			if value == expected {
				t.Fatalf("did not expect %q in %v", expected, values)
			}
		}
	}

	assertContains(got.ThemeTags, "剧情")
	assertContains(got.ThemeTags, "OL")
	assertContains(got.ThemeTags, "美少女")
	assertContains(got.ThemeTags, "巨乳")
	assertContains(got.ThemeTags, "单体")
	assertContains(got.VendorTags, "S1")
	assertContains(got.TechTags, "中文字幕")
	assertContains(got.TechTags, "ABC-123")
	assertNotContains(got.ThemeTags, "AIKA")
	assertNotContains(got.ThemeTags, "SNIS")

	assertContains(got.CoreThemeTags, "OL")
	assertContains(got.CoreThemeTags, "美少女")
	assertContains(got.CoreThemeTags, "巨乳")
	assertNotContains(got.CoreThemeTags, "剧情")
	assertNotContains(got.CoreThemeTags, "单体")
	assertNotContains(got.CoreThemeTags, "SNIS")
}

func TestSelectByRoutePlanRefillsWithinSection(t *testing.T) {
	svc := &DetailRecommendationService{}
	source := &model.Media{
		ID:        "source",
		LibraryID: "lib-1",
		MediaType: "movie",
	}

	newItem := func(id string, matchType string, matchedValues ...string) RelatedMediaItem {
		return RelatedMediaItem{
			Media: model.Media{
				ID:        id,
				LibraryID: "lib-1",
				MediaType: "movie",
			},
			MatchType:     matchType,
			MatchedValues: matchedValues,
		}
	}

	itemsByType := map[string][]RelatedMediaItem{
		"actor": {
			newItem("actor-1", "actor", "Actor A"),
			newItem("actor-2", "actor", "Actor A"),
			newItem("actor-3", "actor", "Actor A"),
			newItem("actor-4", "actor", "Actor A"),
			newItem("actor-5", "actor", "Actor A"),
		},
		"vendor": {
			newItem("vendor-1", "vendor", "Vendor 1"),
			newItem("vendor-2", "vendor", "Vendor 2"),
			newItem("vendor-3", "vendor", "Vendor 3"),
			newItem("vendor-4", "vendor", "Vendor 4"),
			newItem("vendor-5", "vendor", "Vendor 5"),
		},
	}

	state := &selectionState{
		selectedIDs:    make(map[string]bool),
		actorCounts:    make(map[string]int),
		vendorCounts:   make(map[string]int),
		prefixCounts:   make(map[string]int),
		favoriteSet:    make(map[string]bool),
		watchedSet:     make(map[string]bool),
		remainingLimit: detailRecommendationDefaultLimit,
	}

	selected := svc.selectByRoutePlan(source, itemsByType, continueRoutePlan, state)
	if got, want := len(selected), routePlanTotalLimit(continueRoutePlan); got != want {
		t.Fatalf("expected continue section to refill to %d items, got %d", want, got)
	}

	actorCount := 0
	vendorCount := 0
	for _, item := range selected {
		switch item.MatchType {
		case "actor":
			actorCount++
		case "vendor":
			vendorCount++
		}
	}

	if actorCount != 2 {
		t.Fatalf("expected actor route to stop at diversity cap 2, got %d", actorCount)
	}
	if vendorCount != 5 {
		t.Fatalf("expected vendor route to refill past base quota up to 5, got %d", vendorCount)
	}
}

func TestRefillSectionByPriorityUsesStrongFallback(t *testing.T) {
	svc := &DetailRecommendationService{}
	source := &model.Media{
		ID:        "source",
		LibraryID: "lib-1",
		MediaType: "movie",
	}

	newVendorItem := func(id string) RelatedMediaItem {
		return RelatedMediaItem{
			Media: model.Media{
				ID:        id,
				LibraryID: "lib-1",
				MediaType: "movie",
			},
			MatchType:     "vendor",
			MatchedValues: []string{id},
		}
	}

	itemsByType := map[string][]RelatedMediaItem{
		"vendor": {
			newVendorItem("vendor-1"),
			newVendorItem("vendor-2"),
			newVendorItem("vendor-3"),
			newVendorItem("vendor-4"),
			newVendorItem("vendor-5"),
			newVendorItem("vendor-6"),
			newVendorItem("vendor-7"),
			newVendorItem("vendor-8"),
			newVendorItem("vendor-9"),
			newVendorItem("vendor-10"),
			newVendorItem("vendor-11"),
			newVendorItem("vendor-12"),
		},
	}

	state := &selectionState{
		selectedIDs:    make(map[string]bool),
		actorCounts:    make(map[string]int),
		vendorCounts:   make(map[string]int),
		prefixCounts:   make(map[string]int),
		favoriteSet:    make(map[string]bool),
		watchedSet:     make(map[string]bool),
		remainingLimit: detailRecommendationDefaultLimit,
	}

	selected := svc.selectByRoutePlan(source, itemsByType, continueRoutePlan, state)
	if got := len(selected); got != routePlanTotalLimit(continueRoutePlan) {
		t.Fatalf("expected base selection to fill continue quota %d, got %d", routePlanTotalLimit(continueRoutePlan), got)
	}

	selected = svc.refillSectionByPriority(source, itemsByType, []string{"series", "actor", "vendor"}, state, selected, state.remainingLimit)
	if got, want := len(selected), detailRecommendationDefaultLimit; got != want {
		t.Fatalf("expected strong fallback refill to reach %d items, got %d", want, got)
	}
}
