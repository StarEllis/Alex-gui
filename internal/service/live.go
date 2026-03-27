package service

import (
	"bufio"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/nowen-video/nowen-video/internal/config"
	"github.com/nowen-video/nowen-video/internal/model"
	"github.com/nowen-video/nowen-video/internal/repository"
	"go.uber.org/zap"
)

// LiveService 实时直播服务
type LiveService struct {
	cfg           *config.Config
	sourceRepo    *repository.LiveSourceRepo
	playlistRepo  *repository.LivePlaylistRepo
	recordingRepo *repository.LiveRecordingRepo
	logger        *zap.SugaredLogger
	wsHub         *WSHub

	// 录制管理
	recordings   map[string]*exec.Cmd // recordingID -> FFmpeg进程
	recordingsMu sync.Mutex
}

// NewLiveService 创建直播服务
func NewLiveService(
	cfg *config.Config,
	sourceRepo *repository.LiveSourceRepo,
	playlistRepo *repository.LivePlaylistRepo,
	recordingRepo *repository.LiveRecordingRepo,
	logger *zap.SugaredLogger,
) *LiveService {
	return &LiveService{
		cfg:           cfg,
		sourceRepo:    sourceRepo,
		playlistRepo:  playlistRepo,
		recordingRepo: recordingRepo,
		logger:        logger,
		recordings:    make(map[string]*exec.Cmd),
	}
}

func (s *LiveService) SetWSHub(hub *WSHub) {
	s.wsHub = hub
}

// ==================== 直播源管理 ====================

// AddSource 添加直播源
func (s *LiveService) AddSource(source *model.LiveSource) error {
	return s.sourceRepo.Create(source)
}

// UpdateSource 更新直播源
func (s *LiveService) UpdateSource(source *model.LiveSource) error {
	return s.sourceRepo.Update(source)
}

// DeleteSource 删除直播源
func (s *LiveService) DeleteSource(id string) error {
	return s.sourceRepo.Delete(id)
}

// GetSource 获取直播源详情
func (s *LiveService) GetSource(id string) (*model.LiveSource, error) {
	return s.sourceRepo.FindByID(id)
}

// ListSources 获取直播源列表
func (s *LiveService) ListSources(category string, page, size int) ([]model.LiveSource, int64, error) {
	return s.sourceRepo.List(category, page, size)
}

// ListSourcesAdmin 管理员获取直播源列表（包含禁用的）
func (s *LiveService) ListSourcesAdmin(category, keyword string, page, size int) ([]model.LiveSource, int64, error) {
	return s.sourceRepo.ListAdmin(category, keyword, page, size)
}

// ToggleSourceActive 切换直播源启用/禁用状态
func (s *LiveService) ToggleSourceActive(id string) (*model.LiveSource, error) {
	source, err := s.sourceRepo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("直播源不存在")
	}
	source.IsActive = !source.IsActive
	if err := s.sourceRepo.Update(source); err != nil {
		return nil, err
	}
	return source, nil
}

// GetCategories 获取所有直播分类
func (s *LiveService) GetCategories() ([]string, error) {
	return s.sourceRepo.GetCategories()
}

// CheckSource 检测直播源是否可用
func (s *LiveService) CheckSource(id string) (string, error) {
	source, err := s.sourceRepo.FindByID(id)
	if err != nil {
		return "error", fmt.Errorf("直播源不存在")
	}

	// 使用HTTP HEAD请求检测
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Head(source.URL)
	if err != nil {
		source.CheckStatus = "timeout"
		now := time.Now()
		source.LastCheckAt = &now
		s.sourceRepo.Update(source)
		return "timeout", nil
	}
	defer resp.Body.Close()

	status := "ok"
	if resp.StatusCode >= 400 {
		status = "error"
	}

	source.CheckStatus = status
	now := time.Now()
	source.LastCheckAt = &now
	s.sourceRepo.Update(source)

	return status, nil
}

