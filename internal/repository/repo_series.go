package repository

import (
	"github.com/nowen-video/nowen-video/internal/model"
	"gorm.io/gorm"
)

// ==================== SeriesRepo ====================

type SeriesRepo struct {
	db *gorm.DB
}

func (r *SeriesRepo) Create(series *model.Series) error {
	return r.db.Create(series).Error
}

func (r *SeriesRepo) FindByID(id string) (*model.Series, error) {
	var series model.Series
	err := r.db.Preload("Episodes", func(db *gorm.DB) *gorm.DB {
		return db.Order("season_num ASC, episode_num ASC")
	}).First(&series, "id = ?", id).Error
	return &series, err
}

func (r *SeriesRepo) FindByIDOnly(id string) (*model.Series, error) {
	var series model.Series
	err := r.db.First(&series, "id = ?", id).Error
	return &series, err
}

func (r *SeriesRepo) FindByFolderPath(folderPath string) (*model.Series, error) {
	var series model.Series
	err := r.db.Where("folder_path = ?", folderPath).First(&series).Error
	return &series, err
}

func (r *SeriesRepo) FindByTitleAndLibrary(title, libraryID string) (*model.Series, error) {
	var series model.Series
	err := r.db.Where("title = ? AND library_id = ?", title, libraryID).First(&series).Error
	return &series, err
}

func (r *SeriesRepo) ListByLibraryID(libraryID string) ([]model.Series, error) {
	var series []model.Series
	err := r.db.Where("library_id = ?", libraryID).Order("title ASC").Find(&series).Error
	return series, err
}

func (r *SeriesRepo) List(page, size int, libraryID string) ([]model.Series, int64, error) {
	var series []model.Series
	var total int64

	query := r.db.Model(&model.Series{}).Where("episode_count > 0")
	if libraryID != "" {
		query = query.Where("library_id = ?", libraryID)
	}

	query.Count(&total)
	err := query.Order("title ASC").Offset((page - 1) * size).Limit(size).Find(&series).Error
	return series, total, err
}

func (r *SeriesRepo) CountByLibrary(libraryID string) (int64, error) {
	var count int64
	query := r.db.Model(&model.Series{}).Where("episode_count > 0")
	if libraryID != "" {
		query = query.Where("library_id = ?", libraryID)
	}
	err := query.Count(&count).Error
	return count, err
}

func (r *SeriesRepo) ListAll(libraryID string) ([]model.Series, error) {
	var series []model.Series
	query := r.db.Where("episode_count > 0")
	if libraryID != "" {
		query = query.Where("library_id = ?", libraryID)
	}
	err := query.Order("created_at DESC").Find(&series).Error
	return series, err
}

func (r *SeriesRepo) Update(series *model.Series) error {
	return r.db.Save(series).Error
}

func (r *SeriesRepo) Delete(id string) error {
	return r.db.Delete(&model.Series{}, "id = ?", id).Error
}

func (r *SeriesRepo) DeleteByLibraryID(libraryID string) error {
	return r.db.Unscoped().Where("library_id = ?", libraryID).Delete(&model.Series{}).Error
}

func (r *SeriesRepo) CleanOrphanedByLibraryIDs(validLibraryIDs []string) (int64, error) {
	var result *gorm.DB
	if len(validLibraryIDs) == 0 {
		result = r.db.Unscoped().Where("1 = 1").Delete(&model.Series{})
	} else {
		result = r.db.Unscoped().Where("library_id NOT IN ?", validLibraryIDs).Delete(&model.Series{})
	}
	return result.RowsAffected, result.Error
}

func (r *SeriesRepo) CleanEmptySeries() (int64, error) {
	result := r.db.Unscoped().Where("episode_count = 0 OR episode_count IS NULL").Delete(&model.Series{})
	return result.RowsAffected, result.Error
}

func (r *SeriesRepo) GetSeasonNumbers(seriesID string) ([]int, error) {
	var seasons []int
	err := r.db.Model(&model.Media{}).
		Where("series_id = ?", seriesID).
		Distinct("season_num").
		Order("season_num ASC").
		Pluck("season_num", &seasons).Error
	return seasons, err
}

func (r *SeriesRepo) RecentUpdated(limit int) ([]model.Series, error) {
	var series []model.Series
	err := r.db.Where("episode_count > 0").Order("updated_at DESC").Limit(limit).Find(&series).Error
	return series, err
}

func (r *SeriesRepo) RecentUpdatedByLibrary(libraryID string, limit int) ([]model.Series, error) {
	var series []model.Series
	err := r.db.Where("library_id = ? AND episode_count > 0", libraryID).
		Order("updated_at DESC").Limit(limit).Find(&series).Error
	return series, err
}

// SearchSeries 搜索合集
func (r *SeriesRepo) SearchSeries(keyword string, page, size int) ([]model.Series, int64, error) {
	var series []model.Series
	var total int64

	query := r.db.Model(&model.Series{}).Where("name LIKE ?", "%"+keyword+"%")
	query.Count(&total)
	err := query.Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&series).Error
	return series, total, err
}
