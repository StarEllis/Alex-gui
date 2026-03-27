package service

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/nowen-video/nowen-video/internal/model"
	"github.com/nowen-video/nowen-video/internal/repository"
	"go.uber.org/zap"
)

// FamilySocialService 家庭社交互动服务
type FamilySocialService struct {
	groupRepo  *repository.FamilyGroupRepo
	memberRepo *repository.FamilyMemberRepo
	shareRepo  *repository.MediaShareRepo
	likeRepo   *repository.MediaLikeRepo
	recRepo    *repository.MediaRecommendationRepo
	mediaRepo  *repository.MediaRepo
	seriesRepo *repository.SeriesRepo
	logger     *zap.SugaredLogger
	wsHub      *WSHub
}

// NewFamilySocialService 创建家庭社交服务
func NewFamilySocialService(
	groupRepo *repository.FamilyGroupRepo,
	memberRepo *repository.FamilyMemberRepo,
	shareRepo *repository.MediaShareRepo,
	likeRepo *repository.MediaLikeRepo,
	recRepo *repository.MediaRecommendationRepo,
	mediaRepo *repository.MediaRepo,
	seriesRepo *repository.SeriesRepo,
	logger *zap.SugaredLogger,
) *FamilySocialService {
	return &FamilySocialService{
		groupRepo:  groupRepo,
		memberRepo: memberRepo,
		shareRepo:  shareRepo,
		likeRepo:   likeRepo,
		recRepo:    recRepo,
		mediaRepo:  mediaRepo,
		seriesRepo: seriesRepo,
		logger:     logger,
	}
}

func (s *FamilySocialService) SetWSHub(hub *WSHub) {
	s.wsHub = hub
}

// ==================== 家庭组管理 ====================

// CreateGroup 创建家庭组
func (s *FamilySocialService) CreateGroup(ownerID, name string) (*model.FamilyGroup, error) {
	// 生成邀请码
	inviteCode, err := generateInviteCode()
	if err != nil {
		return nil, fmt.Errorf("生成邀请码失败: %w", err)
	}

	group := &model.FamilyGroup{
		Name:       name,
		OwnerID:    ownerID,
		InviteCode: inviteCode,
		MaxMembers: 10,
	}

	if err := s.groupRepo.Create(group); err != nil {
		return nil, err
	}

	// 将创建者添加为成员
	member := &model.FamilyMember{
		GroupID:  group.ID,
		UserID:   ownerID,
		Role:     "owner",
		JoinedAt: time.Now(),
	}
	if err := s.memberRepo.Create(member); err != nil {
		return nil, err
	}

	s.logger.Infof("用户 %s 创建家庭组: %s", ownerID, name)
	return group, nil
}

// JoinGroup 通过邀请码加入家庭组
func (s *FamilySocialService) JoinGroup(userID, inviteCode string) (*model.FamilyGroup, error) {
	group, err := s.groupRepo.FindByInviteCode(inviteCode)
	if err != nil {
		return nil, fmt.Errorf("无效的邀请码")
	}

	// 检查是否已是成员
	if _, err := s.memberRepo.FindByGroupAndUser(group.ID, userID); err == nil {
		return nil, fmt.Errorf("你已经是该家庭组的成员")
	}

	// 检查成员数量限制
	count, _ := s.memberRepo.CountByGroup(group.ID)
	if int(count) >= group.MaxMembers {
		return nil, fmt.Errorf("家庭组成员已满")
	}

	member := &model.FamilyMember{
		GroupID:  group.ID,
		UserID:   userID,
		Role:     "member",
		JoinedAt: time.Now(),
	}
	if err := s.memberRepo.Create(member); err != nil {
		return nil, err
	}

	// 通知家庭组成员
	if s.wsHub != nil {
		s.wsHub.BroadcastEvent("family_member_joined", map[string]interface{}{
			"group_id": group.ID,
			"user_id":  userID,
		})
	}

	s.logger.Infof("用户 %s 加入家庭组 %s", userID, group.Name)
	return group, nil
}

// LeaveGroup 离开家庭组
func (s *FamilySocialService) LeaveGroup(userID, groupID string) error {
	member, err := s.memberRepo.FindByGroupAndUser(groupID, userID)
	if err != nil {
		return fmt.Errorf("你不是该家庭组的成员")
	}

	if member.Role == "owner" {
		return fmt.Errorf("家庭组创建者不能离开，请先转让或解散")
	}

	return s.memberRepo.Delete(member.ID)
}

// GetGroup 获取家庭组详情
func (s *FamilySocialService) GetGroup(groupID string) (*model.FamilyGroup, error) {
	return s.groupRepo.FindByID(groupID)
}

// ListUserGroups 获取用户所在的所有家庭组
func (s *FamilySocialService) ListUserGroups(userID string) ([]model.FamilyGroup, error) {
	return s.groupRepo.ListByUserID(userID)
}