// BatchCheckSources 批量检测直播源
func (s *LiveService) BatchCheckSources() (map[string]string, error) {
	sources, err := s.sourceRepo.ListAll()
	if err != nil {
		return nil, err
	}

	results := make(map[string]string)
	for _, source := range sources {
		status, _ := s.CheckSource(source.ID)
		results[source.ID] = status
	}

	return results, nil
}

// ==================== M3U 播放列表导入 ====================

// ImportM3U 导入M3U播放列表
func (s *LiveService) ImportM3U(name, url, filePath string) (*model.LivePlaylist, int, error) {
	playlist := &model.LivePlaylist{
		Name:     name,
		URL:      url,
		FilePath: filePath,
	}

	var content string
	var err error

	if url != "" {
		// 从URL下载
		content, err = s.downloadM3U(url)
		if err != nil {
			return nil, 0, fmt.Errorf("下载M3U失败: %w", err)
		}
	} else if filePath != "" {
		// 从本地文件读取
		data, err := os.ReadFile(filePath)
		if err != nil {
			return nil, 0, fmt.Errorf("读取M3U文件失败: %w", err)
		}
		content = string(data)
	} else {
		return nil, 0, fmt.Errorf("请提供URL或文件路径")
	}

	// 解析M3U
	sources, err := s.parseM3U(content)
	if err != nil {
		return nil, 0, fmt.Errorf("解析M3U失败: %w", err)
	}

	playlist.SourceCount = len(sources)
	if err := s.playlistRepo.Create(playlist); err != nil {
		return nil, 0, err
	}

	// 批量创建直播源
	if len(sources) > 0 {
		if err := s.sourceRepo.BatchCreate(sources); err != nil {
			s.logger.Warnf("批量创建直播源失败: %v", err)
		}
	}

	s.logger.Infof("导入M3U播放列表 %s，共 %d 个频道", name, len(sources))
	return playlist, len(sources), nil
}

// downloadM3U 下载M3U文件
func (s *LiveService) downloadM3U(url string) (string, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var sb strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024) // 1MB buffer
	for scanner.Scan() {
		sb.WriteString(scanner.Text())
		sb.WriteString("\n")
	}
	return sb.String(), scanner.Err()
}

// parseM3U 解析M3U格式
func (s *LiveService) parseM3U(content string) ([]model.LiveSource, error) {
	var sources []model.LiveSource
	lines := strings.Split(content, "\n")

	var currentName, currentLogo, currentCategory string
	sortOrder := 0

	for _, line := range lines {
		line = strings.TrimSpace(line)

		if strings.HasPrefix(line, "#EXTINF:") {
			// 解析频道信息
			info := line[len("#EXTINF:"):]

			// 提取tvg-name
			if idx := strings.Index(info, "tvg-name=\""); idx >= 0 {
				end := strings.Index(info[idx+10:], "\"")
				if end >= 0 {
					currentName = info[idx+10 : idx+10+end]
				}
			}

			// 提取tvg-logo
			if idx := strings.Index(info, "tvg-logo=\""); idx >= 0 {
				end := strings.Index(info[idx+10:], "\"")
				if end >= 0 {
					currentLogo = info[idx+10 : idx+10+end]
				}
			}

			// 提取group-title
			if idx := strings.Index(info, "group-title=\""); idx >= 0 {
				end := strings.Index(info[idx+13:], "\"")
				if end >= 0 {
					currentCategory = info[idx+13 : idx+13+end]
				}
			}

			// 如果没有tvg-name，使用逗号后的名称
			if currentName == "" {
				parts := strings.SplitN(info, ",", 2)
				if len(parts) >= 2 {
					currentName = strings.TrimSpace(parts[1])
				}
			}

		} else if line != "" && !strings.HasPrefix(line, "#") {
			// URL行
			if currentName != "" {
				sortOrder++
				sources = append(sources, model.LiveSource{
					Name:      currentName,
					URL:       line,
					Type:      "iptv",
					Category:  currentCategory,
					Logo:      currentLogo,
					IsActive:  true,
					SortOrder: sortOrder,
				})
			}
			// 重置
			currentName = ""
			currentLogo = ""
			currentCategory = ""
		}
	}

	return sources, nil
}

