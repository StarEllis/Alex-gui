package repository

import (
	"alex-desktop/model"
	"gorm.io/gorm"
)

// ==================== V3: VideoChapterRepo ====================

type VideoChapterRepo struct {
	db *gorm.DB
}

func (r *VideoChapterRepo) Create(chapter *model.VideoChapter) error {
	return r.db.Create(chapter).Error
}

func (r *VideoChapterRepo) ListByMediaID(mediaID string) ([]model.VideoChapter, error) {
	var chapters []model.VideoChapter
	err := r.db.Where("media_id = ?", mediaID).Order("start_time ASC").Find(&chapters).Error
	return chapters, err
}

func (r *VideoChapterRepo) DeleteByMediaID(mediaID string) error {
	return r.db.Where("media_id = ?", mediaID).Delete(&model.VideoChapter{}).Error
}

func (r *VideoChapterRepo) FindByID(id string) (*model.VideoChapter, error) {
	var chapter model.VideoChapter
	err := r.db.First(&chapter, "id = ?", id).Error
	return &chapter, err
}

func (r *VideoChapterRepo) Update(chapter *model.VideoChapter) error {
	return r.db.Save(chapter).Error
}

func (r *VideoChapterRepo) Delete(id string) error {
	return r.db.Delete(&model.VideoChapter{}, "id = ?", id).Error
}

// ==================== V3: VideoHighlightRepo ====================

type VideoHighlightRepo struct {
	db *gorm.DB
}

func (r *VideoHighlightRepo) Create(highlight *model.VideoHighlight) error {
	return r.db.Create(highlight).Error
}

func (r *VideoHighlightRepo) ListByMediaID(mediaID string) ([]model.VideoHighlight, error) {
	var highlights []model.VideoHighlight
	err := r.db.Where("media_id = ?", mediaID).Order("score DESC").Find(&highlights).Error
	return highlights, err
}

func (r *VideoHighlightRepo) DeleteByMediaID(mediaID string) error {
	return r.db.Where("media_id = ?", mediaID).Delete(&model.VideoHighlight{}).Error
}

func (r *VideoHighlightRepo) Delete(id string) error {
	return r.db.Delete(&model.VideoHighlight{}, "id = ?", id).Error
}

// ==================== V3: AIAnalysisTaskRepo ====================

type AIAnalysisTaskRepo struct {
	db *gorm.DB
}

func (r *AIAnalysisTaskRepo) Create(task *model.AIAnalysisTask) error {
	return r.db.Create(task).Error
}

func (r *AIAnalysisTaskRepo) FindByID(id string) (*model.AIAnalysisTask, error) {
	var task model.AIAnalysisTask
	err := r.db.First(&task, "id = ?", id).Error
	return &task, err
}

func (r *AIAnalysisTaskRepo) Update(task *model.AIAnalysisTask) error {
	return r.db.Save(task).Error
}

func (r *AIAnalysisTaskRepo) ListByMediaID(mediaID string) ([]model.AIAnalysisTask, error) {
	var tasks []model.AIAnalysisTask
	err := r.db.Where("media_id = ?", mediaID).Order("created_at DESC").Find(&tasks).Error
	return tasks, err
}

func (r *AIAnalysisTaskRepo) ListByStatus(status string, limit int) ([]model.AIAnalysisTask, error) {
	var tasks []model.AIAnalysisTask
	err := r.db.Where("status = ?", status).Order("created_at ASC").Limit(limit).Find(&tasks).Error
	return tasks, err
}

// ==================== V3: CoverCandidateRepo ====================

type CoverCandidateRepo struct {
	db *gorm.DB
}

func (r *CoverCandidateRepo) Create(candidate *model.CoverCandidate) error {
	return r.db.Create(candidate).Error
}

func (r *CoverCandidateRepo) ListByMediaID(mediaID string) ([]model.CoverCandidate, error) {
	var candidates []model.CoverCandidate
	err := r.db.Where("media_id = ?", mediaID).Order("score DESC").Find(&candidates).Error
	return candidates, err
}

func (r *CoverCandidateRepo) DeleteByMediaID(mediaID string) error {
	return r.db.Where("media_id = ?", mediaID).Delete(&model.CoverCandidate{}).Error
}

