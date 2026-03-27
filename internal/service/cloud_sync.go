package service

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/nowen-video/nowen-video/internal/model"
	"github.com/nowen-video/nowen-video/internal/repository"
	"go.uber.org/zap"
)

// CloudSyncService 云端同步服务
type CloudSyncService struct {
	deviceRepo   *repository.SyncDeviceRepo
	syncRepo     *repository.SyncRecordRepo
	configRepo   *repository.UserSyncConfigRepo
	watchHistory *repository.WatchHistoryRepo
	favoriteRepo *repository.FavoriteRepo
	playlistRepo *repository.PlaylistRepo
	logger       *zap.SugaredLogger
	wsHub        *WSHub
}

// NewCloudSyncService 创建云端同步服务
func NewCloudSyncService(
	deviceRepo *repository.SyncDeviceRepo,
	syncRepo *repository.SyncRecordRepo,
	configRepo *repository.UserSyncConfigRepo,
	watchHistory *repository.WatchHistoryRepo,
	favoriteRepo *repository.FavoriteRepo,
	playlistRepo *repository.PlaylistRepo,
	logger *zap.SugaredLogger,
) *CloudSyncService {
	return &CloudSyncService{
		deviceRepo:   deviceRepo,
		syncRepo:     syncRepo,
		configRepo:   configRepo,
		watchHistory: watchHistory,
		favoriteRepo: favoriteRepo,
		playlistRepo: playlistRepo,
		logger:       logger,
	}
}

func (s *CloudSyncService) SetWSHub(hub *WSHub) {
	s.wsHub = hub
}

// ==================== 设备管理 ====================

// RegisterDevice 注册/更新设备
func (s *CloudSyncService) RegisterDevice(userID string, deviceID, deviceName, deviceType, platform, appVersion string) (*model.SyncDevice, error) {
	// 查找已有设备
	existing, err := s.deviceRepo.FindByDeviceID(deviceID)
	if err == nil {
		// 更新设备信息
		existing.DeviceName = deviceName
		existing.Platform = platform
		existing.AppVersion = appVersion
		existing.IsOnline = true
		now := time.Now()
		existing.LastActiveAt = &now
		if err := s.deviceRepo.Update(existing); err != nil {
			return nil, err
		}
		return existing, nil
	}

	// 创建新设备
	device := &model.SyncDevice{
		UserID:     userID,
		DeviceName: deviceName,
		DeviceType: deviceType,
		DeviceID:   deviceID,
		Platform:   platform,
		AppVersion: appVersion,
		IsOnline:   true,
	}
	now := time.Now()
	device.LastActiveAt = &now

	if err := s.deviceRepo.Create(device); err != nil {
		return nil, err
	}

	s.logger.Infof("设备注册: %s (%s) - 用户 %s", deviceName, deviceType, userID)
	return device, nil
}

// UnregisterDevice 注销设备
func (s *CloudSyncService) UnregisterDevice(userID, deviceID string) error {
	device, err := s.deviceRepo.FindByDeviceID(deviceID)
	if err != nil {
		return fmt.Errorf("设备不存在")
	}
	if device.UserID != userID {
		return ErrForbidden
	}
	return s.deviceRepo.Delete(device.ID)
}

// ListDevices 获取用户的设备列表
func (s *CloudSyncService) ListDevices(userID string) ([]model.SyncDevice, error) {
	return s.deviceRepo.ListByUserID(userID)
}

// SetDeviceOffline 设置设备离线
func (s *CloudSyncService) SetDeviceOffline(deviceID string) error {
	device, err := s.deviceRepo.FindByDeviceID(deviceID)
	if err != nil {
		return err
	}
	device.IsOnline = false
	return s.deviceRepo.Update(device)
}

// ==================== 数据同步 ====================

// SyncData 同步数据（上传）
func (s *CloudSyncService) SyncData(userID, deviceID, dataType, dataKey, dataValue string, version int64) error {
	record := &model.SyncRecord{
		UserID:    userID,
		DeviceID:  deviceID,
		DataType:  dataType,
		DataKey:   dataKey,
		DataValue: dataValue,
		Version:   version,
		SyncedAt:  time.Now(),
	}

	if err := s.syncRepo.Upsert(record); err != nil {
		return err
	}

	// 更新设备最后同步时间
	if device, err := s.deviceRepo.FindByDeviceID(deviceID); err == nil {
		now := time.Now()
		device.LastSyncAt = &now
		device.LastActiveAt = &now
		s.deviceRepo.Update(device)
	}

	// 通知其他设备
	if s.wsHub != nil {
		s.wsHub.BroadcastEvent("sync_update", map[string]interface{}{
			"user_id":   userID,
			"device_id": deviceID,
			"data_type": dataType,
			"data_key":  dataKey,
			"version":   version,
		})
	}

	return nil
}