// ListPlaylists 获取播放列表
func (s *LiveService) ListPlaylists() ([]model.LivePlaylist, error) {
	return s.playlistRepo.List()
}

// DeletePlaylist 删除播放列表
func (s *LiveService) DeletePlaylist(id string) error {
	return s.playlistRepo.Delete(id)
}

// ==================== 直播录制 ====================

// StartRecording 开始录制直播
func (s *LiveService) StartRecording(userID, sourceID, title string) (*model.LiveRecording, error) {
	source, err := s.sourceRepo.FindByID(sourceID)
	if err != nil {
		return nil, fmt.Errorf("直播源不存在")
	}

	// 创建录制目录
	recordDir := filepath.Join(s.cfg.App.DataDir, "recordings")
	os.MkdirAll(recordDir, 0755)

	fileName := fmt.Sprintf("%s_%s.ts", title, time.Now().Format("20060102_150405"))
	filePath := filepath.Join(recordDir, fileName)

	recording := &model.LiveRecording{
		SourceID:  sourceID,
		UserID:    userID,
		Title:     title,
		FilePath:  filePath,
		Status:    "recording",
		StartedAt: time.Now(),
	}

	if err := s.recordingRepo.Create(recording); err != nil {
		return nil, err
	}

	// 启动FFmpeg录制
	args := []string{
		"-i", source.URL,
		"-c", "copy",
		"-y",
		filePath,
	}

	cmd := exec.Command(s.cfg.App.FFmpegPath, args...)
	if err := cmd.Start(); err != nil {
		recording.Status = "failed"
		recording.FilePath = ""
		s.recordingRepo.Update(recording)
		return nil, fmt.Errorf("启动录制失败: %w", err)
	}

	s.recordingsMu.Lock()
	s.recordings[recording.ID] = cmd
	s.recordingsMu.Unlock()

	// 异步等待录制结束
	go func() {
		cmd.Wait()
		s.recordingsMu.Lock()
		delete(s.recordings, recording.ID)
		s.recordingsMu.Unlock()

		// 更新录制状态
		now := time.Now()
		recording.Status = "completed"
		recording.StoppedAt = &now
		recording.Duration = now.Sub(recording.StartedAt).Seconds()

		// 获取文件大小
		if info, err := os.Stat(filePath); err == nil {
			recording.FileSize = info.Size()
		}

		s.recordingRepo.Update(recording)
		s.logger.Infof("录制完成: %s", title)
	}()

	s.logger.Infof("开始录制: %s (源: %s)", title, source.Name)
	return recording, nil
}

// StopRecording 停止录制
func (s *LiveService) StopRecording(recordingID string) error {
	s.recordingsMu.Lock()
	cmd, ok := s.recordings[recordingID]
	s.recordingsMu.Unlock()

	if !ok {
		return fmt.Errorf("录制任务不存在或已结束")
	}

	// 发送中断信号
	if cmd.Process != nil {
		cmd.Process.Kill()
	}

	return nil
}

// ListRecordings 获取录制列表
func (s *LiveService) ListRecordings(userID string, page, size int) ([]model.LiveRecording, int64, error) {
	return s.recordingRepo.ListByUserID(userID, page, size)
}

// DeleteRecording 删除录制
func (s *LiveService) DeleteRecording(id string) error {
	recording, err := s.recordingRepo.FindByID(id)
	if err != nil {
		return err
	}

	// 删除文件
	if recording.FilePath != "" {
		os.Remove(recording.FilePath)
	}

	return s.recordingRepo.Delete(id)
}

// GetRecordingStatus 获取正在录制的任务状态
func (s *LiveService) GetRecordingStatus() []string {
	s.recordingsMu.Lock()
	defer s.recordingsMu.Unlock()

	var ids []string
	for id := range s.recordings {
		ids = append(ids, id)
	}
	return ids
}
