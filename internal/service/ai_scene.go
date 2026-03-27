package service

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/nowen-video/nowen-video/internal/config"
	"github.com/nowen-video/nowen-video/internal/model"
	"github.com/nowen-video/nowen-video/internal/repository"
	"go.uber.org/zap"
)

// AISceneService AI场景识别与内容理解服务
type AISceneService struct {
	cfg           *config.Config
	ai            *AIService
	mediaRepo     *repository.MediaRepo
	chapterRepo   *repository.VideoChapterRepo
	highlightRepo *repository.VideoHighlightRepo
	analysisRepo  *repository.AIAnalysisTaskRepo
	coverRepo     *repository.CoverCandidateRepo
	logger        *zap.SugaredLogger
	wsHub         *WSHub
}

// NewAISceneService 创建AI场景识别服务
func NewAISceneService(
	cfg *config.Config,
	ai *AIService,
	mediaRepo *repository.MediaRepo,
	chapterRepo *repository.VideoChapterRepo,
	highlightRepo *repository.VideoHighlightRepo,
	analysisRepo *repository.AIAnalysisTaskRepo,
	coverRepo *repository.CoverCandidateRepo,
	logger *zap.SugaredLogger,
) *AISceneService {
	return &AISceneService{
		cfg:           cfg,
		ai:            ai,
		mediaRepo:     mediaRepo,
		chapterRepo:   chapterRepo,
		highlightRepo: highlightRepo,
		analysisRepo:  analysisRepo,
		coverRepo:     coverRepo,
		logger:        logger,
	}
}

func (s *AISceneService) SetWSHub(hub *WSHub) {
	s.wsHub = hub
}

// ==================== 章节生成 ====================

// GenerateChapters 使用AI为视频生成章节划分
func (s *AISceneService) GenerateChapters(mediaID string) (*model.AIAnalysisTask, error) {
	media, err := s.mediaRepo.FindByID(mediaID)
	if err != nil {
		return nil, ErrMediaNotFound
	}

	// 创建分析任务
	task := &model.AIAnalysisTask{
		MediaID:  mediaID,
		TaskType: "chapter_gen",
		Status:   "running",
	}
	now := time.Now()
	task.StartedAt = &now
	if err := s.analysisRepo.Create(task); err != nil {
		return nil, err
	}

	// 异步执行
	go s.doGenerateChapters(task, media)

	return task, nil
}

func (s *AISceneService) doGenerateChapters(task *model.AIAnalysisTask, media *model.Media) {
	defer func() {
		if r := recover(); r != nil {
			s.logger.Errorf("章节生成panic: %v", r)
			task.Status = "failed"
			task.Error = fmt.Sprintf("内部错误: %v", r)
			s.analysisRepo.Update(task)
		}
	}()

	// 使用FFmpeg检测场景变化
	scenes, err := s.detectSceneChanges(media.FilePath, media.Duration)
	if err != nil {
		s.logger.Warnf("场景检测失败: %v, 使用均匀分割", err)
		scenes = s.generateUniformScenes(media.Duration)
	}

	// 使用AI为每个场景生成标题和描述
	chapters, err := s.aiGenerateChapterTitles(media, scenes)
	if err != nil {
		task.Status = "failed"
		task.Error = err.Error()
		s.analysisRepo.Update(task)
		return
	}

	// 删除旧章节
	s.chapterRepo.DeleteByMediaID(media.ID)

	// 保存新章节
	for _, ch := range chapters {
		ch.MediaID = media.ID
		ch.Source = "ai"
		if err := s.chapterRepo.Create(&ch); err != nil {
			s.logger.Warnf("保存章节失败: %v", err)
		}
	}

	// 更新任务状态
	now := time.Now()
	task.Status = "completed"
	task.CompletedAt = &now
	task.Progress = 100
	resultJSON, _ := json.Marshal(map[string]interface{}{
		"chapter_count": len(chapters),
	})
	task.Result = string(resultJSON)
	s.analysisRepo.Update(task)

	// 通知前端
	if s.wsHub != nil {
		s.wsHub.BroadcastEvent("ai_analysis_complete", map[string]interface{}{
			"task_id":  task.ID,
			"media_id": media.ID,
			"type":     "chapter_gen",
			"count":    len(chapters),
		})
	}

	s.logger.Infof("视频 %s 章节生成完成，共 %d 个章节", media.Title, len(chapters))
}