// PullData 拉取数据（下载）
func (s *CloudSyncService) PullData(userID, dataType string, sinceVersion int64) ([]model.SyncRecord, error) {
	return s.syncRepo.GetLatest(userID, dataType, sinceVersion)
}

// BatchSync 批量同步数据
func (s *CloudSyncService) BatchSync(userID, deviceID string, records []model.SyncRecord) (int, int, error) {
	success := 0
	failed := 0

	for _, record := range records {
		record.UserID = userID
		record.DeviceID = deviceID
		record.SyncedAt = time.Now()

		if err := s.syncRepo.Upsert(&record); err != nil {
			failed++
			s.logger.Debugf("同步记录失败: %v", err)
		} else {
			success++
		}
	}

	// 更新设备同步时间
	if device, err := s.deviceRepo.FindByDeviceID(deviceID); err == nil {
		now := time.Now()
		device.LastSyncAt = &now
		s.deviceRepo.Update(device)
	}

	return success, failed, nil
}

// FullSync 全量同步（将用户的所有数据打包）
func (s *CloudSyncService) FullSync(userID string) (map[string]interface{}, error) {
	result := make(map[string]interface{})

	// 同步观看进度
	histories, err := s.watchHistory.GetAllByUserID(userID)
	if err == nil {
		var progressData []map[string]interface{}
		for _, h := range histories {
			progressData = append(progressData, map[string]interface{}{
				"media_id":  h.MediaID,
				"position":  h.Position,
				"duration":  h.Duration,
				"completed": h.Completed,
				"updated":   h.UpdatedAt,
			})
		}
		result["progress"] = progressData
	}

	// 同步收藏
	favorites, _, err := s.favoriteRepo.List(userID, 1, 10000)
	if err == nil {
		var favData []string
		for _, f := range favorites {
			favData = append(favData, f.MediaID)
		}
		result["favorites"] = favData
	}

	// 同步播放列表
	playlists, err := s.playlistRepo.ListByUserID(userID)
	if err == nil {
		var playlistData []map[string]interface{}
		for _, p := range playlists {
			var items []string
			for _, item := range p.Items {
				items = append(items, item.MediaID)
			}
			playlistData = append(playlistData, map[string]interface{}{
				"name":  p.Name,
				"items": items,
			})
		}
		result["playlists"] = playlistData
	}

	return result, nil
}

// ==================== 同步配置 ====================

// GetSyncConfig 获取用户同步配置
func (s *CloudSyncService) GetSyncConfig(userID string) (*model.UserSyncConfig, error) {
	config, err := s.configRepo.FindByUserID(userID)
	if err != nil {
		// 返回默认配置
		return &model.UserSyncConfig{
			UserID:          userID,
			SyncProgress:    true,
			SyncFavorites:   true,
			SyncPlaylists:   true,
			SyncHistory:     true,
			SyncSettings:    true,
			AutoSync:        true,
			SyncIntervalMin: 5,
		}, nil
	}
	return config, nil
}

// UpdateSyncConfig 更新同步配置
func (s *CloudSyncService) UpdateSyncConfig(config *model.UserSyncConfig) error {
	return s.configRepo.Upsert(config)
}

// ==================== 冲突解决 ====================

// SyncConflict 同步冲突信息
type SyncConflict struct {
	DataType    string    `json:"data_type"`
	DataKey     string    `json:"data_key"`
	LocalValue  string    `json:"local_value"`
	RemoteValue string    `json:"remote_value"`
	LocalTime   time.Time `json:"local_time"`
	RemoteTime  time.Time `json:"remote_time"`
}

// ResolveConflict 解决同步冲突（使用最后写入胜出策略）
func (s *CloudSyncService) ResolveConflict(userID, dataType, dataKey string, useLocal bool, value string) error {
	record := &model.SyncRecord{
		UserID:    userID,
		DataType:  dataType,
		DataKey:   dataKey,
		DataValue: value,
		Version:   time.Now().UnixMilli(),
		SyncedAt:  time.Now(),
	}
	return s.syncRepo.Upsert(record)
}

// ==================== 数据导出/导入 ====================

// ExportUserData 导出用户数据（用于迁移）
func (s *CloudSyncService) ExportUserData(userID string) (string, error) {
	data, err := s.FullSync(userID)
	if err != nil {
		return "", err
	}

	exportData := map[string]interface{}{
		"version":   "3.0",
		"user_id":   userID,
		"export_at": time.Now().Format(time.RFC3339),
		"data":      data,
	}

	jsonBytes, err := json.MarshalIndent(exportData, "", "  ")
	if err != nil {
		return "", err
	}

	return string(jsonBytes), nil
}