// DeleteGroup 解散家庭组（仅创建者可操作）
func (s *FamilySocialService) DeleteGroup(userID, groupID string) error {
	group, err := s.groupRepo.FindByID(groupID)
	if err != nil {
		return fmt.Errorf("家庭组不存在")
	}

	if group.OwnerID != userID {
		return ErrForbidden
	}

	return s.groupRepo.Delete(groupID)
}

// RegenerateInviteCode 重新生成邀请码
func (s *FamilySocialService) RegenerateInviteCode(userID, groupID string) (string, error) {
	group, err := s.groupRepo.FindByID(groupID)
	if err != nil {
		return "", fmt.Errorf("家庭组不存在")
	}

	if group.OwnerID != userID {
		return "", ErrForbidden
	}

	newCode, err := generateInviteCode()
	if err != nil {
		return "", err
	}

	group.InviteCode = newCode
	if err := s.groupRepo.Update(group); err != nil {
		return "", err
	}

	return newCode, nil
}

// ==================== 分享功能 ====================

// ShareMedia 分享媒体到家庭组
func (s *FamilySocialService) ShareMedia(userID, groupID, mediaID, seriesID, message string) (*model.MediaShare, error) {
	// 验证用户是家庭组成员
	if _, err := s.memberRepo.FindByGroupAndUser(groupID, userID); err != nil {
		return nil, fmt.Errorf("你不是该家庭组的成员")
	}

	share := &model.MediaShare{
		UserID:   userID,
		GroupID:  groupID,
		MediaID:  mediaID,
		SeriesID: seriesID,
		Message:  message,
	}

	if err := s.shareRepo.Create(share); err != nil {
		return nil, err
	}

	// 通知家庭组成员
	if s.wsHub != nil {
		s.wsHub.BroadcastEvent("media_shared", map[string]interface{}{
			"group_id":  groupID,
			"user_id":   userID,
			"media_id":  mediaID,
			"series_id": seriesID,
		})
	}

	return share, nil
}

// ListGroupShares 获取家庭组的分享列表
func (s *FamilySocialService) ListGroupShares(groupID string, page, size int) ([]model.MediaShare, int64, error) {
	return s.shareRepo.ListByGroupID(groupID, page, size)
}

// ==================== 点赞功能 ====================

// LikeMedia 点赞媒体
func (s *FamilySocialService) LikeMedia(userID, mediaID string) error {
	if s.likeRepo.Exists(userID, mediaID) {
		return fmt.Errorf("已经点赞过了")
	}

	like := &model.MediaLike{
		UserID:  userID,
		MediaID: mediaID,
	}
	return s.likeRepo.Create(like)
}

// UnlikeMedia 取消点赞
func (s *FamilySocialService) UnlikeMedia(userID, mediaID string) error {
	return s.likeRepo.Delete(userID, mediaID)
}

// IsLiked 检查是否已点赞
func (s *FamilySocialService) IsLiked(userID, mediaID string) bool {
	return s.likeRepo.Exists(userID, mediaID)
}

// GetLikeCount 获取点赞数
func (s *FamilySocialService) GetLikeCount(mediaID string) (int64, error) {
	return s.likeRepo.CountByMedia(mediaID)
}

// ==================== 推荐功能 ====================

// RecommendMedia 向家庭成员推荐媒体
func (s *FamilySocialService) RecommendMedia(fromUserID, toUserID, mediaID, seriesID, message string) (*model.MediaRecommendation, error) {
	rec := &model.MediaRecommendation{
		FromUserID: fromUserID,
		ToUserID:   toUserID,
		MediaID:    mediaID,
		SeriesID:   seriesID,
		Message:    message,
	}

	if err := s.recRepo.Create(rec); err != nil {
		return nil, err
	}

	// 通知被推荐者
	if s.wsHub != nil {
		s.wsHub.BroadcastEvent("media_recommended", map[string]interface{}{
			"from_user_id": fromUserID,
			"to_user_id":   toUserID,
			"media_id":     mediaID,
			"series_id":    seriesID,
		})
	}

	return rec, nil
}

// ListRecommendations 获取收到的推荐列表
func (s *FamilySocialService) ListRecommendations(userID string, page, size int) ([]model.MediaRecommendation, int64, error) {
	return s.recRepo.ListByToUser(userID, page, size)
}

// MarkRecommendationRead 标记推荐为已读
func (s *FamilySocialService) MarkRecommendationRead(recID string) error {
	return s.recRepo.MarkAsRead(recID)
}

// GetUnreadCount 获取未读推荐数
func (s *FamilySocialService) GetUnreadCount(userID string) (int64, error) {
	return s.recRepo.CountUnread(userID)
}

// ==================== 辅助函数 ====================

func generateInviteCode() (string, error) {
	bytes := make([]byte, 4)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
