package main

import (
	"fmt"
	"strconv"
	"strings"
	"sync"

	"alex-desktop/service"
)

var recommendationServices sync.Map

func (a *App) recommendationService() *service.DetailRecommendationService {
	if a == nil || a.repos == nil || a.logger == nil {
		return nil
	}

	if existing, ok := recommendationServices.Load(a); ok {
		if svc, ok := existing.(*service.DetailRecommendationService); ok {
			return svc
		}
	}

	svc := service.NewDetailRecommendationService(a.repos, a.logger)
	actual, _ := recommendationServices.LoadOrStore(a, svc)
	typed, _ := actual.(*service.DetailRecommendationService)
	return typed
}

func (a *App) recommendationVersion() int {
	if a == nil || a.repos == nil || a.repos.SystemSetting == nil {
		return 1
	}

	raw, err := a.repos.SystemSetting.Get(service.RecommendationVersionSettingKey)
	if err != nil {
		return 1
	}

	value, parseErr := strconv.Atoi(strings.TrimSpace(raw))
	if parseErr != nil || value <= 0 {
		return 1
	}
	return value
}

func (a *App) bumpRecommendationVersion() {
	if a == nil || a.repos == nil || a.repos.SystemSetting == nil {
		return
	}

	nextValue := strconv.Itoa(a.recommendationVersion() + 1)
	if err := a.repos.SystemSetting.Set(service.RecommendationVersionSettingKey, nextValue); err != nil && a.logger != nil {
		a.logger.Warnf("bump recommendation version failed: %v", err)
	}
}

func (a *App) clearRecommendationGenres() {
	if svc := a.recommendationService(); svc != nil {
		svc.ClearNormalizedGenres()
	}
}

func (a *App) invalidateRecommendationGenres(mediaID string) {
	if svc := a.recommendationService(); svc != nil {
		svc.InvalidateNormalizedGenres(mediaID)
	}
}

func (a *App) GetDetailRecommendations(mediaID string, limit int) (*service.DetailRecommendationResponse, error) {
	mediaID = strings.TrimSpace(mediaID)
	if mediaID == "" {
		return nil, fmt.Errorf("empty media id")
	}

	svc := a.recommendationService()
	if svc == nil {
		return &service.DetailRecommendationResponse{}, nil
	}

	return svc.GetDetailRecommendations(mediaID, limit)
}
