package repository

import (
	"github.com/nowen-video/nowen-video/internal/model"
	"gorm.io/gorm"
)

// ==================== TranscodeRepo ====================

type TranscodeRepo struct {
	db *gorm.DB
}

func (r *TranscodeRepo) Create(task *model.TranscodeTask) error {
	return r.db.Create(task).Error
}

func (r *TranscodeRepo) Update(task *model.TranscodeTask) error {
	return r.db.Save(task).Error
}

func (r *TranscodeRepo) FindByMediaAndQuality(mediaID, quality string) (*model.TranscodeTask, error) {
	var task model.TranscodeTask
	err := r.db.Where("media_id = ? AND quality = ? AND status = ?", mediaID, quality, "done").First(&task).Error
	return &task, err
}

func (r *TranscodeRepo) ListRunning() ([]model.TranscodeTask, error) {
	var tasks []model.TranscodeTask
	err := r.db.Where("status IN ?", []string{"pending", "running"}).Find(&tasks).Error
	return tasks, err
}

// ==================== PlaybackStatsRepo ====================

type PlaybackStatsRepo struct {
	db *gorm.DB
}

func (r *PlaybackStatsRepo) Record(stat *model.PlaybackStats) error {
	return r.db.Create(stat).Error
}

func (r *PlaybackStatsRepo) GetUserDailyStats(userID string, startDate, endDate string) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	err := r.db.Model(&model.PlaybackStats{}).
		Select("date, SUM(watch_minutes) as total_minutes, COUNT(DISTINCT media_id) as media_count").
		Where("user_id = ? AND date >= ? AND date <= ?", userID, startDate, endDate).
		Group("date").Order("date ASC").
		Scan(&results).Error
	return results, err
}

func (r *PlaybackStatsRepo) GetUserTotalMinutes(userID string) (float64, error) {
	var total float64
	err := r.db.Model(&model.PlaybackStats{}).Where("user_id = ?", userID).
		Select("COALESCE(SUM(watch_minutes), 0)").Scan(&total).Error
	return total, err
}

func (r *PlaybackStatsRepo) GetUserTopGenres(userID string, limit int) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	err := r.db.Raw(`
		SELECT m.genres, SUM(ps.watch_minutes) as total_minutes
		FROM playback_stats ps
		JOIN media m ON ps.media_id = m.id
		WHERE ps.user_id = ? AND m.genres != ''
		GROUP BY m.genres
		ORDER BY total_minutes DESC
		LIMIT ?
	`, userID, limit).Scan(&results).Error
	return results, err
}

func (r *PlaybackStatsRepo) GetMostWatchedMedia(userID string, limit int) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	err := r.db.Raw(`
		SELECT ps.media_id, m.title, m.poster_path, SUM(ps.watch_minutes) as total_minutes
		FROM playback_stats ps
		JOIN media m ON ps.media_id = m.id
		WHERE ps.user_id = ?
		GROUP BY ps.media_id
		ORDER BY total_minutes DESC
		LIMIT ?
	`, userID, limit).Scan(&results).Error
	return results, err
}