func (r *CoverCandidateRepo) SelectCover(mediaID, candidateID string) error {
	// 先取消所有选中
	r.db.Model(&model.CoverCandidate{}).Where("media_id = ?", mediaID).Update("is_selected", false)
	// 选中指定候选
	return r.db.Model(&model.CoverCandidate{}).Where("id = ?", candidateID).Update("is_selected", true).Error
}

// ==================== V3: FamilyGroupRepo ====================

type FamilyGroupRepo struct {
	db *gorm.DB
}

func (r *FamilyGroupRepo) Create(group *model.FamilyGroup) error {
	return r.db.Create(group).Error
}

func (r *FamilyGroupRepo) FindByID(id string) (*model.FamilyGroup, error) {
	var group model.FamilyGroup
	err := r.db.Preload("Members.User").First(&group, "id = ?", id).Error
	return &group, err
}

func (r *FamilyGroupRepo) FindByInviteCode(code string) (*model.FamilyGroup, error) {
	var group model.FamilyGroup
	err := r.db.Where("invite_code = ?", code).First(&group).Error
	return &group, err
}

func (r *FamilyGroupRepo) ListByUserID(userID string) ([]model.FamilyGroup, error) {
	var groups []model.FamilyGroup
	err := r.db.Joins("JOIN family_members ON family_members.group_id = family_groups.id").
		Where("family_members.user_id = ?", userID).
		Preload("Members.User").
		Find(&groups).Error
	return groups, err
}

func (r *FamilyGroupRepo) Update(group *model.FamilyGroup) error {
	return r.db.Save(group).Error
}

func (r *FamilyGroupRepo) Delete(id string) error {
	// 先删除成员
	r.db.Where("group_id = ?", id).Delete(&model.FamilyMember{})
	return r.db.Delete(&model.FamilyGroup{}, "id = ?", id).Error
}

// ==================== V3: FamilyMemberRepo ====================

type FamilyMemberRepo struct {
	db *gorm.DB
}

func (r *FamilyMemberRepo) Create(member *model.FamilyMember) error {
	return r.db.Create(member).Error
}

func (r *FamilyMemberRepo) FindByGroupAndUser(groupID, userID string) (*model.FamilyMember, error) {
	var member model.FamilyMember
	err := r.db.Where("group_id = ? AND user_id = ?", groupID, userID).First(&member).Error
	return &member, err
}

func (r *FamilyMemberRepo) Delete(id string) error {
	return r.db.Delete(&model.FamilyMember{}, "id = ?", id).Error
}

func (r *FamilyMemberRepo) CountByGroup(groupID string) (int64, error) {
	var count int64
	err := r.db.Model(&model.FamilyMember{}).Where("group_id = ?", groupID).Count(&count).Error
	return count, err
}

// ==================== V3: MediaShareRepo ====================

type MediaShareRepo struct {
	db *gorm.DB
}

func (r *MediaShareRepo) Create(share *model.MediaShare) error {
	return r.db.Create(share).Error
}

func (r *MediaShareRepo) ListByGroupID(groupID string, page, size int) ([]model.MediaShare, int64, error) {
	var shares []model.MediaShare
	var total int64
	query := r.db.Model(&model.MediaShare{}).Where("group_id = ?", groupID)
	query.Count(&total)
	err := query.Preload("User").Preload("Media").Preload("Series").
		Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&shares).Error
	return shares, total, err
}

// ==================== V3: MediaLikeRepo ====================

type MediaLikeRepo struct {
	db *gorm.DB
}

func (r *MediaLikeRepo) Create(like *model.MediaLike) error {
	return r.db.Create(like).Error
}

func (r *MediaLikeRepo) Delete(userID, mediaID string) error {
	return r.db.Where("user_id = ? AND media_id = ?", userID, mediaID).Delete(&model.MediaLike{}).Error
}

func (r *MediaLikeRepo) Exists(userID, mediaID string) bool {
	var count int64
	r.db.Model(&model.MediaLike{}).Where("user_id = ? AND media_id = ?", userID, mediaID).Count(&count)
	return count > 0
}

func (r *MediaLikeRepo) CountByMedia(mediaID string) (int64, error) {
	var count int64
	err := r.db.Model(&model.MediaLike{}).Where("media_id = ?", mediaID).Count(&count).Error
	return count, err
}

// ==================== V3: MediaRecommendationRepo ====================

type MediaRecommendationRepo struct {
	db *gorm.DB
}

