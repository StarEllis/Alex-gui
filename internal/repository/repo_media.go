package repository

import (
	"fmt"

	"github.com/nowen-video/nowen-video/internal/model"
	"gorm.io/gorm"
)

// ==================== MediaRepo ====================

type MediaRepo struct {
	db *gorm.DB
}

func (r *MediaRepo) Create(media *model.Media) error {
	return r.db.Create(media).Error
}

func (r *MediaRepo) FindByID(id string) (*model.Media, error) {
	var media model.Media
	err := r.db.First(&media, "id = ?", id).Error
	return &media, err
}

func (r *MediaRepo) FindByFilePath(filePath string) (*model.Media, error) {
	var media model.Media
	err := r.db.Where("file_path = ?", filePath).First(&media).Error
	return &media, err
}

func (r *MediaRepo) List(page, size int, libraryID string) ([]model.Media, int64, error) {
	var media []model.Media
	var total int64

	query := r.db.Model(&model.Media{})
	if libraryID != "" {
		query = query.Where("library_id = ?", libraryID)
	}

	query.Count(&total)
	err := query.Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&media).Error
	return media, total, err
}

func (r *MediaRepo) Recent(limit int) ([]model.Media, error) {
	var media []model.Media
	err := r.db.Order("created_at DESC").Limit(limit).Find(&media).Error
	return media, err
}

func (r *MediaRepo) Search(keyword string, page, size int) ([]model.Media, int64, error) {
	var media []model.Media
	var total int64

	query := r.db.Model(&model.Media{}).Where("title LIKE ?", "%"+keyword+"%")
	query.Count(&total)
	err := query.Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&media).Error
	return media, total, err
}

// SearchAdvancedParams 高级搜索参数
type SearchAdvancedParams struct {
	Keyword   string
	MediaType string
	Genre     string
	YearMin   int
	YearMax   int
	MinRating float64
	SortBy    string
	SortOrder string
	Page      int
	Size      int
}

// SearchAdvanced 高级搜索 — 支持多条件组合筛选、排序
func (r *MediaRepo) SearchAdvanced(params SearchAdvancedParams) ([]model.Media, int64, error) {
	var media []model.Media
	var total int64

	query := r.db.Model(&model.Media{})

	if params.Keyword != "" {
		query = query.Where("title LIKE ?", "%"+params.Keyword+"%")
	}
	if params.MediaType != "" {
		query = query.Where("media_type = ?", params.MediaType)
	}
	if params.Genre != "" {
		query = query.Where("genres LIKE ?", "%"+params.Genre+"%")
	}
	if params.YearMin > 0 {
		query = query.Where("year >= ?", params.YearMin)
	}
	if params.YearMax > 0 {
		query = query.Where("year <= ?", params.YearMax)
	}
	if params.MinRating > 0 {
		query = query.Where("rating >= ?", params.MinRating)
	}

	query.Count(&total)

	sortField := "created_at"
	sortDir := "DESC"
	switch params.SortBy {
	case "title":
		sortField = "title"
	case "year":
		sortField = "year"
	case "rating":
		sortField = "rating"
	case "created_at":
		sortField = "created_at"
	}
	if params.SortOrder == "asc" {
		sortDir = "ASC"
	}

	page := params.Page
	size := params.Size
	if page <= 0 {
		page = 1
	}
	if size <= 0 || size > 100 {
		size = 20
	}

	err := query.Order(fmt.Sprintf("%s %s", sortField, sortDir)).
		Offset((page - 1) * size).Limit(size).Find(&media).Error

	return media, total, err
}

func (r *MediaRepo) DeleteByID(id string) error {
	return r.db.Unscoped().Delete(&model.Media{}, "id = ?", id).Error
}

func (r *MediaRepo) DeleteByLibraryID(libraryID string) error {
	return r.db.Unscoped().Where("library_id = ?", libraryID).Delete(&model.Media{}).Error
}

func (r *MediaRepo) CleanOrphanedByLibraryIDs(validLibraryIDs []string) (int64, error) {
	var result *gorm.DB
	if len(validLibraryIDs) == 0 {
		result = r.db.Unscoped().Where("1 = 1").Delete(&model.Media{})
	} else {
		result = r.db.Unscoped().Where("library_id NOT IN ?", validLibraryIDs).Delete(&model.Media{})
	}
	return result.RowsAffected, result.Error
}

func (r *MediaRepo) Update(media *model.Media) error {
	return r.db.Save(media).Error
}

func (r *MediaRepo) FindByIDs(ids []string) ([]model.Media, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	var media []model.Media
	err := r.db.Where("id IN ?", ids).Find(&media).Error
	return media, err
}

func (r *MediaRepo) ListByGenres(genres []string, excludeIDs []string, limit int) ([]model.Media, error) {
	if len(genres) == 0 {
		return nil, nil
	}
	query := r.db.Model(&model.Media{})
	for i, genre := range genres {
		if i == 0 {
			query = query.Where("genres LIKE ?", "%"+genre+"%")
		} else {
			query = query.Or("genres LIKE ?", "%"+genre+"%")
		}
	}
	if len(excludeIDs) > 0 {
		query = query.Where("id NOT IN ?", excludeIDs)
	}
	var media []model.Media
	err := query.Order("rating DESC").Limit(limit).Find(&media).Error
	return media, err
}

func (r *MediaRepo) ListByLibraryID(libraryID string) ([]model.Media, error) {
	var media []model.Media
	err := r.db.Where("library_id = ?", libraryID).Find(&media).Error
	return media, err
}

func (r *MediaRepo) ListBySeriesID(seriesID string) ([]model.Media, error) {
	var media []model.Media
	err := r.db.Where("series_id = ?", seriesID).
		Order("season_num ASC, episode_num ASC").Find(&media).Error
	return media, err
}

