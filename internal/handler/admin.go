package handler

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/nowen-video/nowen-video/internal/config"
	"github.com/nowen-video/nowen-video/internal/repository"
	"github.com/nowen-video/nowen-video/internal/service"
	"go.uber.org/zap"
)

// AdminHandler 管理处理器
type AdminHandler struct {
	userService       *service.UserService
	transcodeService  *service.TranscodeService
	monitorService    *service.MonitorService
	schedulerService  *service.SchedulerService
	permissionService *service.PermissionService
	libraryService    *service.LibraryService
	metadataService   *service.MetadataService
	settingRepo       *repository.SystemSettingRepo
	cfg               *config.Config
	logger            *zap.SugaredLogger
}

// ListUsers 获取所有用户
func (h *AdminHandler) ListUsers(c *gin.Context) {
	users, err := h.userService.ListUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取用户列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": users})
}

// DeleteUser 删除用户
func (h *AdminHandler) DeleteUser(c *gin.Context) {
	id := c.Param("id")

	currentUserID, _ := c.Get("user_id")
	if id == currentUserID.(string) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不能删除自己"})
		return
	}

	if err := h.userService.DeleteUser(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除用户失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已删除"})
}

// SystemInfo 系统信息
func (h *AdminHandler) SystemInfo(c *gin.Context) {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"version":    "0.1.0",
			"go_version": runtime.Version(),
			"os":         runtime.GOOS,
			"arch":       runtime.GOARCH,
			"cpus":       runtime.NumCPU(),
			"goroutines": runtime.NumGoroutine(),
			"memory": gin.H{
				"alloc_mb":       memStats.Alloc / 1024 / 1024,
				"total_alloc_mb": memStats.TotalAlloc / 1024 / 1024,
				"sys_mb":         memStats.Sys / 1024 / 1024,
			},
			"hw_accel": h.transcodeService.GetHWAccelInfo(),
		},
	})
}

// TranscodeStatus 转码任务状态
func (h *AdminHandler) TranscodeStatus(c *gin.Context) {
	jobs := h.transcodeService.GetRunningJobs()

	var result []gin.H
	for _, job := range jobs {
		result = append(result, gin.H{
			"id":       job.Task.ID,
			"media_id": job.Task.MediaID,
			"quality":  job.Quality,
			"status":   job.Task.Status,
			"progress": job.Task.Progress,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// CancelTranscode 取消正在运行的转码任务
func (h *AdminHandler) CancelTranscode(c *gin.Context) {
	taskID := c.Param("taskId")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "任务ID不能为空"})
		return
	}

	if err := h.transcodeService.CancelTranscode(taskID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "转码任务已取消"})
}

// ==================== TMDb 配置管理 ====================

// GetTMDbConfig 获取 TMDb API Key 配置状态
func (h *AdminHandler) GetTMDbConfig(c *gin.Context) {
	maskedKey := h.cfg.GetTMDbAPIKeyMasked()
	configured := h.cfg.GetTMDbAPIKey() != ""

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"configured": configured,
			"masked_key": maskedKey,
		},
	})
}

// UpdateTMDbConfigRequest 更新 TMDb API Key 请求
type UpdateTMDbConfigRequest struct {
	APIKey string `json:"api_key" binding:"required"`
}

// UpdateTMDbConfig 更新 TMDb API Key
func (h *AdminHandler) UpdateTMDbConfig(c *gin.Context) {
	var req UpdateTMDbConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供有效的 API Key"})
		return
	}

	key := req.APIKey
	if len(key) < 16 || len(key) > 64 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "API Key 格式不正确，请检查后重试"})
		return
	}

	if err := h.cfg.SetTMDbAPIKey(key); err != nil {
		h.logger.Errorf("保存 TMDb API Key 失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存配置失败: " + err.Error()})
		return
	}

	h.logger.Info("TMDb API Key 已更新")
	c.JSON(http.StatusOK, gin.H{
		"message": "TMDb API Key 已保存",
		"data": gin.H{
			"configured": true,
			"masked_key": h.cfg.GetTMDbAPIKeyMasked(),
		},
	})
}