func (r *MediaRecommendationRepo) Create(rec *model.MediaRecommendation) error {
	return r.db.Create(rec).Error
}

func (r *MediaRecommendationRepo) ListByToUser(userID string, page, size int) ([]model.MediaRecommendation, int64, error) {
	var recs []model.MediaRecommendation
	var total int64
	query := r.db.Model(&model.MediaRecommendation{}).Where("to_user_id = ?", userID)
	query.Count(&total)
	err := query.Preload("FromUser").Preload("Media").Preload("Series").
		Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&recs).Error
	return recs, total, err
}

func (r *MediaRecommendationRepo) MarkAsRead(id string) error {
	return r.db.Model(&model.MediaRecommendation{}).Where("id = ?", id).Update("is_read", true).Error
}

func (r *MediaRecommendationRepo) CountUnread(userID string) (int64, error) {
	var count int64
	err := r.db.Model(&model.MediaRecommendation{}).Where("to_user_id = ? AND is_read = ?", userID, false).Count(&count).Error
	return count, err
}

// ==================== V3: LiveSourceRepo ====================

type LiveSourceRepo struct {
	db *gorm.DB
}

func (r *LiveSourceRepo) Create(source *model.LiveSource) error {
	return r.db.Create(source).Error
}

func (r *LiveSourceRepo) FindByID(id string) (*model.LiveSource, error) {
	var source model.LiveSource
	err := r.db.First(&source, "id = ?", id).Error
	return &source, err
}

func (r *LiveSourceRepo) List(category string, page, size int) ([]model.LiveSource, int64, error) {
	var sources []model.LiveSource
	var total int64
	query := r.db.Model(&model.LiveSource{}).Where("is_active = ?", true)
	if category != "" {
		query = query.Where("category = ?", category)
	}
	query.Count(&total)
	err := query.Order("sort_order ASC, name ASC").Offset((page - 1) * size).Limit(size).Find(&sources).Error
	return sources, total, err
}

func (r *LiveSourceRepo) ListAll() ([]model.LiveSource, error) {
	var sources []model.LiveSource
	err := r.db.Order("sort_order ASC, name ASC").Find(&sources).Error
	return sources, err
}

func (r *LiveSourceRepo) Update(source *model.LiveSource) error {
	return r.db.Save(source).Error
}

func (r *LiveSourceRepo) Delete(id string) error {
	return r.db.Delete(&model.LiveSource{}, "id = ?", id).Error
}

