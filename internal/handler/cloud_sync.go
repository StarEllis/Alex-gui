package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nowen-video/nowen-video/internal/model"
	"github.com/nowen-video/nowen-video/internal/service"
	"go.uber.org/zap"
)

// CloudSyncHandler 云端同步处理器
type CloudSyncHandler struct {
	syncService *service.CloudSyncService
	logger      *zap.SugaredLogger
}

// ==================== 设备管理 ====================

// RegisterDeviceRequest 注册设备请求
type RegisterDeviceRequest struct {
	DeviceID   string `json:"device_id" binding:"required"`
	DeviceName string `json:"device_name" binding:"required"`
	DeviceType string `json:"device_type" binding:"required"` // phone/tablet/tv/desktop/browser
	Platform   string `json:"platform"`
	AppVersion string `json:"app_version"`
}

// RegisterDevice 注册设备
func (h *CloudSyncHandler) RegisterDevice(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req RegisterDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	device, err := h.syncService.RegisterDevice(
		userID.(string), req.DeviceID, req.DeviceName,
		req.DeviceType, req.Platform, req.AppVersion,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "注册设备失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": device})
}

// UnregisterDevice 注销设备
func (h *CloudSyncHandler) UnregisterDevice(c *gin.Context) {
	userID, _ := c.Get("user_id")
	deviceID := c.Param("deviceId")

	if err := h.syncService.UnregisterDevice(userID.(string), deviceID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "设备已注销"})
}

// ListDevices 获取设备列表
func (h *CloudSyncHandler) ListDevices(c *gin.Context) {
	userID, _ := c.Get("user_id")

	devices, err := h.syncService.ListDevices(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取设备列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": devices})
}

// ==================== 数据同步 ====================

// SyncDataRequest 同步数据请求
type SyncDataRequest struct {
	DeviceID  string `json:"device_id" binding:"required"`
	DataType  string `json:"data_type" binding:"required"` // progress/favorites/playlists/settings/history
	DataKey   string `json:"data_key" binding:"required"`
	DataValue string `json:"data_value" binding:"required"`
	Version   int64  `json:"version"`
}

// SyncData 同步数据（上传）
func (h *CloudSyncHandler) SyncData(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req SyncDataRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	if err := h.syncService.SyncData(
		userID.(string), req.DeviceID, req.DataType,
		req.DataKey, req.DataValue, req.Version,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "同步失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "同步成功"})
}

// PullData 拉取数据（下载）
func (h *CloudSyncHandler) PullData(c *gin.Context) {
	userID, _ := c.Get("user_id")
	dataType := c.Query("data_type")
	sinceVersion, _ := strconv.ParseInt(c.DefaultQuery("since", "0"), 10, 64)

	records, err := h.syncService.PullData(userID.(string), dataType, sinceVersion)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "拉取数据失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": records})
}

// BatchSyncRequest 批量同步请求
type BatchSyncRequest struct {
	DeviceID string             `json:"device_id" binding:"required"`
	Records  []model.SyncRecord `json:"records" binding:"required"`
}

// BatchSync 批量同步
func (h *CloudSyncHandler) BatchSync(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req BatchSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	success, failed, err := h.syncService.BatchSync(userID.(string), req.DeviceID, req.Records)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "批量同步失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": success,
		"failed":  failed,
		"message": "批量同步完成",
	})
}

// FullSync 全量同步
func (h *CloudSyncHandler) FullSync(c *gin.Context) {
	userID, _ := c.Get("user_id")

	data, err := h.syncService.FullSync(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "全量同步失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// ==================== 同步配置 ====================

// GetSyncConfig 获取同步配置
func (h *CloudSyncHandler) GetSyncConfig(c *gin.Context) {
	userID, _ := c.Get("user_id")

	config, err := h.syncService.GetSyncConfig(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取同步配置失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": config})
}

// UpdateSyncConfig 更新同步配置
func (h *CloudSyncHandler) UpdateSyncConfig(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var config model.UserSyncConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	config.UserID = userID.(string)
	if err := h.syncService.UpdateSyncConfig(&config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新同步配置失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "配置已更新"})
}

// ==================== 数据导出 ====================

// ExportData 导出用户数据
func (h *CloudSyncHandler) ExportData(c *gin.Context) {
	userID, _ := c.Get("user_id")

	data, err := h.syncService.ExportUserData(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "导出数据失败"})
		return
	}

	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=nowen_export.json")
	c.String(http.StatusOK, data)
}
