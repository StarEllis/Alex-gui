package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nowen-video/nowen-video/internal/service"
	"go.uber.org/zap"
)

// FamilySocialHandler 家庭社交互动处理器
type FamilySocialHandler struct {
	socialService *service.FamilySocialService
	logger        *zap.SugaredLogger
}

// ==================== 家庭组管理 ====================

// CreateGroupRequest 创建家庭组请求
type CreateGroupRequest struct {
	Name string `json:"name" binding:"required"`
}

// CreateGroup 创建家庭组
func (h *FamilySocialHandler) CreateGroup(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req CreateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	group, err := h.socialService.CreateGroup(userID.(string), req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建家庭组失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": group})
}

// JoinGroupRequest 加入家庭组请求
type JoinGroupRequest struct {
	InviteCode string `json:"invite_code" binding:"required"`
}

// JoinGroup 加入家庭组
func (h *FamilySocialHandler) JoinGroup(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req JoinGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	group, err := h.socialService.JoinGroup(userID.(string), req.InviteCode)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": group, "message": "已加入家庭组"})
}

// LeaveGroup 离开家庭组
func (h *FamilySocialHandler) LeaveGroup(c *gin.Context) {
	userID, _ := c.Get("user_id")
	groupID := c.Param("groupId")

	if err := h.socialService.LeaveGroup(userID.(string), groupID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已离开家庭组"})
}

// GetGroup 获取家庭组详情
func (h *FamilySocialHandler) GetGroup(c *gin.Context) {
	groupID := c.Param("groupId")

	group, err := h.socialService.GetGroup(groupID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "家庭组不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": group})
}

// ListGroups 获取用户的家庭组列表
func (h *FamilySocialHandler) ListGroups(c *gin.Context) {
	userID, _ := c.Get("user_id")

	groups, err := h.socialService.ListUserGroups(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取家庭组失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": groups})
}

// DeleteGroup 解散家庭组
func (h *FamilySocialHandler) DeleteGroup(c *gin.Context) {
	userID, _ := c.Get("user_id")
	groupID := c.Param("groupId")

	if err := h.socialService.DeleteGroup(userID.(string), groupID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "家庭组已解散"})
}

// RegenerateInviteCode 重新生成邀请码
func (h *FamilySocialHandler) RegenerateInviteCode(c *gin.Context) {
	userID, _ := c.Get("user_id")
	groupID := c.Param("groupId")

	code, err := h.socialService.RegenerateInviteCode(userID.(string), groupID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"invite_code": code})
}

// ==================== 分享功能 ====================

// ShareMediaRequest 分享媒体请求
type ShareMediaRequest struct {
	MediaID  string `json:"media_id"`
	SeriesID string `json:"series_id"`
	Message  string `json:"message"`
}

// ShareMedia 分享媒体到家庭组
func (h *FamilySocialHandler) ShareMedia(c *gin.Context) {
	userID, _ := c.Get("user_id")
	groupID := c.Param("groupId")

	var req ShareMediaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	share, err := h.socialService.ShareMedia(userID.(string), groupID, req.MediaID, req.SeriesID, req.Message)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": share})
}

// ListGroupShares 获取家庭组分享列表
func (h *FamilySocialHandler) ListGroupShares(c *gin.Context) {
	groupID := c.Param("groupId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	shares, total, err := h.socialService.ListGroupShares(groupID, page, size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取分享列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": shares, "total": total, "page": page, "size": size})
}

// ==================== 点赞功能 ====================

// LikeMedia 点赞媒体
func (h *FamilySocialHandler) LikeMedia(c *gin.Context) {
	userID, _ := c.Get("user_id")
	mediaID := c.Param("id")

	if err := h.socialService.LikeMedia(userID.(string), mediaID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已点赞"})
}

// UnlikeMedia 取消点赞
func (h *FamilySocialHandler) UnlikeMedia(c *gin.Context) {
	userID, _ := c.Get("user_id")
	mediaID := c.Param("id")

	if err := h.socialService.UnlikeMedia(userID.(string), mediaID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "取消点赞失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已取消点赞"})
}

// GetLikeStatus 获取点赞状态
func (h *FamilySocialHandler) GetLikeStatus(c *gin.Context) {
	userID, _ := c.Get("user_id")
	mediaID := c.Param("id")

	isLiked := h.socialService.IsLiked(userID.(string), mediaID)
	count, _ := h.socialService.GetLikeCount(mediaID)

	c.JSON(http.StatusOK, gin.H{"is_liked": isLiked, "count": count})
}

// ==================== 推荐功能 ====================

// RecommendMediaRequest 推荐媒体请求
type RecommendMediaRequest struct {
	ToUserID string `json:"to_user_id" binding:"required"`
	MediaID  string `json:"media_id"`
	SeriesID string `json:"series_id"`
	Message  string `json:"message"`
}

// RecommendMedia 推荐媒体给家庭成员
func (h *FamilySocialHandler) RecommendMedia(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req RecommendMediaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数无效"})
		return
	}

	rec, err := h.socialService.RecommendMedia(userID.(string), req.ToUserID, req.MediaID, req.SeriesID, req.Message)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "推荐失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": rec})
}

// ListRecommendations 获取收到的推荐列表
func (h *FamilySocialHandler) ListRecommendations(c *gin.Context) {
	userID, _ := c.Get("user_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	recs, total, err := h.socialService.ListRecommendations(userID.(string), page, size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取推荐列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": recs, "total": total, "page": page, "size": size})
}

// MarkRecommendationRead 标记推荐为已读
func (h *FamilySocialHandler) MarkRecommendationRead(c *gin.Context) {
	recID := c.Param("recId")

	if err := h.socialService.MarkRecommendationRead(recID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "标记已读失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已标记为已读"})
}

// GetUnreadCount 获取未读推荐数
func (h *FamilySocialHandler) GetUnreadCount(c *gin.Context) {
	userID, _ := c.Get("user_id")

	count, err := h.socialService.GetUnreadCount(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取未读数失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"count": count})
}