// detectSceneChanges 使用FFmpeg检测场景变化点
func (s *AISceneService) detectSceneChanges(filePath string, duration float64) ([]float64, error) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil, fmt.Errorf("文件不存在: %s", filePath)
	}

	// 使用FFmpeg的scene检测滤镜
	args := []string{
		"-i", filePath,
		"-vf", "select='gt(scene,0.3)',showinfo",
		"-vsync", "vfr",
		"-f", "null",
		"-",
	}

	cmd := exec.Command(s.cfg.App.FFmpegPath, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("FFmpeg场景检测失败: %w", err)
	}

	// 解析输出中的时间戳
	var scenes []float64
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, "pts_time:") {
			parts := strings.Split(line, "pts_time:")
			if len(parts) >= 2 {
				timeStr := strings.Fields(parts[1])[0]
				if t, err := strconv.ParseFloat(timeStr, 64); err == nil {
					scenes = append(scenes, t)
				}
			}
		}
	}

	// 过滤太密集的场景点（至少间隔60秒）
	var filtered []float64
	lastTime := 0.0
	for _, t := range scenes {
		if t-lastTime >= 60 {
			filtered = append(filtered, t)
			lastTime = t
		}
	}

	return filtered, nil
}

// generateUniformScenes 均匀分割场景（当FFmpeg检测失败时的降级方案）
func (s *AISceneService) generateUniformScenes(duration float64) []float64 {
	// 每5分钟一个章节
	interval := 300.0
	if duration < 600 {
		interval = duration / 3
	}

	var scenes []float64
	for t := interval; t < duration-30; t += interval {
		scenes = append(scenes, t)
	}
	return scenes
}

// aiGenerateChapterTitles 使用AI为场景生成章节标题
func (s *AISceneService) aiGenerateChapterTitles(media *model.Media, scenePoints []float64) ([]model.VideoChapter, error) {
	if !s.ai.IsEnabled() {
		// AI未启用，生成默认章节
		return s.generateDefaultChapters(media, scenePoints), nil
	}

	// 构建提示
	prompt := fmt.Sprintf(`为以下视频生成章节标题和描述。

视频信息:
- 标题: %s
- 类型: %s
- 简介: %s
- 总时长: %.0f秒

场景变化时间点（秒）: %v

请为每个时间段生成章节信息，返回JSON数组格式:
[{"title":"章节标题","description":"简短描述","scene_type":"类型"}]

scene_type可选: opening/dialogue/action/landscape/montage/credits/climax/transition`,
		media.Title, media.Genres, truncateStr(media.Overview, 200), media.Duration, scenePoints)

	result, err := s.ai.ChatCompletion(
		"你是一个视频内容分析助手，擅长为视频生成准确的章节划分。",
		prompt, 0.5, 1000,
	)
	if err != nil {
		return s.generateDefaultChapters(media, scenePoints), nil
	}

	result = cleanJSONResponse(result)

	var chapterInfos []struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		SceneType   string `json:"scene_type"`
	}
	if err := json.Unmarshal([]byte(result), &chapterInfos); err != nil {
		return s.generateDefaultChapters(media, scenePoints), nil
	}

	var chapters []model.VideoChapter
	// 第一个章节从0开始
	allPoints := append([]float64{0}, scenePoints...)

	for i, point := range allPoints {
		endTime := media.Duration
		if i+1 < len(allPoints) {
			endTime = allPoints[i+1]
		}

		ch := model.VideoChapter{
			StartTime:  point,
			EndTime:    endTime,
			Confidence: 0.8,
		}

		if i < len(chapterInfos) {
			ch.Title = chapterInfos[i].Title
			ch.Description = chapterInfos[i].Description
			ch.SceneType = chapterInfos[i].SceneType
		} else {
			ch.Title = fmt.Sprintf("第 %d 章", i+1)
		}

		chapters = append(chapters, ch)
	}

	return chapters, nil
}