func (r *LiveSourceRepo) ListAdmin(category string, keyword string, page, size int) ([]model.LiveSource, int64, error) {
	var sources []model.LiveSource
	var total int64
	query := r.db.Model(&model.LiveSource{})
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if keyword != "" {
		query = query.Where("name LIKE ? OR url LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	query.Count(&total)
	err := query.Order("sort_order ASC, name ASC").Offset((page - 1) * size).Limit(size).Find(&sources).Error
	return sources, total, err
}

func (r *LiveSourceRepo) BatchCreate(sources []model.LiveSource) error {
	return r.db.CreateInBatches(sources, 100).Error
}

func (r *LiveSourceRepo) GetCategories() ([]string, error) {
	var categories []string
	err := r.db.Model(&model.LiveSource{}).Distinct("category").Where("category != ''").Pluck("category", &categories).Error
	return categories, err
}

// ==================== V3: LivePlaylistRepo ====================

type LivePlaylistRepo struct {
	db *gorm.DB
}

func (r *LivePlaylistRepo) Create(playlist *model.LivePlaylist) error {
	return r.db.Create(playlist).Error
}

func (r *LivePlaylistRepo) FindByID(id string) (*model.LivePlaylist, error) {
	var playlist model.LivePlaylist
	err := r.db.First(&playlist, "id = ?", id).Error
	return &playlist, err
}

func (r *LivePlaylistRepo) List() ([]model.LivePlaylist, error) {
	var playlists []model.LivePlaylist
	err := r.db.Order("created_at DESC").Find(&playlists).Error
	return playlists, err
}

func (r *LivePlaylistRepo) Update(playlist *model.LivePlaylist) error {
	return r.db.Save(playlist).Error
}

func (r *LivePlaylistRepo) Delete(id string) error {
	return r.db.Delete(&model.LivePlaylist{}, "id = ?", id).Error
}

// ==================== V3: LiveRecordingRepo ====================

type LiveRecordingRepo struct {
	db *gorm.DB
}

func (r *LiveRecordingRepo) Create(recording *model.LiveRecording) error {
	return r.db.Create(recording).Error
}

func (r *LiveRecordingRepo) FindByID(id string) (*model.LiveRecording, error) {
	var recording model.LiveRecording
	err := r.db.Preload("Source").First(&recording, "id = ?", id).Error
	return &recording, err
}

func (r *LiveRecordingRepo) ListByUserID(userID string, page, size int) ([]model.LiveRecording, int64, error) {
	var recordings []model.LiveRecording
	var total int64
	query := r.db.Model(&model.LiveRecording{}).Where("user_id = ?", userID)
	query.Count(&total)
	err := query.Preload("Source").Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&recordings).Error
	return recordings, total, err
}

func (r *LiveRecordingRepo) Update(recording *model.LiveRecording) error {
	return r.db.Save(recording).Error
}

func (r *LiveRecordingRepo) Delete(id string) error {
	return r.db.Delete(&model.LiveRecording{}, "id = ?", id).Error
}

func (r *LiveRecordingRepo) ListRecording() ([]model.LiveRecording, error) {
	var recordings []model.LiveRecording
	err := r.db.Where("status = ?", "recording").Find(&recordings).Error
	return recordings, err
}

// ==================== V3: SyncDeviceRepo ====================

type SyncDeviceRepo struct {
	db *gorm.DB
}

func (r *SyncDeviceRepo) Create(device *model.SyncDevice) error {
	return r.db.Create(device).Error
}

func (r *SyncDeviceRepo) FindByDeviceID(deviceID string) (*model.SyncDevice, error) {
	var device model.SyncDevice
	err := r.db.Where("device_id = ?", deviceID).First(&device).Error
	return &device, err
}

func (r *SyncDeviceRepo) ListByUserID(userID string) ([]model.SyncDevice, error) {
	var devices []model.SyncDevice
	err := r.db.Where("user_id = ?", userID).Order("last_active_at DESC").Find(&devices).Error
	return devices, err
}

func (r *SyncDeviceRepo) Update(device *model.SyncDevice) error {
	return r.db.Save(device).Error
}

func (r *SyncDeviceRepo) Delete(id string) error {
	return r.db.Delete(&model.SyncDevice{}, "id = ?", id).Error
}

// ==================== V3: SyncRecordRepo ====================

type SyncRecordRepo struct {
	db *gorm.DB
}

func (r *SyncRecordRepo) Upsert(record *model.SyncRecord) error {
	var existing model.SyncRecord
	err := r.db.Where("user_id = ? AND data_type = ? AND data_key = ?",
		record.UserID, record.DataType, record.DataKey).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		return r.db.Create(record).Error
	}
	if record.Version > existing.Version {
		existing.DataValue = record.DataValue
		existing.Version = record.Version
		existing.DeviceID = record.DeviceID
		return r.db.Save(&existing).Error
	}
	return nil // 版本较旧，忽略
}

func (r *SyncRecordRepo) GetLatest(userID, dataType string, since int64) ([]model.SyncRecord, error) {
	var records []model.SyncRecord
	query := r.db.Where("user_id = ? AND data_type = ?", userID, dataType)
	if since > 0 {
		query = query.Where("version > ?", since)
	}
	err := query.Order("version DESC").Find(&records).Error
	return records, err
}

func (r *SyncRecordRepo) GetByKey(userID, dataType, dataKey string) (*model.SyncRecord, error) {
	var record model.SyncRecord
	err := r.db.Where("user_id = ? AND data_type = ? AND data_key = ?", userID, dataType, dataKey).First(&record).Error
	return &record, err
}

// ==================== V3: UserSyncConfigRepo ====================

type UserSyncConfigRepo struct {
	db *gorm.DB
}

func (r *UserSyncConfigRepo) FindByUserID(userID string) (*model.UserSyncConfig, error) {
	var config model.UserSyncConfig
	err := r.db.Where("user_id = ?", userID).First(&config).Error
	return &config, err
}

func (r *UserSyncConfigRepo) Upsert(config *model.UserSyncConfig) error {
	var existing model.UserSyncConfig
	err := r.db.Where("user_id = ?", config.UserID).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		return r.db.Create(config).Error
	}
	config.ID = existing.ID
	return r.db.Save(config).Error
}