// ClearTMDbConfig 清除 TMDb API Key
func (h *AdminHandler) ClearTMDbConfig(c *gin.Context) {
	if err := h.cfg.ClearTMDbAPIKey(); err != nil {
		h.logger.Errorf("清除 TMDb API Key 失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "清除配置失败: " + err.Error()})
		return
	}

	h.logger.Info("TMDb API Key 已清除")
	c.JSON(http.StatusOK, gin.H{
		"message": "TMDb API Key 已清除",
		"data": gin.H{
			"configured": false,
			"masked_key": "",
		},
	})
}

// ==================== 系统监控 ====================

// GetMetrics 获取实时系统指标
func (h *AdminHandler) GetMetrics(c *gin.Context) {
	metrics := h.monitorService.GetMetrics()
	c.JSON(http.StatusOK, gin.H{"data": metrics})
}

// ==================== 定时任务管理 ====================

// ListScheduledTasks 获取定时任务列表
func (h *AdminHandler) ListScheduledTasks(c *gin.Context) {
	tasks, err := h.schedulerService.ListTasks()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取任务列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tasks})
}

// CreateScheduledTaskRequest 创建定时任务请求
type CreateScheduledTaskRequest struct {
	Name     string `json:"name" binding:"required"`
	Type     string `json:"type" binding:"required"`     // scan, scrape, cleanup
	Schedule string `json:"schedule" binding:"required"` // @daily, @every 6h等
	TargetID string `json:"target_id"`
}

// CreateScheduledTask 创建定时任务
func (h *AdminHandler) CreateScheduledTask(c *gin.Context) {
	var req CreateScheduledTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	task, err := h.schedulerService.CreateTask(req.Name, req.Type, req.Schedule, req.TargetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建任务失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": task})
}

// UpdateScheduledTaskRequest 更新定时任务请求
type UpdateScheduledTaskRequest struct {
	Name     string `json:"name" binding:"required"`
	Schedule string `json:"schedule" binding:"required"`
	Enabled  bool   `json:"enabled"`
}

// UpdateScheduledTask 更新定时任务
func (h *AdminHandler) UpdateScheduledTask(c *gin.Context) {
	id := c.Param("id")

	var req UpdateScheduledTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	if err := h.schedulerService.UpdateTask(id, req.Name, req.Schedule, req.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新任务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已更新"})
}

// DeleteScheduledTask 删除定时任务
func (h *AdminHandler) DeleteScheduledTask(c *gin.Context) {
	id := c.Param("id")

	if err := h.schedulerService.DeleteTask(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除任务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已删除"})
}

// RunScheduledTaskNow 立即执行定时任务
func (h *AdminHandler) RunScheduledTaskNow(c *gin.Context) {
	id := c.Param("id")

	if err := h.schedulerService.RunTaskNow(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "任务已开始执行"})
}

// ==================== 批量操作 ====================

// BatchScanRequest 批量扫描请求
type BatchScanRequest struct {
	LibraryIDs []string `json:"library_ids" binding:"required"`
}

// BatchScan 批量扫描多个媒体库
func (h *AdminHandler) BatchScan(c *gin.Context) {
	var req BatchScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	var started []string
	var errors []gin.H
	for _, id := range req.LibraryIDs {
		if err := h.libraryService.Scan(id); err != nil {
			errors = append(errors, gin.H{"library_id": id, "error": err.Error()})
		} else {
			started = append(started, id)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "批量扫描已启动",
		"started": started,
		"errors":  errors,
	})
}

// BatchScrapeRequest 批量刮削请求
type BatchScrapeRequest struct {
	MediaIDs []string `json:"media_ids" binding:"required"`
}

// BatchScrape 批量刮削元数据
func (h *AdminHandler) BatchScrape(c *gin.Context) {
	var req BatchScrapeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	// 异步执行批量刮削
	go func() {
		success := 0
		failed := 0
		for _, id := range req.MediaIDs {
			if err := h.metadataService.ScrapeMedia(id); err != nil {
				failed++
			} else {
				success++
			}
		}
		h.logger.Infof("批量刮削完成: 成功 %d, 失败 %d", success, failed)
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "批量刮削已启动",
		"total":   len(req.MediaIDs),
	})
}

// ==================== 权限管理 ====================

// GetUserPermission 获取用户权限设置
func (h *AdminHandler) GetUserPermission(c *gin.Context) {
	userID := c.Param("userId")
	perm, err := h.permissionService.GetUserPermission(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取权限失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": perm})
}

// UpdateUserPermissionRequest 更新用户权限请求
type UpdateUserPermissionRequest struct {
	AllowedLibraries string `json:"allowed_libraries"` // 逗号分隔的媒体库ID
	MaxRatingLevel   string `json:"max_rating_level"`
	DailyTimeLimit   int    `json:"daily_time_limit"` // 分钟
}

// UpdateUserPermission 更新用户权限
func (h *AdminHandler) UpdateUserPermission(c *gin.Context) {
	userID := c.Param("userId")

	var req UpdateUserPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	if err := h.permissionService.UpdateUserPermission(userID, req.AllowedLibraries, req.MaxRatingLevel, req.DailyTimeLimit); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新权限失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "权限已更新"})
}