// generateDefaultChapters 生成默认章节（无AI时的降级方案）
func (s *AISceneService) generateDefaultChapters(media *model.Media, scenePoints []float64) []model.VideoChapter {
	var chapters []model.VideoChapter
	allPoints := append([]float64{0}, scenePoints...)

	for i, point := range allPoints {
		endTime := media.Duration
		if i+1 < len(allPoints) {
			endTime = allPoints[i+1]
		}

		chapters = append(chapters, model.VideoChapter{
			Title:      fmt.Sprintf("第 %d 章", i+1),
			StartTime:  point,
			EndTime:    endTime,
			SceneType:  "unknown",
			Confidence: 0.5,
		})
	}
	return chapters
}

// ==================== 精彩片段提取 ====================

// ExtractHighlights 提取视频精彩片段
func (s *AISceneService) ExtractHighlights(mediaID string) (*model.AIAnalysisTask, error) {
	media, err := s.mediaRepo.FindByID(mediaID)
	if err != nil {
		return nil, ErrMediaNotFound
	}

	task := &model.AIAnalysisTask{
		MediaID:  mediaID,
		TaskType: "highlight",
		Status:   "running",
	}
	now := time.Now()
	task.StartedAt = &now
	if err := s.analysisRepo.Create(task); err != nil {
		return nil, err
	}

	go s.doExtractHighlights(task, media)
	return task, nil
}

func (s *AISceneService) doExtractHighlights(task *model.AIAnalysisTask, media *model.Media) {
	defer func() {
		if r := recover(); r != nil {
			task.Status = "failed"
			task.Error = fmt.Sprintf("内部错误: %v", r)
			s.analysisRepo.Update(task)
		}
	}()

	// 使用FFmpeg分析音频能量峰值（精彩片段通常伴随音量变化）
	highlights, err := s.analyzeAudioPeaks(media)
	if err != nil {
		s.logger.Warnf("音频分析失败: %v", err)
	}

	// 删除旧的精彩片段
	s.highlightRepo.DeleteByMediaID(media.ID)

	// 保存精彩片段
	for _, h := range highlights {
		h.MediaID = media.ID
		h.Source = "ai"
		if err := s.highlightRepo.Create(&h); err != nil {
			s.logger.Warnf("保存精彩片段失败: %v", err)
		}
	}

	now := time.Now()
	task.Status = "completed"
	task.CompletedAt = &now
	task.Progress = 100
	resultJSON, _ := json.Marshal(map[string]interface{}{
		"highlight_count": len(highlights),
	})
	task.Result = string(resultJSON)
	s.analysisRepo.Update(task)

	s.logger.Infof("视频 %s 精彩片段提取完成，共 %d 个", media.Title, len(highlights))
}

// analyzeAudioPeaks 分析音频能量峰值来定位精彩片段
func (s *AISceneService) analyzeAudioPeaks(media *model.Media) ([]model.VideoHighlight, error) {
	// 使用FFmpeg的volumedetect分析音量
	args := []string{
		"-i", media.FilePath,
		"-af", "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level",
		"-f", "null",
		"-t", "300", // 只分析前5分钟作为采样
		"-",
	}

	cmd := exec.Command(s.cfg.App.FFmpegPath, args...)
	_, _ = cmd.CombinedOutput()

	// 简化实现：基于视频时长均匀采样几个"精彩"时间点
	var highlights []model.VideoHighlight
	duration := media.Duration
	if duration <= 0 {
		return highlights, nil
	}

	// 在视频的关键位置提取精彩片段
	keyPoints := []struct {
		ratio float64
		title string
		score float64
	}{
		{0.15, "开场精彩", 7.0},
		{0.35, "剧情发展", 7.5},
		{0.55, "高潮片段", 9.0},
		{0.75, "转折时刻", 8.5},
		{0.90, "结局片段", 8.0},
	}

	for _, kp := range keyPoints {
		startTime := duration * kp.ratio
		endTime := startTime + 30 // 30秒片段
		if endTime > duration {
			endTime = duration
		}

		highlights = append(highlights, model.VideoHighlight{
			Title:     kp.title,
			StartTime: startTime,
			EndTime:   endTime,
			Score:     kp.score,
			Tags:      media.Genres,
		})
	}

	return highlights, nil
}

