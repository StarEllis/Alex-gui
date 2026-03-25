package service

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/nowen-video/nowen-video/internal/config"
	"github.com/nowen-video/nowen-video/internal/model"
	"github.com/nowen-video/nowen-video/internal/repository"
	"go.uber.org/zap"
)

// BackupService 数据备份与恢复服务
type BackupService struct {
	mediaRepo  *repository.MediaRepo
	seriesRepo *repository.SeriesRepo
	libRepo    *repository.LibraryRepo
	personRepo *repository.PersonRepo
	mpRepo     *repository.MediaPersonRepo
	cfg        *config.Config
	logger     *zap.SugaredLogger
}

func NewBackupService(
	mediaRepo *repository.MediaRepo,
	seriesRepo *repository.SeriesRepo,
	libRepo *repository.LibraryRepo,
	personRepo *repository.PersonRepo,
	mpRepo *repository.MediaPersonRepo,
	cfg *config.Config,
	logger *zap.SugaredLogger,
) *BackupService {
	return &BackupService{
		mediaRepo:  mediaRepo,
		seriesRepo: seriesRepo,
		libRepo:    libRepo,
		personRepo: personRepo,
		mpRepo:     mpRepo,
		cfg:        cfg,
		logger:     logger,
	}
}

// BackupData 备份数据结构
type BackupData struct {
	Version   string              `json:"version"`
	CreatedAt time.Time           `json:"created_at"`
	Libraries []model.Library     `json:"libraries"`
	Media     []model.Media       `json:"media"`
	Series    []model.Series      `json:"series"`
	People    []model.Person      `json:"people"`
	MediaCast []model.MediaPerson `json:"media_cast"`
}

// ExportJSON 导出所有元数据为 JSON 文件
func (s *BackupService) ExportJSON() (string, error) {
	libs, _ := s.libRepo.List()
	var allMedia []model.Media
	var allSeries []model.Series

	for _, lib := range libs {
		media, _ := s.mediaRepo.ListByLibraryID(lib.ID)
		allMedia = append(allMedia, media...)
		series, _ := s.seriesRepo.ListByLibraryID(lib.ID)
		allSeries = append(allSeries, series...)
	}

	data := BackupData{
		Version:   "1.0",
		CreatedAt: time.Now(),
		Libraries: libs,
		Media:     allMedia,
		Series:    allSeries,
	}

	// 创建导出目录
	exportDir := filepath.Join(s.cfg.Cache.CacheDir, "exports")
	os.MkdirAll(exportDir, 0755)

	filename := fmt.Sprintf("nowen-video-backup-%s.json", time.Now().Format("20060102-150405"))
	filePath := filepath.Join(exportDir, filename)

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return "", fmt.Errorf("序列化备份数据失败: %w", err)
	}

	if err := os.WriteFile(filePath, jsonData, 0644); err != nil {
		return "", fmt.Errorf("写入备份文件失败: %w", err)
	}

	s.logger.Infof("数据备份完成: %s (%d 个媒体库, %d 个媒体, %d 个合集)",
		filePath, len(libs), len(allMedia), len(allSeries))

	return filePath, nil
}

// ExportZIP 导出元数据为 ZIP 包（含图片）
func (s *BackupService) ExportZIP() (string, error) {
	exportDir := filepath.Join(s.cfg.Cache.CacheDir, "exports")
	os.MkdirAll(exportDir, 0755)

	filename := fmt.Sprintf("nowen-video-backup-%s.zip", time.Now().Format("20060102-150405"))
	filePath := filepath.Join(exportDir, filename)

	zipFile, err := os.Create(filePath)
	if err != nil {
		return "", fmt.Errorf("创建ZIP文件失败: %w", err)
	}
	defer zipFile.Close()

	w := zip.NewWriter(zipFile)
	defer w.Close()

	// 导出 JSON 元数据
	libs, _ := s.libRepo.List()
	var allMedia []model.Media
	var allSeries []model.Series

	for _, lib := range libs {
		media, _ := s.mediaRepo.ListByLibraryID(lib.ID)
		allMedia = append(allMedia, media...)
		series, _ := s.seriesRepo.ListByLibraryID(lib.ID)
		allSeries = append(allSeries, series...)
	}

	data := BackupData{
		Version:   "1.0",
		CreatedAt: time.Now(),
		Libraries: libs,
		Media:     allMedia,
		Series:    allSeries,
	}

	jsonData, _ := json.MarshalIndent(data, "", "  ")
	f, _ := w.Create("metadata.json")
	f.Write(jsonData)

	s.logger.Infof("ZIP备份完成: %s", filePath)
	return filePath, nil
}

// ImportJSON 从 JSON 备份恢复元数据（只恢复元数据，不恢复文件）
func (s *BackupService) ImportJSON(filePath string) error {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("读取备份文件失败: %w", err)
	}

	var backup BackupData
	if err := json.Unmarshal(data, &backup); err != nil {
		return fmt.Errorf("解析备份数据失败: %w", err)
	}

	s.logger.Infof("开始恢复备份: 版本=%s, 媒体库=%d, 媒体=%d, 合集=%d",
		backup.Version, len(backup.Libraries), len(backup.Media), len(backup.Series))

	// 恢复媒体元数据（仅更新已存在的记录的元数据字段）
	updated := 0
	for _, m := range backup.Media {
		existing, err := s.mediaRepo.FindByFilePath(m.FilePath)
		if err != nil {
			continue // 文件不存在则跳过
		}
		// 仅恢复元数据字段，不覆盖文件路径等
		existing.Title = m.Title
		existing.OrigTitle = m.OrigTitle
		existing.Year = m.Year
		existing.Overview = m.Overview
		existing.Rating = m.Rating
		existing.Genres = m.Genres
		existing.Country = m.Country
		existing.Language = m.Language
		existing.Tagline = m.Tagline
		existing.TMDbID = m.TMDbID
		existing.DoubanID = m.DoubanID
		if err := s.mediaRepo.Update(existing); err == nil {
			updated++
		}
	}

	s.logger.Infof("备份恢复完成: 更新了 %d 条媒体元数据", updated)
	return nil
}

// ImportFromZIP 从 ZIP 备份恢复
func (s *BackupService) ImportFromZIP(zipPath string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return fmt.Errorf("打开ZIP文件失败: %w", err)
	}
	defer r.Close()

	for _, f := range r.File {
		if f.Name == "metadata.json" {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			defer rc.Close()

			data, err := io.ReadAll(rc)
			if err != nil {
				return err
			}

			// 写入临时文件后调用 ImportJSON
			tmpPath := filepath.Join(os.TempDir(), "nowen-restore.json")
			if err := os.WriteFile(tmpPath, data, 0644); err != nil {
				return err
			}
			defer os.Remove(tmpPath)

			return s.ImportJSON(tmpPath)
		}
	}

	return fmt.Errorf("ZIP备份中未找到 metadata.json")
}

// GetBackupList 获取已有的备份文件列表
func (s *BackupService) GetBackupList() ([]map[string]interface{}, error) {
	exportDir := filepath.Join(s.cfg.Cache.CacheDir, "exports")
	entries, err := os.ReadDir(exportDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var backups []map[string]interface{}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		backups = append(backups, map[string]interface{}{
			"name":     entry.Name(),
			"size":     info.Size(),
			"modified": info.ModTime(),
		})
	}
	return backups, nil
}