// SetContentRatingRequest 设置内容分级请求
type SetContentRatingRequest struct {
	Level string `json:"level" binding:"required"` // G, PG, PG-13, R, NC-17
}

// SetContentRating 设置媒体内容分级
func (h *AdminHandler) SetContentRating(c *gin.Context) {
	mediaID := c.Param("mediaId")

	var req SetContentRatingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	if err := h.permissionService.SetContentRating(mediaID, req.Level); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "分级已设置"})
}

// GetContentRating 获取媒体内容分级
func (h *AdminHandler) GetContentRating(c *gin.Context) {
	mediaID := c.Param("mediaId")
	level, err := h.permissionService.GetContentRating(mediaID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"media_id": mediaID, "level": ""}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"media_id": mediaID, "level": level}})
}

// ==================== 访问日志 ====================

// ListAccessLogs 获取访问日志
func (h *AdminHandler) ListAccessLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "50"))
	userID := c.Query("user_id")
	action := c.Query("action")

	logs, total, err := h.permissionService.ListAccessLogs(page, size, userID, action)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取日志失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": logs, "total": total, "page": page, "size": size})
}

// ==================== 手动元数据匹配 ====================

// SearchMetadataRequest 搜索元数据请求
type SearchMetadataRequest struct {
	Query     string `json:"query" binding:"required"`
	Year      int    `json:"year"`
	MediaType string `json:"media_type"` // movie, tv
}

// SearchMetadata 手动搜索TMDb元数据
func (h *AdminHandler) SearchMetadata(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供搜索关键词"})
		return
	}
	mediaType := c.DefaultQuery("type", "movie")
	year, _ := strconv.Atoi(c.Query("year"))

	results, err := h.metadataService.SearchTMDb(mediaType, query, year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "搜索失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": results})
}

// MatchMetadataRequest 手动关联元数据请求
type MatchMetadataRequest struct {
	TMDbID int `json:"tmdb_id" binding:"required"`
}

// MatchMetadata 手动关联TMDb元数据到指定媒体
func (h *AdminHandler) MatchMetadata(c *gin.Context) {
	mediaID := c.Param("mediaId")

	var req MatchMetadataRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	if err := h.metadataService.MatchMediaWithTMDb(mediaID, req.TMDbID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "关联元数据失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "元数据已关联"})
}

// UnmatchMetadata 解除媒体的元数据匹配
func (h *AdminHandler) UnmatchMetadata(c *gin.Context) {
	mediaID := c.Param("mediaId")

	if err := h.metadataService.UnmatchMedia(mediaID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解除匹配失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已解除元数据匹配"})
}

// DeleteMedia 删除单个媒体记录（仅从数据库移除，不删除文件）
func (h *AdminHandler) DeleteMedia(c *gin.Context) {
	mediaID := c.Param("mediaId")

	if err := h.libraryService.DeleteMedia(mediaID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除影片失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "影片已删除"})
}

// UpdateMediaMetadataRequest 编辑元数据请求
type UpdateMediaMetadataRequest struct {
	Title     *string  `json:"title"`
	OrigTitle *string  `json:"orig_title"`
	Year      *int     `json:"year"`
	Overview  *string  `json:"overview"`
	Rating    *float64 `json:"rating"`
	Genres    *string  `json:"genres"`
	Country   *string  `json:"country"`
	Language  *string  `json:"language"`
	Tagline   *string  `json:"tagline"`
	Studio    *string  `json:"studio"`
}

// UpdateMediaMetadata 编辑媒体元数据
func (h *AdminHandler) UpdateMediaMetadata(c *gin.Context) {
	mediaID := c.Param("mediaId")

	var req UpdateMediaMetadataRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	media, err := h.libraryService.GetMediaByID(mediaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "影片不存在"})
		return
	}

	// 仅更新提供的字段
	if req.Title != nil {
		media.Title = *req.Title
	}
	if req.OrigTitle != nil {
		media.OrigTitle = *req.OrigTitle
	}
	if req.Year != nil {
		media.Year = *req.Year
	}
	if req.Overview != nil {
		media.Overview = *req.Overview
	}
	if req.Rating != nil {
		media.Rating = *req.Rating
	}
	if req.Genres != nil {
		media.Genres = *req.Genres
	}
	if req.Country != nil {
		media.Country = *req.Country
	}
	if req.Language != nil {
		media.Language = *req.Language
	}
	if req.Tagline != nil {
		media.Tagline = *req.Tagline
	}
	if req.Studio != nil {
		media.Studio = *req.Studio
	}

	if err := h.libraryService.UpdateMedia(media); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新元数据失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "元数据已更新", "data": media})
}