func (r *MediaRepo) ListBySeriesAndSeason(seriesID string, seasonNum int) ([]model.Media, error) {
	var media []model.Media
	err := r.db.Where("series_id = ? AND season_num = ?", seriesID, seasonNum).
		Order("episode_num ASC").Find(&media).Error
	return media, err
}

func (r *MediaRepo) RecentNonEpisode(limit int) ([]model.Media, error) {
	var media []model.Media
	err := r.db.Where("(series_id = '' OR series_id IS NULL) AND library_id != ''").
		Order("created_at DESC").Limit(limit).Find(&media).Error
	return media, err
}

func (r *MediaRepo) RecentNonEpisodeAll(libraryID string) ([]model.Media, error) {
	var media []model.Media
	query := r.db.Where("(series_id = '' OR series_id IS NULL) AND library_id != ''")
	if libraryID != "" {
		query = query.Where("library_id = ?", libraryID)
	}
	err := query.Order("created_at DESC").Find(&media).Error
	return media, err
}

func (r *MediaRepo) ListNonEpisode(page, size int, libraryID string) ([]model.Media, int64, error) {
	var media []model.Media
	var total int64

	query := r.db.Model(&model.Media{}).Where("(series_id = '' OR series_id IS NULL) AND library_id != ''")
	if libraryID != "" {
		query = query.Where("library_id = ?", libraryID)
	}

	query.Count(&total)
	err := query.Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&media).Error
	return media, total, err
}

func (r *MediaRepo) CleanGhostMedia() (int64, error) {
	result := r.db.Unscoped().Where("library_id = '' OR library_id IS NULL").Delete(&model.Media{})
	return result.RowsAffected, result.Error
}

func (r *MediaRepo) CountNonEpisodeByLibrary(libraryID string) (int64, error) {
	var count int64
	query := r.db.Model(&model.Media{}).Where("(series_id = '' OR series_id IS NULL) AND library_id != ''")
	if libraryID != "" {
		query = query.Where("library_id = ?", libraryID)
	}
	err := query.Count(&count).Error
	return count, err
}

func (r *MediaRepo) CountNonEpisode(libraryID string) (int64, error) {
	var count int64
	query := r.db.Model(&model.Media{}).Where("(series_id = '' OR series_id IS NULL) AND library_id != ''")
	if libraryID != "" {
		query = query.Where("library_id = ?", libraryID)
	}
	err := query.Count(&count).Error
	return count, err
}

// ==================== MediaRepo 扩展方法（文件管理） ====================

func (r *MediaRepo) ListFilesAdvanced(page, size int, libraryID, mediaType, keyword, sortBy, sortOrder string, scrapedOnly *bool) ([]model.Media, int64, error) {
	var media []model.Media
	var total int64

	query := r.db.Model(&model.Media{})

	if libraryID != "" {
		query = query.Where("library_id = ?", libraryID)
	}
	if mediaType != "" {
		query = query.Where("media_type = ?", mediaType)
	}
	if keyword != "" {
		query = query.Where("title LIKE ? OR orig_title LIKE ? OR file_path LIKE ?",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}
	if scrapedOnly != nil {
		if *scrapedOnly {
			query = query.Where("(tmdb_id > 0 OR bangumi_id > 0 OR douban_id != '')")
		} else {
			query = query.Where("tmdb_id = 0 AND bangumi_id = 0 AND (douban_id = '' OR douban_id IS NULL)")
		}
	}

	query.Count(&total)

	sortField := "created_at"
	sortDir := "DESC"
	switch sortBy {
	case "title":
		sortField = "title"
	case "year":
		sortField = "year"
	case "rating":
		sortField = "rating"
	case "file_size":
		sortField = "file_size"
	case "created_at":
		sortField = "created_at"
	case "updated_at":
		sortField = "updated_at"
	}
	if sortOrder == "asc" {
		sortDir = "ASC"
	}

	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}

	err := query.Order(fmt.Sprintf("%s %s", sortField, sortDir)).
		Offset((page - 1) * size).Limit(size).Find(&media).Error
	return media, total, err
}

func (r *MediaRepo) CountByMediaType(mediaType string) (int64, error) {
	var count int64
	err := r.db.Model(&model.Media{}).Where("media_type = ?", mediaType).Count(&count).Error
	return count, err
}

func (r *MediaRepo) CountScraped() (int64, error) {
	var count int64
	err := r.db.Model(&model.Media{}).
		Where("tmdb_id > 0 OR bangumi_id > 0 OR (douban_id != '' AND douban_id IS NOT NULL)").
		Count(&count).Error
	return count, err
}

func (r *MediaRepo) SumFileSize() (int64, error) {
	var total int64
	err := r.db.Model(&model.Media{}).Select("COALESCE(SUM(file_size), 0)").Scan(&total).Error
	return total, err
}

func (r *MediaRepo) CountRecentImports(days int) (int64, error) {
	var count int64
	err := r.db.Model(&model.Media{}).
		Where("created_at >= datetime('now', ?)", fmt.Sprintf("-%d days", days)).
		Count(&count).Error
	return count, err
}

func (r *MediaRepo) ListByMediaType(mediaType string) ([]model.Media, error) {
	var media []model.Media
	err := r.db.Where("media_type = ?", mediaType).Find(&media).Error
	return media, err
}

func (r *MediaRepo) BatchUpdateMediaType(ids []string, mediaType string) (int64, error) {
	result := r.db.Model(&model.Media{}).Where("id IN ?", ids).Update("media_type", mediaType)
	return result.RowsAffected, result.Error
}
