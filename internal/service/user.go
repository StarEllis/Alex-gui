package service

import (
	cryptoRand "crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/nowen-video/nowen-video/internal/config"
	"github.com/nowen-video/nowen-video/internal/model"
	"github.com/nowen-video/nowen-video/internal/repository"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// UserService 用户服务
type UserService struct {
	repo   *repository.UserRepo
	cfg    *config.Config
	logger *zap.SugaredLogger
}

func NewUserService(repo *repository.UserRepo, cfg *config.Config, logger *zap.SugaredLogger) *UserService {
	return &UserService{repo: repo, cfg: cfg, logger: logger}
}

// generateSecurePassword 生成安全的随机密码（16字符十六进制）
func generateSecurePassword() (string, error) {
	b := make([]byte, 8)
	if _, err := cryptoRand.Read(b); err != nil {
		return "", fmt.Errorf("生成随机密码失败: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// defaultAdminPassword 默认管理员密码（与前端登录页提示一致）
const defaultAdminPassword = "admin123"

// EnsureAdminExists 确保管理员账号存在（首次启动时）
func (s *UserService) EnsureAdminExists() error {
	count, err := s.repo.Count()
	if err != nil {
		return err
	}
	if count > 0 {
		return nil // 已有用户，跳过
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(defaultAdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	admin := &model.User{
		Username: "admin",
		Password: string(hashedPassword),
		Role:     "admin",
	}

	if err := s.repo.Create(admin); err != nil {
		return err
	}

	s.logger.Infof("╔══════════════════════════════════════════════════╗")
	s.logger.Infof("║  首次启动 — 已创建默认管理员账号                    ║")
	s.logger.Infof("║  用户名: admin                                   ║")
	s.logger.Infof("║  密码:   admin123                                ║")
	s.logger.Infof("║  ⚠️  请立即登录并修改密码！                        ║")
	s.logger.Infof("╚══════════════════════════════════════════════════╝")
	return nil
}

// GetProfile 获取用户信息
func (s *UserService) GetProfile(userID string) (*model.User, error) {
	return s.repo.FindByID(userID)
}

// ListUsers 获取所有用户
func (s *UserService) ListUsers() ([]model.User, error) {
	return s.repo.List()
}

// DeleteUser 删除用户
func (s *UserService) DeleteUser(id string) error {
	return s.repo.Delete(id)
}