// ==================== 系统设置（全局） ====================

// 系统设置键名常量
const (
	SettingGPUTranscode   = "enable_gpu_transcode"
	SettingGPUFallbackCPU = "gpu_fallback_cpu"
	SettingMetadataPath   = "metadata_store_path"
	SettingPlayCachePath  = "play_cache_path"
	SettingDirectLink     = "enable_direct_link"
)

// GetSystemSettings 获取系统全局设置
func (h *AdminHandler) GetSystemSettings(c *gin.Context) {
	all, err := h.settingRepo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取系统设置失败"})
		return
	}

	// 返回带默认值的设置
	settings := gin.H{
		SettingGPUTranscode:   getBoolSetting(all, SettingGPUTranscode, true),
		SettingGPUFallbackCPU: getBoolSetting(all, SettingGPUFallbackCPU, true),
		SettingMetadataPath:   getStrSetting(all, SettingMetadataPath, ""),
		SettingPlayCachePath:  getStrSetting(all, SettingPlayCachePath, ""),
		SettingDirectLink:     getBoolSetting(all, SettingDirectLink, false),
	}

	c.JSON(http.StatusOK, gin.H{"data": settings})
}

// UpdateSystemSettingsRequest 更新系统设置请求
type UpdateSystemSettingsRequest struct {
	EnableGPUTranscode *bool   `json:"enable_gpu_transcode"`
	GPUFallbackCPU     *bool   `json:"gpu_fallback_cpu"`
	MetadataStorePath  *string `json:"metadata_store_path"`
	PlayCachePath      *string `json:"play_cache_path"`
	EnableDirectLink   *bool   `json:"enable_direct_link"`
}

// UpdateSystemSettings 更新系统全局设置
func (h *AdminHandler) UpdateSystemSettings(c *gin.Context) {
	var req UpdateSystemSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	kvs := make(map[string]string)
	if req.EnableGPUTranscode != nil {
		kvs[SettingGPUTranscode] = boolToStr(*req.EnableGPUTranscode)
	}
	if req.GPUFallbackCPU != nil {
		kvs[SettingGPUFallbackCPU] = boolToStr(*req.GPUFallbackCPU)
	}
	if req.MetadataStorePath != nil {
		kvs[SettingMetadataPath] = *req.MetadataStorePath
	}
	if req.PlayCachePath != nil {
		kvs[SettingPlayCachePath] = *req.PlayCachePath
	}
	if req.EnableDirectLink != nil {
		kvs[SettingDirectLink] = boolToStr(*req.EnableDirectLink)
	}

	if len(kvs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "未提供任何设置项"})
		return
	}

	if err := h.settingRepo.SetMulti(kvs); err != nil {
		h.logger.Errorf("更新系统设置失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存设置失败"})
		return
	}

	h.logger.Info("系统设置已更新")

	// 返回更新后的完整设置
	h.GetSystemSettings(c)
}

// 辅助函数
func getBoolSetting(m map[string]string, key string, defaultVal bool) bool {
	v, ok := m[key]
	if !ok {
		return defaultVal
	}
	return v == "true" || v == "1"
}

func getStrSetting(m map[string]string, key string, defaultVal string) string {
	v, ok := m[key]
	if !ok {
		return defaultVal
	}
	return v
}

func boolToStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

// ==================== 服务端文件浏览器 ====================

// BrowseFS 浏览服务器文件系统目录
func (h *AdminHandler) BrowseFS(c *gin.Context) {
	dir := c.DefaultQuery("path", "/")
	if dir == "" {
		dir = "/"
	}

	// 安全检查：清理路径
	dir = filepath.Clean(dir)

	entries, err := os.ReadDir(dir)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法读取目录: " + err.Error()})
		return
	}

	type FsEntry struct {
		Name  string `json:"name"`
		Path  string `json:"path"`
		IsDir bool   `json:"is_dir"`
	}

	var items []FsEntry
	for _, entry := range entries {
		// 只返回目录（文件浏览器只需要选择文件夹）
		if !entry.IsDir() {
			continue
		}
		// 跳过隐藏目录
		if entry.Name()[0] == '.' {
			continue
		}
		items = append(items, FsEntry{
			Name:  entry.Name(),
			Path:  filepath.Join(dir, entry.Name()),
			IsDir: true,
		})
	}

	// 计算父目录
	parent := filepath.Dir(dir)
	if parent == dir {
		parent = ""
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"current": dir,
			"parent":  parent,
			"items":   items,
		},
	})
}

// ==================== 剧集合集管理 ====================

// MatchSeriesMetadata 手动匹配剧集合集元数据
func (h *AdminHandler) MatchSeriesMetadata(c *gin.Context) {
	seriesID := c.Param("seriesId")

	var req struct {
		TMDbID int `json:"tmdb_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供 tmdb_id"})
		return
	}

	if err := h.metadataService.MatchSeriesWithTMDb(seriesID, req.TMDbID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "匹配失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "元数据已关联"})
}

// UnmatchSeriesMetadata 解除剧集合集的元数据匹配
func (h *AdminHandler) UnmatchSeriesMetadata(c *gin.Context) {
	seriesID := c.Param("seriesId")

	if err := h.metadataService.UnmatchSeries(seriesID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解除匹配失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已解除元数据匹配"})
}

// ScrapeSeriesMetadata 刷新剧集合集元数据
func (h *AdminHandler) ScrapeSeriesMetadata(c *gin.Context) {
	seriesID := c.Param("seriesId")

	if err := h.metadataService.ScrapeSeries(seriesID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "刷新元数据失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "元数据已刷新"})
}

// UpdateSeriesMetadataRequest 编辑剧集合集元数据请求
type UpdateSeriesMetadataRequest struct {
	Title     *string  `json:"title"`
	OrigTitle *string  `json:"orig_title"`
	Year      *int     `json:"year"`
	Overview  *string  `json:"overview"`
	Rating    *float64 `json:"rating"`
	Genres    *string  `json:"genres"`
	Country   *string  `json:"country"`
	Language  *string  `json:"language"`
	Studio    *string  `json:"studio"`
}

// UpdateSeriesMetadata 编辑剧集合集元数据
func (h *AdminHandler) UpdateSeriesMetadata(c *gin.Context) {
	seriesID := c.Param("seriesId")

	var req UpdateSeriesMetadataRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	series, err := h.libraryService.GetSeriesByID(seriesID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "剧集合集不存在"})
		return
	}

	if req.Title != nil {
		series.Title = *req.Title
	}
	if req.OrigTitle != nil {
		series.OrigTitle = *req.OrigTitle
	}
	if req.Year != nil {
		series.Year = *req.Year
	}
	if req.Overview != nil {
		series.Overview = *req.Overview
	}
	if req.Rating != nil {
		series.Rating = *req.Rating
	}
	if req.Genres != nil {
		series.Genres = *req.Genres
	}
	if req.Country != nil {
		series.Country = *req.Country
	}
	if req.Language != nil {
		series.Language = *req.Language
	}
	if req.Studio != nil {
		series.Studio = *req.Studio
	}

	if err := h.libraryService.UpdateSeries(series); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新元数据失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "元数据已更新", "data": series})
}

// DeleteSeries 删除剧集合集记录（仅从数据库移除，不删除文件）
func (h *AdminHandler) DeleteSeries(c *gin.Context) {
	seriesID := c.Param("seriesId")

	if err := h.libraryService.DeleteSeries(seriesID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除剧集失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "剧集已删除"})
}

// ==================== 图片管理 ====================

// SearchTMDbImages 获取TMDb条目的所有可用图片
func (h *AdminHandler) SearchTMDbImages(c *gin.Context) {
	mediaType := c.DefaultQuery("type", "movie") // movie 或 tv
	tmdbID, err := strconv.Atoi(c.Query("tmdb_id"))
	if err != nil || tmdbID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供有效的 tmdb_id"})
		return
	}

	result, err := h.metadataService.SearchTMDbImages(mediaType, tmdbID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取图片列表失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// UploadMediaImage 上传图片到指定Media
func (h *AdminHandler) UploadMediaImage(c *gin.Context) {
	mediaID := c.Param("mediaId")
	imageType := c.DefaultQuery("type", "poster") // poster 或 backdrop
	if imageType != "poster" && imageType != "backdrop" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type 必须为 poster 或 backdrop"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请上传图片文件"})
		return
	}

	// 检查文件大小（10MB）
	if file.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "图片文件过大，最大支持10MB"})
		return
	}

	// 检查文件格式
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true}
	if !allowedExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "仅支持 JPG、PNG、WebP 格式"})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取上传文件失败"})
		return
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取上传文件失败"})
		return
	}

	localPath, err := h.metadataService.SaveUploadedImageForMedia(mediaID, data, ext, imageType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存图片失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "图片已更新", "path": localPath})
}

// UploadSeriesImage 上传图片到指定Series
func (h *AdminHandler) UploadSeriesImage(c *gin.Context) {
	seriesID := c.Param("seriesId")
	imageType := c.DefaultQuery("type", "poster")
	if imageType != "poster" && imageType != "backdrop" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type 必须为 poster 或 backdrop"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请上传图片文件"})
		return
	}

	if file.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "图片文件过大，最大支持10MB"})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true}
	if !allowedExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "仅支持 JPG、PNG、WebP 格式"})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取上传文件失败"})
		return
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取上传文件失败"})
		return
	}

	localPath, err := h.metadataService.SaveUploadedImageForSeries(seriesID, data, ext, imageType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存图片失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "图片已更新", "path": localPath})
}

// SetMediaImageByURL 通过URL设置Media图片
func (h *AdminHandler) SetMediaImageByURL(c *gin.Context) {
	mediaID := c.Param("mediaId")

	var req struct {
		URL       string `json:"url" binding:"required"`
		ImageType string `json:"image_type"` // poster 或 backdrop
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供图片URL"})
		return
	}

	if req.ImageType == "" {
		req.ImageType = "poster"
	}
	if req.ImageType != "poster" && req.ImageType != "backdrop" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "image_type 必须为 poster 或 backdrop"})
		return
	}

	localPath, err := h.metadataService.DownloadURLImageForMedia(mediaID, req.URL, req.ImageType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "下载图片失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "图片已更新", "path": localPath})
}

// SetSeriesImageByURL 通过URL设置Series图片
func (h *AdminHandler) SetSeriesImageByURL(c *gin.Context) {
	seriesID := c.Param("seriesId")

	var req struct {
		URL       string `json:"url" binding:"required"`
		ImageType string `json:"image_type"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供图片URL"})
		return
	}

	if req.ImageType == "" {
		req.ImageType = "poster"
	}
	if req.ImageType != "poster" && req.ImageType != "backdrop" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "image_type 必须为 poster 或 backdrop"})
		return
	}

	localPath, err := h.metadataService.DownloadURLImageForSeries(seriesID, req.URL, req.ImageType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "下载图片失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "图片已更新", "path": localPath})
}