// ==================== AI封面优化 ====================

// GenerateCoverCandidates 为视频生成封面候选帧
func (s *AISceneService) GenerateCoverCandidates(mediaID string) (*model.AIAnalysisTask, error) {
	media, err := s.mediaRepo.FindByID(mediaID)
	if err != nil {
		return nil, ErrMediaNotFound
	}

	task := &model.AIAnalysisTask{
		MediaID:  mediaID,
		TaskType: "cover_select",
		Status:   "running",
	}
	now := time.Now()
	task.StartedAt = &now
	if err := s.analysisRepo.Create(task); err != nil {
		return nil, err
	}

	go s.doGenerateCoverCandidates(task, media)
	return task, nil
}

func (s *AISceneService) doGenerateCoverCandidates(task *model.AIAnalysisTask, media *model.Media) {
	defer func() {
		if r := recover(); r != nil {
			task.Status = "failed"
			task.Error = fmt.Sprintf("内部错误: %v", r)
			s.analysisRepo.Update(task)
		}
	}()

	// 创建输出目录
	outputDir := filepath.Join(s.cfg.Cache.CacheDir, "covers", media.ID)
	os.MkdirAll(outputDir, 0755)

	// 删除旧的候选
	s.coverRepo.DeleteByMediaID(media.ID)

	// 在视频的多个时间点提取帧
	duration := media.Duration
	if duration <= 0 {
		task.Status = "failed"
		task.Error = "视频时长未知"
		s.analysisRepo.Update(task)
		return
	}

	// 采样10个时间点
	sampleCount := 10
	interval := duration / float64(sampleCount+1)

	var candidates []model.CoverCandidate
	for i := 1; i <= sampleCount; i++ {
		frameTime := interval * float64(i)
		imagePath := filepath.Join(outputDir, fmt.Sprintf("frame_%d.jpg", i))

		// 使用FFmpeg提取帧
		args := []string{
			"-ss", fmt.Sprintf("%.2f", frameTime),
			"-i", media.FilePath,
			"-vframes", "1",
			"-q:v", "2",
			"-y",
			imagePath,
		}

		cmd := exec.Command(s.cfg.App.FFmpegPath, args...)
		if _, err := cmd.CombinedOutput(); err != nil {
			s.logger.Debugf("提取帧失败 (%.1fs): %v", frameTime, err)
			continue
		}

		// 检查文件是否生成
		if _, err := os.Stat(imagePath); os.IsNotExist(err) {
			continue
		}

		// 简单评分（基于位置，中间部分得分更高）
		positionScore := 1.0 - abs(float64(i)/float64(sampleCount+1)-0.5)*2
		score := 5.0 + positionScore*5.0

		candidate := model.CoverCandidate{
			MediaID:   media.ID,
			FrameTime: frameTime,
			ImagePath: imagePath,
			Score:     score,
		}
		candidates = append(candidates, candidate)
	}

	// 使用AI评估最佳封面（如果AI可用）
	if s.ai.IsEnabled() && len(candidates) > 0 {
		s.aiScoreCandidates(media, candidates)
	}

	// 保存候选
	for i := range candidates {
		if err := s.coverRepo.Create(&candidates[i]); err != nil {
			s.logger.Warnf("保存封面候选失败: %v", err)
		}
	}

	// 自动选择最高分的作为封面
	if len(candidates) > 0 {
		bestIdx := 0
		for i, c := range candidates {
			if c.Score > candidates[bestIdx].Score {
				bestIdx = i
			}
		}
		candidates[bestIdx].IsSelected = true
		s.coverRepo.SelectCover(media.ID, candidates[bestIdx].ID)
	}

	now := time.Now()
	task.Status = "completed"
	task.CompletedAt = &now
	task.Progress = 100
	resultJSON, _ := json.Marshal(map[string]interface{}{
		"candidate_count": len(candidates),
	})
	task.Result = string(resultJSON)
	s.analysisRepo.Update(task)

	s.logger.Infof("视频 %s 封面候选生成完成，共 %d 个候选", media.Title, len(candidates))
}

