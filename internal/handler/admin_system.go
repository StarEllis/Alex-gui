package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// ==================== 系统监控 ====================

// GetMetrics 获取实时系统指标
func (h *AdminHandler) GetMetrics(c *gin.Context) {
	metrics := h.monitorService.GetMetrics()
	c.JSON(http.StatusOK, gin.H{"data": metrics})
}

// ==================== 定时任务管理 ====================

// CreateScheduledTaskRequest 创建定时任务请求
type CreateScheduledTaskRequest struct {
	Name     string `json:"name" binding:"required"`
	Type     string `json:"type" binding:"required"`     // scan, scrape, cleanup
	Schedule string `json:"schedule" binding:"required"` // @daily, @every 6h等
	TargetID string `json:"target_id"`
}

// ListScheduledTasks 获取定时任务列表
func (h *AdminHandler) ListScheduledTasks(c *gin.Context) {
	tasks, err := h.schedulerService.ListTasks()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取任务列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tasks})
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
// 安全限制：仅允许浏览已配置的媒体库路径及常见根路径，防止任意目录遍历
func (h *AdminHandler) BrowseFS(c *gin.Context) {
	dir := c.DefaultQuery("path", "/")
	if dir == "" {
		dir = "/"
	}

	// 安全检查：清理路径，防止路径遍历攻击
	dir = filepath.Clean(dir)

	// 安全限制：检查请求路径是否在允许的范围内
	// 允许的路径：根路径（/）、常见挂载点、已配置的媒体库路径的父目录
	allowed := h.isAllowedBrowsePath(dir)
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权浏览该目录，仅允许浏览媒体库相关路径"})
		return
	}

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
		// 跳过隐藏目录和系统目录
		name := entry.Name()
		if name[0] == '.' {
			continue
		}
		// 跳过敏感系统目录
		if h.isSensitiveDir(name) {
			continue
		}
		items = append(items, FsEntry{
			Name:  name,
			Path:  filepath.Join(dir, name),
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

// isAllowedBrowsePath 检查路径是否在允许浏览的范围内
func (h *AdminHandler) isAllowedBrowsePath(dir string) bool {
	// 根路径始终允许（用于导航）
	if dir == "/" || dir == "\\" || dir == "." {
		return true
	}

	// Windows 盘符根路径允许（如 C:\, D:\）
	if len(dir) <= 3 && filepath.VolumeName(dir) != "" {
		return true
	}

	// 常见的安全挂载点/根路径允许
	safeRoots := []string{
		"/mnt", "/media", "/home", "/srv", "/data", "/nas", "/share", "/volume",
		"/opt", "/var/lib", "/storage",
	}
	for _, root := range safeRoots {
		if strings.HasPrefix(dir, root) {
			return true
		}
	}

	// 已配置的媒体库路径及其父目录允许
	libraries, err := h.libraryRepo.List()
	if err == nil {
		for _, lib := range libraries {
			libPath := filepath.Clean(lib.Path)
			// 允许媒体库路径本身及其子目录
			if strings.HasPrefix(dir, libPath) {
				return true
			}
			// 允许媒体库路径的父目录链（用于导航到媒体库）
			if strings.HasPrefix(libPath, dir) {
				return true
			}
		}
	}

	// 应用数据目录允许
	if h.cfg != nil {
		dataDir := filepath.Clean(h.cfg.App.DataDir)
		if strings.HasPrefix(dir, dataDir) || strings.HasPrefix(dataDir, dir) {
			return true
		}
	}

	return false
}

// isSensitiveDir 检查是否为敏感系统目录
func (h *AdminHandler) isSensitiveDir(name string) bool {
	sensitive := map[string]bool{
		"proc": true, "sys": true, "dev": true, "run": true,
		"boot": true, "sbin": true, "bin": true, "lib": true,
		"lib64": true, "lost+found": true, "snap": true,
		"System Volume Information": true, "$Recycle.Bin": true,
		"Windows": true, "Program Files": true, "Program Files (x86)": true,
		"ProgramData": true,
	}
	return sensitive[name]
}