// SetMediaImageFromTMDb 从TMDb选择图片设置到Media
func (h *AdminHandler) SetMediaImageFromTMDb(c *gin.Context) {
	mediaID := c.Param("mediaId")

	var req struct {
		TMDbPath  string `json:"tmdb_path" binding:"required"` // TMDb图片路径，如 /abc123.jpg
		ImageType string `json:"image_type"`                   // poster 或 backdrop
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供 tmdb_path"})
		return
	}

	if req.ImageType == "" {
		req.ImageType = "poster"
	}

	localPath, err := h.metadataService.DownloadTMDbImageForMedia(mediaID, req.TMDbPath, req.ImageType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "下载图片失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "图片已更新", "path": localPath})
}

// SetSeriesImageFromTMDb 从TMDb选择图片设置到Series
func (h *AdminHandler) SetSeriesImageFromTMDb(c *gin.Context) {
	seriesID := c.Param("seriesId")

	var req struct {
		TMDbPath  string `json:"tmdb_path" binding:"required"`
		ImageType string `json:"image_type"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供 tmdb_path"})
		return
	}

	if req.ImageType == "" {
		req.ImageType = "poster"
	}

	localPath, err := h.metadataService.DownloadTMDbImageForSeries(seriesID, req.TMDbPath, req.ImageType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "下载图片失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "图片已更新", "path": localPath})
}

// ==================== Bangumi 数据源管理 ====================

// SearchBangumi 搜索 Bangumi 条目
func (h *AdminHandler) SearchBangumi(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供搜索关键词"})
		return
	}

	// type: 2=动画, 6=三次元(电视剧/电影)
	subjectType, _ := strconv.Atoi(c.DefaultQuery("type", "2"))
	if subjectType != 1 && subjectType != 2 && subjectType != 3 && subjectType != 4 && subjectType != 6 {
		subjectType = 2 // 默认动画
	}
	year, _ := strconv.Atoi(c.Query("year"))

	results, err := h.metadataService.SearchBangumi(query, subjectType, year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "搜索失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": results})
}

// GetBangumiSubject 获取 Bangumi 条目详情
func (h *AdminHandler) GetBangumiSubject(c *gin.Context) {
	subjectID, err := strconv.Atoi(c.Param("subjectId"))
	if err != nil || subjectID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供有效的 Bangumi 条目 ID"})
		return
	}

	subject, err := h.metadataService.GetBangumiSubjectDetail(subjectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取条目详情失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": subject})
}

// MatchMediaBangumi 手动关联 Bangumi 条目到媒体
func (h *AdminHandler) MatchMediaBangumi(c *gin.Context) {
	mediaID := c.Param("mediaId")

	var req struct {
		BangumiID int `json:"bangumi_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供 bangumi_id"})
		return
	}

	if err := h.metadataService.MatchMediaWithBangumi(mediaID, req.BangumiID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "关联 Bangumi 元数据失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已关联 Bangumi 元数据"})
}