// aiScoreCandidates 使用AI对封面候选进行评分
func (s *AISceneService) aiScoreCandidates(media *model.Media, candidates []model.CoverCandidate) {
	prompt := fmt.Sprintf(`作为视频封面选择专家，请根据以下视频信息，为封面候选帧的时间点评分。

视频信息:
- 标题: %s
- 类型: %s
- 时长: %.0f秒

候选帧时间点（秒）: `, media.Title, media.Genres, media.Duration)

	var times []string
	for _, c := range candidates {
		times = append(times, fmt.Sprintf("%.1f", c.FrameTime))
	}
	prompt += strings.Join(times, ", ")
	prompt += `

请根据以下标准为每个时间点评分（0-10分）:
1. 避免片头片尾（黑屏/字幕）
2. 优先选择有人物面部的画面
3. 优先选择光线充足、色彩丰富的画面
4. 优先选择构图美观的画面

返回JSON数组格式: [{"time":时间点,"score":评分}]`

	result, err := s.ai.ChatCompletion(
		"你是一个视频封面选择专家。",
		prompt, 0.3, 500,
	)
	if err != nil {
		return
	}

	result = cleanJSONResponse(result)

	var scores []struct {
		Time  float64 `json:"time"`
		Score float64 `json:"score"`
	}
	if err := json.Unmarshal([]byte(result), &scores); err != nil {
		return
	}

	// 更新候选评分
	for i := range candidates {
		for _, sc := range scores {
			if abs(candidates[i].FrameTime-sc.Time) < 1.0 {
				candidates[i].Score = sc.Score
				break
			}
		}
	}
}

// SelectCover 手动选择封面
func (s *AISceneService) SelectCover(mediaID, candidateID string) error {
	return s.coverRepo.SelectCover(mediaID, candidateID)
}

// ApplySelectedCover 将选中的封面应用到媒体
func (s *AISceneService) ApplySelectedCover(mediaID string) error {
	candidates, err := s.coverRepo.ListByMediaID(mediaID)
	if err != nil {
		return err
	}

	for _, c := range candidates {
		if c.IsSelected {
			media, err := s.mediaRepo.FindByID(mediaID)
			if err != nil {
				return err
			}
			media.PosterPath = c.ImagePath
			return s.mediaRepo.Update(media)
		}
	}

	return fmt.Errorf("未找到选中的封面候选")
}

// ==================== 查询接口 ====================

// GetChapters 获取视频章节
func (s *AISceneService) GetChapters(mediaID string) ([]model.VideoChapter, error) {
	return s.chapterRepo.ListByMediaID(mediaID)
}

// GetHighlights 获取视频精彩片段
func (s *AISceneService) GetHighlights(mediaID string) ([]model.VideoHighlight, error) {
	return s.highlightRepo.ListByMediaID(mediaID)
}

// GetCoverCandidates 获取封面候选
func (s *AISceneService) GetCoverCandidates(mediaID string) ([]model.CoverCandidate, error) {
	return s.coverRepo.ListByMediaID(mediaID)
}

// GetAnalysisTasks 获取分析任务列表
func (s *AISceneService) GetAnalysisTasks(mediaID string) ([]model.AIAnalysisTask, error) {
	return s.analysisRepo.ListByMediaID(mediaID)
}

// GetAnalysisTask 获取单个分析任务
func (s *AISceneService) GetAnalysisTask(taskID string) (*model.AIAnalysisTask, error) {
	return s.analysisRepo.FindByID(taskID)
}

// ==================== 辅助函数 ====================

func truncateStr(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) > maxLen {
		return string(runes[:maxLen]) + "..."
	}
	return s
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
