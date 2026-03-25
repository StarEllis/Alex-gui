package service

import (
	"os"
	"path/filepath"

	"github.com/nowen-video/nowen-video/internal/model"
	"github.com/nowen-video/nowen-video/internal/repository"
	"go.uber.org/zap"
)

// SeriesService 剧集合集服务
type SeriesService struct {
	seriesRepo *repository.SeriesRepo
	mediaRepo  *repository.MediaRepo
	logger     *zap.SugaredLogger
}

func NewSeriesService(seriesRepo *repository.SeriesRepo, mediaRepo *repository.MediaRepo, logger *zap.SugaredLogger) *SeriesService {
	return &SeriesService{
		seriesRepo: seriesRepo,
		mediaRepo:  mediaRepo,
		logger:     logger,
	}
}

// ListSeries 获取剧集合集列表（分页）
func (s *SeriesService) ListSeries(page, size int, libraryID string) ([]model.Series, int64, error) {
	return s.seriesRepo.List(page, size, libraryID)
}

// GetSeriesDetail 获取剧集合集详情（含所有剧集）
func (s *SeriesService) GetSeriesDetail(id string) (*model.Series, error) {
	series, err := s.seriesRepo.FindByID(id)
	if err != nil {
		return nil, ErrMediaNotFound
	}
	return series, nil
}

// GetSeasons 获取剧集合集的季列表
func (s *SeriesService) GetSeasons(seriesID string) ([]SeasonInfo, error) {
	seasons, err := s.seriesRepo.GetSeasonNumbers(seriesID)
	if err != nil {
		return nil, err
	}

	var result []SeasonInfo
	for _, num := range seasons {
		episodes, err := s.mediaRepo.ListBySeriesAndSeason(seriesID, num)
		if err != nil {
			continue
		}
		result = append(result, SeasonInfo{
			SeasonNum:    num,
			EpisodeCount: len(episodes),
			Episodes:     episodes,
		})
	}

	return result, nil
}

// GetSeasonEpisodes 获取指定季的所有剧集
func (s *SeriesService) GetSeasonEpisodes(seriesID string, seasonNum int) ([]model.Media, error) {
	return s.mediaRepo.ListBySeriesAndSeason(seriesID, seasonNum)
}

// GetAllEpisodes 获取合集的所有剧集（按播放顺序排序）
func (s *SeriesService) GetAllEpisodes(seriesID string) ([]model.Media, error) {
	return s.mediaRepo.ListBySeriesID(seriesID)
}

// GetNextEpisode 获取下一集（用于连续播放）
func (s *SeriesService) GetNextEpisode(seriesID string, currentSeason, currentEpisode int) (*model.Media, error) {
	episodes, err := s.mediaRepo.ListBySeriesID(seriesID)
	if err != nil {
		return nil, err
	}

	// 找到当前集的位置，返回下一集
	found := false
	for _, ep := range episodes {
		if found {
			return &ep, nil
		}
		if ep.SeasonNum == currentSeason && ep.EpisodeNum == currentEpisode {
			found = true
		}
	}

	return nil, nil // 已经是最后一集
}

// GetSeriesPosterPath 获取剧集合集海报文件路径
func (s *SeriesService) GetSeriesPosterPath(id string) (string, error) {
	series, err := s.seriesRepo.FindByIDOnly(id)
	if err != nil {
		return "", ErrMediaNotFound
	}

	// 优先使用数据库中存储的海报路径
	if series.PosterPath != "" {
		if _, err := os.Stat(series.PosterPath); err == nil {
			return series.PosterPath, nil
		}
	}

	// 查找剧集根目录下的海报文件
	if series.FolderPath != "" {
		posterExts := []string{".jpg", ".jpeg", ".png", ".webp"}
		posterNames := []string{"poster", "cover", "folder", "show"}
		for _, name := range posterNames {
			for _, ext := range posterExts {
				candidate := filepath.Join(series.FolderPath, name+ext)
				if _, err := os.Stat(candidate); err == nil {
					return candidate, nil
				}
			}
		}
	}

	return "", nil
}

// SeasonInfo 季信息
type SeasonInfo struct {
	SeasonNum    int           `json:"season_num"`
	EpisodeCount int           `json:"episode_count"`
	Episodes     []model.Media `json:"episodes"`
}
