package service

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/nowen-video/nowen-video/internal/model"
	"github.com/nowen-video/nowen-video/internal/repository"
	"go.uber.org/zap"
)

// SyncOperation 同步操作日志条目（用于离线队列和重放）
type SyncOperation struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	DeviceID  string    `json:"device_id"`
	Action    string    `json:"action"` // create / update / delete
	DataType  string    `json:"data_type"`
	DataKey   string    `json:"data_key"`
	DataValue string    `json:"data_value"`
	Timestamp time.Time `json:"timestamp"`
	Applied   bool      `json:"applied"`
}

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

	// 操作日志队列（用于离线操作排队和重放）
	opQueue   []SyncOperation
	opQueueMu sync.Mutex
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

// ResolveConflict 解决同步冲突（支持多种策略）
// strategy: "local" / "remote" / "merge" / "latest"
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

// ResolveConflictWithMerge 智能合并冲突（适用于播放列表等集合类型数据）
func (s *CloudSyncService) ResolveConflictWithMerge(userID, dataType, dataKey, localValue, remoteValue string) error {
	var mergedValue string

	switch dataType {
	case "playlist", "favorites":
		// 集合类型数据：使用 union merge（合并去重）
		var localItems, remoteItems []string
		json.Unmarshal([]byte(localValue), &localItems)
		json.Unmarshal([]byte(remoteValue), &remoteItems)

		seen := make(map[string]bool)
		var merged []string
		for _, item := range localItems {
			if !seen[item] {
				seen[item] = true
				merged = append(merged, item)
			}
		}
		for _, item := range remoteItems {
			if !seen[item] {
				seen[item] = true
				merged = append(merged, item)
			}
		}

		mergedBytes, _ := json.Marshal(merged)
		mergedValue = string(mergedBytes)

	case "progress":
		// 观看进度：取进度更大的那个
		var localProgress, remoteProgress struct {
			Position  float64 `json:"position"`
			Completed bool    `json:"completed"`
		}
		json.Unmarshal([]byte(localValue), &localProgress)
		json.Unmarshal([]byte(remoteValue), &remoteProgress)

		if remoteProgress.Completed || remoteProgress.Position > localProgress.Position {
			mergedValue = remoteValue
		} else {
			mergedValue = localValue
		}

	default:
		// 默认：最后写入胜出（Last Write Wins）
		mergedValue = remoteValue
	}

	record := &model.SyncRecord{
		UserID:    userID,
		DataType:  dataType,
		DataKey:   dataKey,
		DataValue: mergedValue,
		Version:   time.Now().UnixMilli(),
		SyncedAt:  time.Now(),
	}

	s.logger.Infof("同步冲突已通过合并解决: type=%s, key=%s", dataType, dataKey)
	return s.syncRepo.Upsert(record)
}

// ==================== 操作日志队列（离线支持） ====================

// EnqueueOperation 将操作加入离线队列
func (s *CloudSyncService) EnqueueOperation(op SyncOperation) {
	s.opQueueMu.Lock()
	defer s.opQueueMu.Unlock()
	op.Timestamp = time.Now()
	op.Applied = false
	s.opQueue = append(s.opQueue, op)
	s.logger.Debugf("操作已加入离线队列: %s %s/%s", op.Action, op.DataType, op.DataKey)
}

// FlushOperationQueue 重放离线队列中的操作（网络恢复后调用）
func (s *CloudSyncService) FlushOperationQueue(userID, deviceID string) (int, int, error) {
	s.opQueueMu.Lock()
	pending := make([]SyncOperation, 0)
	for _, op := range s.opQueue {
		if op.UserID == userID && !op.Applied {
			pending = append(pending, op)
		}
	}
	s.opQueueMu.Unlock()

	success, failed := 0, 0
	for i := range pending {
		err := s.SyncData(userID, deviceID, pending[i].DataType, pending[i].DataKey, pending[i].DataValue, time.Now().UnixMilli())
		if err != nil {
			failed++
			s.logger.Debugf("重放操作失败: %v", err)
		} else {
			success++
			pending[i].Applied = true
		}
	}

	// 清理已应用的操作
	s.opQueueMu.Lock()
	var remaining []SyncOperation
	for _, op := range s.opQueue {
		if !op.Applied {
			remaining = append(remaining, op)
		}
	}
	s.opQueue = remaining
	s.opQueueMu.Unlock()

	s.logger.Infof("离线队列重放完成: 成功=%d, 失败=%d", success, failed)
	return success, failed, nil
}

// GetPendingOperations 获取待同步的操作数量
func (s *CloudSyncService) GetPendingOperations(userID string) int {
	s.opQueueMu.Lock()
	defer s.opQueueMu.Unlock()
	count := 0
	for _, op := range s.opQueue {
		if op.UserID == userID && !op.Applied {
			count++
		}
	}
	return count
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