// MatchSeriesBangumi 手动关联 Bangumi 条目到剧集合集
func (h *AdminHandler) MatchSeriesBangumi(c *gin.Context) {
	seriesID := c.Param("seriesId")

	var req struct {
		BangumiID int `json:"bangumi_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供 bangumi_id"})
		return
	}

	if err := h.metadataService.MatchSeriesWithBangumi(seriesID, req.BangumiID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "关联 Bangumi 元数据失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已关联 Bangumi 元数据"})
}

// GetBangumiConfig 获取 Bangumi 配置状态
func (h *AdminHandler) GetBangumiConfig(c *gin.Context) {
	token := h.cfg.Secrets.BangumiAccessToken
	configured := token != ""
	maskedToken := ""
	if configured {
		if len(token) <= 8 {
			maskedToken = strings.Repeat("*", len(token))
		} else {
			maskedToken = token[:4] + strings.Repeat("*", len(token)-8) + token[len(token)-4:]
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"configured":   configured,
			"masked_token": maskedToken,
		},
	})
}

// UpdateBangumiConfig 更新 Bangumi Access Token
func (h *AdminHandler) UpdateBangumiConfig(c *gin.Context) {
	var req struct {
		AccessToken string `json:"access_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供 Access Token"})
		return
	}

	h.cfg.Secrets.BangumiAccessToken = req.AccessToken
	h.logger.Info("Bangumi Access Token 已更新")

	c.JSON(http.StatusOK, gin.H{
		"message": "Bangumi Access Token 已保存",
		"data": gin.H{
			"configured": true,
		},
	})
}

// ClearBangumiConfig 清除 Bangumi Access Token
func (h *AdminHandler) ClearBangumiConfig(c *gin.Context) {
	h.cfg.Secrets.BangumiAccessToken = ""
	h.logger.Info("Bangumi Access Token 已清除")

	c.JSON(http.StatusOK, gin.H{
		"message": "Bangumi Access Token 已清除",
		"data": gin.H{
			"configured": false,
		},
	})
}
