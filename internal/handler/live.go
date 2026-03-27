package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nowen-video/nowen-video/internal/model"
	"github.com/nowen-video/nowen-video/internal/service"
	"go.uber.org/zap"
)

// LiveHandler 直播处理器
type LiveHandler struct {
	liveService *service.LiveService
	logger      *zap.SugaredLogger
}

// ==================== 直播源管理 ====================

// AddSourceRequest 添加直播源请求
type AddSourceRequest struct {
	Name     string `json:"name" binding:"required"`
	URL      string `json:"url" binding:"required"`
	Type     string `json:"type"`
	Category string `json:"category"`
	Logo     string `json:"logo"`
	Quality  string `json:"quality"`
}

// AddSource 添加直播源
func (h *LiveHandler) AddSource(c *gin.Context) {
	var req AddSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	source := &model.LiveSource{
		Name:     req.Name,
		URL:      req.URL,
		Type:     req.Type,
		Category: req.Category,
		Logo:     req.Logo,
		Quality:  req.Quality,
		IsActive: true,
	}

	if source.Type == "" {
		source.Type = "iptv"
	}

	if err := h.liveService.AddSource(source); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "添加直播源失败"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": source})
}

// UpdateSource 更新直播源
func (h *LiveHandler) UpdateSource(c *gin.Context) {
	id := c.Param("id")

	source, err := h.liveService.GetSource(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "直播源不存在"})
		return
	}

	if err := c.ShouldBindJSON(source); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	if err := h.liveService.UpdateSource(source); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新直播源失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": source})
}

// DeleteSource 删除直播源
func (h *LiveHandler) DeleteSource(c *gin.Context) {
	id := c.Param("id")

	if err := h.liveService.DeleteSource(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除直播源失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已删除"})
}

// GetSource 获取直播源详情
func (h *LiveHandler) GetSource(c *gin.Context) {
	id := c.Param("id")

	source, err := h.liveService.GetSource(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "直播源不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": source})
}

// ListSources 获取直播源列表
func (h *LiveHandler) ListSources(c *gin.Context) {
	category := c.Query("category")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "50"))

	sources, total, err := h.liveService.ListSources(category, page, size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取直播源列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": sources, "total": total, "page": page, "size": size})
}

// GetCategories 获取直播分类
func (h *LiveHandler) GetCategories(c *gin.Context) {
	categories, err := h.liveService.GetCategories()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取分类失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": categories})
}

// ListSourcesAdmin 管理员获取直播源列表（包含禁用的）
func (h *LiveHandler) ListSourcesAdmin(c *gin.Context) {
	category := c.Query("category")
	keyword := c.Query("keyword")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "50"))

	sources, total, err := h.liveService.ListSourcesAdmin(category, keyword, page, size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取直播源列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": sources, "total": total, "page": page, "size": size})
}

// ToggleSourceActive 切换直播源启用/禁用状态
func (h *LiveHandler) ToggleSourceActive(c *gin.Context) {
	id := c.Param("id")

	source, err := h.liveService.ToggleSourceActive(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": source})
}

// CheckSource 检测直播源
func (h *LiveHandler) CheckSource(c *gin.Context) {
	id := c.Param("id")

	status, err := h.liveService.CheckSource(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": status})
}

// BatchCheck 批量检测直播源
func (h *LiveHandler) BatchCheck(c *gin.Context) {
	results, err := h.liveService.BatchCheckSources()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "批量检测失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": results})
}

// ==================== M3U 播放列表 ====================

// ImportM3URequest 导入M3U请求
type ImportM3URequest struct {
	Name     string `json:"name" binding:"required"`
	URL      string `json:"url"`
	FilePath string `json:"file_path"`
}

// ImportM3U 导入M3U播放列表
func (h *LiveHandler) ImportM3U(c *gin.Context) {
	var req ImportM3URequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	playlist, count, err := h.liveService.ImportM3U(req.Name, req.URL, req.FilePath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data":    playlist,
		"count":   count,
		"message": "导入成功",
	})
}

// ListPlaylists 获取播放列表
func (h *LiveHandler) ListPlaylists(c *gin.Context) {
	playlists, err := h.liveService.ListPlaylists()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取播放列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": playlists})
}

// DeletePlaylist 删除播放列表
func (h *LiveHandler) DeletePlaylist(c *gin.Context) {
	id := c.Param("id")

	if err := h.liveService.DeletePlaylist(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除播放列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已删除"})
}

// ==================== 直播录制 ====================

// StartRecordingRequest 开始录制请求
type StartRecordingRequest struct {
	SourceID string `json:"source_id" binding:"required"`
	Title    string `json:"title" binding:"required"`
}

// StartRecording 开始录制
func (h *LiveHandler) StartRecording(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req StartRecordingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	recording, err := h.liveService.StartRecording(userID.(string), req.SourceID, req.Title)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "启动录制失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": recording, "message": "录制已开始"})
}

// StopRecording 停止录制
func (h *LiveHandler) StopRecording(c *gin.Context) {
	id := c.Param("id")

	if err := h.liveService.StopRecording(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "录制已停止"})
}

// ListRecordings 获取录制列表
func (h *LiveHandler) ListRecordings(c *gin.Context) {
	userID, _ := c.Get("user_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	recordings, total, err := h.liveService.ListRecordings(userID.(string), page, size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取录制列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": recordings, "total": total, "page": page, "size": size})
}

// DeleteRecording 删除录制
func (h *LiveHandler) DeleteRecording(c *gin.Context) {
	id := c.Param("id")

	if err := h.liveService.DeleteRecording(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除录制失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已删除"})
}
