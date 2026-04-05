package service

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"alex-desktop/model"
	"go.uber.org/zap"
)

// NFOService NFO 本地元数据解析服务
// 支持 Kodi / Emby / Jellyfin 风格的 NFO XML 文件
// 增强：宽松兼容非标准字段、日期归一化、原始 XML 保留
type NFOService struct {
	logger *zap.SugaredLogger
}

func NewNFOService(logger *zap.SugaredLogger) *NFOService {
	return &NFOService{logger: logger}
}

// ==================== NFO XML 结构体（增强版） ====================

// NFOMovie 电影 NFO XML 根元素（宽松兼容）
type NFOMovie struct {
	XMLName xml.Name `xml:"movie"`
	// 标准字段
	Title     string  `xml:"title"`
	OrigTitle string  `xml:"originaltitle"`
	SortTitle string  `xml:"sorttitle"`
	Year      int     `xml:"year"`
	Plot      string  `xml:"plot"`
	Outline   string  `xml:"outline"`
	Tagline   string  `xml:"tagline"`
	Rating    float64 `xml:"rating"`
	Runtime   int     `xml:"runtime"`
	Studio    string  `xml:"studio"`
	Country   string  `xml:"country"`
	TMDbID    int     `xml:"tmdbid"`
	DoubanID  string  `xml:"doubanid"`
	Genres    []string `xml:"genre"`
	Tags      []string `xml:"tag"`
	Directors []string `xml:"director"`
	Actors    []NFOActor `xml:"actor"`
	// 增强字段：日期（多种来源，后续归一化）
	Premiered   string `xml:"premiered"`
	ReleaseDate string `xml:"releasedate"`
	Release     string `xml:"release"`
	// 增强字段：评分/分级
	CriticRating float64 `xml:"criticrating"`
	MPAA         string  `xml:"mpaa"`
	CustomRating string  `xml:"customrating"`
	CountryCode  string  `xml:"countrycode"`
	// 增强字段：制作信息（非标准但常见于特定刮削器）
	OriginalPlot string `xml:"originalplot"`
	Maker        string `xml:"maker"`
	Publisher    string `xml:"publisher"`
	Label        string `xml:"label"`
	Num          string `xml:"num"`
	// 增强字段：远程图片路径
	Poster string `xml:"poster"`
	Cover  string `xml:"cover"`
	Fanart string `xml:"fanart"`
	Thumb  string `xml:"thumb"`
	// 增强字段：站点来源 Provider IDs
	JavbusID      string `xml:"javbusid"`
	AiravCcid     string `xml:"airav_ccid"`
	JavdbSearchID string `xml:"javdbsearchid"`
}

// NFOTVShow 剧集 NFO XML 根元素
type NFOTVShow struct {
	XMLName   xml.Name   `xml:"tvshow"`
	Title     string     `xml:"title"`
	OrigTitle string     `xml:"originaltitle"`
	Year      int        `xml:"year"`
	Plot      string     `xml:"plot"`
	Rating    float64    `xml:"rating"`
	Studio    string     `xml:"studio"`
	Country   string     `xml:"country"`
	TMDbID    int        `xml:"tmdbid"`
	DoubanID  string     `xml:"doubanid"`
	Genres    []string   `xml:"genre"`
	Tags      []string   `xml:"tag"`
	Directors []string   `xml:"director"`
	Actors    []NFOActor `xml:"actor"`
	// 增强日期字段
	Premiered   string `xml:"premiered"`
	ReleaseDate string `xml:"releasedate"`
}

// NFOActor NFO 演员信息（宽松兼容：name 可能为空）
type NFOActor struct {
	Name      string `xml:"name"`
	Role      string `xml:"role"`
	Thumb     string `xml:"thumb"`
	SortOrder int    `xml:"sortorder"`
}

// NFOExtraFields 存储到 Media.NfoExtraFields 的 JSON 结构
// NOTE: 后续可根据需要扩展字段
type NFOExtraFields struct {
	SortTitle    string            `json:"sort_title,omitempty"`
	Outline      string            `json:"outline,omitempty"`
	OriginalPlot string            `json:"original_plot,omitempty"`
	MPAA         string            `json:"mpaa,omitempty"`
	CustomRating string            `json:"custom_rating,omitempty"`
	CriticRating float64           `json:"critic_rating,omitempty"`
	CountryCode  string            `json:"country_code,omitempty"`
	Maker        string            `json:"maker,omitempty"`
	Publisher    string            `json:"publisher,omitempty"`
	Label        string            `json:"label,omitempty"`
	Num          string            `json:"num,omitempty"`
	Poster       string            `json:"poster,omitempty"`
	Cover        string            `json:"cover,omitempty"`
	Fanart       string            `json:"fanart,omitempty"`
	Tags         []string          `json:"tags,omitempty"`
	ProviderIDs  map[string]string `json:"provider_ids,omitempty"`
}

// ==================== 解析方法 ====================

// ParseMovieNFO 解析电影 NFO 文件并将数据应用到 Media 对象
func (s *NFOService) ParseMovieNFO(nfoPath string, media *model.Media) error {
	data, err := os.ReadFile(nfoPath)
	if err != nil {
		return fmt.Errorf("读取NFO文件失败: %w", err)
	}

	// 保留原始 XML 文本
	media.NfoRawXml = string(data)

	var nfo NFOMovie
	if err := xml.Unmarshal(data, &nfo); err != nil {
		// 尝试作为 tvshow 解析
		var tvNFO NFOTVShow
		if err2 := xml.Unmarshal(data, &tvNFO); err2 != nil {
			return fmt.Errorf("解析NFO XML失败: %w", err)
		}
		// 如果是 tvshow 格式，转换后应用
		s.applyTVShowNFOToMedia(media, &tvNFO)
		return nil
	}

	s.applyMovieNFOToMedia(media, &nfo)
	return nil
}

// ParseTVShowNFO 解析剧集 NFO 文件并将数据应用到 Series 对象
func (s *NFOService) ParseTVShowNFO(nfoPath string, series *model.Series) error {
	data, err := os.ReadFile(nfoPath)
	if err != nil {
		return fmt.Errorf("读取NFO文件失败: %w", err)
	}

	var nfo NFOTVShow
	if err := xml.Unmarshal(data, &nfo); err != nil {
		return fmt.Errorf("解析NFO XML失败: %w", err)
	}

	s.applyTVShowNFOToSeries(series, &nfo)
	return nil
}

// GetActorsFromNFO 从 NFO 文件中提取演员列表
func (s *NFOService) GetActorsFromNFO(nfoPath string) ([]NFOActor, []string, error) {
	data, err := os.ReadFile(nfoPath)
	if err != nil {
		return nil, nil, err
	}

	// 先尝试 movie
	var movie NFOMovie
	if err := xml.Unmarshal(data, &movie); err == nil && movie.Title != "" {
		return movie.Actors, movie.Directors, nil
	}

	// 再尝试 tvshow
	var tvshow NFOTVShow
	if err := xml.Unmarshal(data, &tvshow); err == nil && tvshow.Title != "" {
		return tvshow.Actors, tvshow.Directors, nil
	}

	return nil, nil, fmt.Errorf("无法解析NFO文件")
}

// ==================== 本地图片扫描 ====================

// FindLocalImages 在指定目录下查找本地图片（poster/fanart/banner 等）
// 支持 jpg、png、webp 等常见图片格式
func (s *NFOService) FindLocalImages(dir string) (poster, backdrop string) {
	// 常见本地海报文件名（按优先级排序）
	posterNames := []string{
		"poster.jpg", "poster.png", "poster.webp",
		"cover.jpg", "cover.png", "cover.webp",
		"folder.jpg", "folder.png", "folder.webp",
		"thumb.jpg", "thumb.png", "thumb.webp",
		"movie.jpg", "movie.png",
		"show.jpg", "show.png",
	}
	// 常见本地背景图文件名
	backdropNames := []string{
		"fanart.jpg", "fanart.png", "fanart.webp",
		"backdrop.jpg", "backdrop.png", "backdrop.webp",
		"banner.jpg", "banner.png", "banner.webp",
		"background.jpg", "background.png", "background.webp",
		"clearart.jpg", "clearart.png",
		"landscape.jpg", "landscape.png",
	}

	for _, name := range posterNames {
		path := filepath.Join(dir, name)
		if _, err := os.Stat(path); err == nil {
			poster = path
			break
		}
	}

	for _, name := range backdropNames {
		path := filepath.Join(dir, name)
		if _, err := os.Stat(path); err == nil {
			backdrop = path
			break
		}
	}

	// 如果没有找到标准命名的海报，尝试查找目录中的第一张图片作为海报
	if poster == "" {
		entries, err := os.ReadDir(dir)
		if err == nil {
			imageExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true}
			for _, entry := range entries {
				if !entry.IsDir() {
					ext := strings.ToLower(filepath.Ext(entry.Name()))
					if imageExts[ext] {
						// 排除已识别为backdrop的文件
						candidate := filepath.Join(dir, entry.Name())
						if candidate != backdrop {
							poster = candidate
							break
						}
					}
				}
			}
		}
	}

	return poster, backdrop
}

// FindNFOFile 在指定目录下查找 NFO 文件
func (s *NFOService) FindNFOFile(dir string) string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return ""
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(strings.ToLower(entry.Name()), ".nfo") {
			return filepath.Join(dir, entry.Name())
		}
	}
	return ""
}

// FindNFOForMedia 根据媒体文件路径查找关联的 NFO 文件
func (s *NFOService) FindNFOForMedia(mediaFilePath string) string {
	// 策略1: 同名 .nfo 文件
	ext := filepath.Ext(mediaFilePath)
	nfoPath := strings.TrimSuffix(mediaFilePath, ext) + ".nfo"
	if _, err := os.Stat(nfoPath); err == nil {
		return nfoPath
	}

	// 策略2: 目录下任意 .nfo 文件
	dir := filepath.Dir(mediaFilePath)
	return s.FindNFOFile(dir)
}

// ==================== 日期归一化 ====================

// normalizeReleaseDate 从多个日期字段中选择优先级最高的并格式化
// 优先级: releasedate > premiered > release
func normalizeReleaseDate(releasedate, premiered, release string) string {
	candidates := []string{
		strings.TrimSpace(releasedate),
		strings.TrimSpace(premiered),
		strings.TrimSpace(release),
	}
	for _, d := range candidates {
		if d != "" && len(d) >= 4 {
			// 尝试识别常见日期格式，归一化为 YYYY-MM-DD
			// 已经是合法格式的直接返回
			return d
		}
	}
	return ""
}

// ==================== 应用 NFO 数据（增强版） ====================

func (s *NFOService) applyMovieNFOToMedia(media *model.Media, nfo *NFOMovie) {
	if nfo.Title != "" {
		media.Title = nfo.Title
	}
	if nfo.OrigTitle != "" {
		media.OrigTitle = nfo.OrigTitle
	}
	if nfo.Year > 0 {
		media.Year = nfo.Year
	}
	if nfo.Plot != "" {
		media.Overview = nfo.Plot
	}
	if nfo.Rating > 0 {
		media.Rating = nfo.Rating
	}
	if nfo.Runtime > 0 {
		media.Runtime = nfo.Runtime
	}
	// genre 和 tag 合并去重展示
	allGenres := append(nfo.Genres, nfo.Tags...)
	if len(allGenres) > 0 {
		seen := make(map[string]bool)
		var deduped []string
		for _, g := range allGenres {
			g = strings.TrimSpace(g)
			if g != "" && !seen[g] {
				seen[g] = true
				deduped = append(deduped, g)
			}
		}
		media.Genres = strings.Join(deduped, ",")
	}
	if nfo.Tagline != "" {
		media.Tagline = nfo.Tagline
	}
	if nfo.Studio != "" {
		media.Studio = nfo.Studio
	}
	if nfo.Country != "" {
		media.Country = nfo.Country
	}
	if nfo.TMDbID > 0 {
		media.TMDbID = nfo.TMDbID
	}
	if nfo.DoubanID != "" {
		media.DoubanID = nfo.DoubanID
	}

	// 日期归一化
	normalized := normalizeReleaseDate(nfo.ReleaseDate, nfo.Premiered, nfo.Release)
	if normalized != "" {
		media.ReleaseDateNormalized = normalized
	}

	// 构建扩展字段 JSON
	extra := NFOExtraFields{
		SortTitle:    nfo.SortTitle,
		Outline:      nfo.Outline,
		OriginalPlot: nfo.OriginalPlot,
		MPAA:         nfo.MPAA,
		CustomRating: nfo.CustomRating,
		CriticRating: nfo.CriticRating,
		CountryCode:  nfo.CountryCode,
		Maker:        nfo.Maker,
		Publisher:    nfo.Publisher,
		Label:        nfo.Label,
		Num:          nfo.Num,
		Poster:       nfo.Poster,
		Cover:        nfo.Cover,
		Fanart:       nfo.Fanart,
		Tags:         nfo.Tags,
	}

	// 收集 provider IDs
	providerIDs := make(map[string]string)
	if nfo.JavbusID != "" {
		providerIDs["javbusid"] = nfo.JavbusID
	}
	if nfo.AiravCcid != "" {
		providerIDs["airav_ccid"] = nfo.AiravCcid
	}
	if nfo.JavdbSearchID != "" {
		providerIDs["javdbsearchid"] = nfo.JavdbSearchID
	}
	if len(providerIDs) > 0 {
		extra.ProviderIDs = providerIDs
	}

	// 只在有实际内容时序列化存储
	if s.hasExtraContent(&extra) {
		if data, err := json.Marshal(extra); err == nil {
			media.NfoExtraFields = string(data)
		}
	}
}

// hasExtraContent 检查扩展字段是否有实际内容（避免写入空 JSON）
func (s *NFOService) hasExtraContent(extra *NFOExtraFields) bool {
	return extra.SortTitle != "" || extra.Outline != "" || extra.OriginalPlot != "" ||
		extra.MPAA != "" || extra.CustomRating != "" || extra.CriticRating > 0 ||
		extra.CountryCode != "" || extra.Maker != "" || extra.Publisher != "" ||
		extra.Label != "" || extra.Num != "" || extra.Poster != "" ||
		extra.Cover != "" || extra.Fanart != "" || len(extra.Tags) > 0 ||
		len(extra.ProviderIDs) > 0
}

func (s *NFOService) applyTVShowNFOToMedia(media *model.Media, nfo *NFOTVShow) {
	if nfo.Title != "" {
		media.Title = nfo.Title
	}
	if nfo.OrigTitle != "" {
		media.OrigTitle = nfo.OrigTitle
	}
	if nfo.Year > 0 {
		media.Year = nfo.Year
	}
	if nfo.Plot != "" {
		media.Overview = nfo.Plot
	}
	if nfo.Rating > 0 {
		media.Rating = nfo.Rating
	}
	allGenres := append(nfo.Genres, nfo.Tags...)
	if len(allGenres) > 0 {
		seen := make(map[string]bool)
		var deduped []string
		for _, g := range allGenres {
			g = strings.TrimSpace(g)
			if g != "" && !seen[g] {
				seen[g] = true
				deduped = append(deduped, g)
			}
		}
		media.Genres = strings.Join(deduped, ",")
	}
	if nfo.Country != "" {
		media.Country = nfo.Country
	}
	// 日期归一化
	normalized := normalizeReleaseDate(nfo.ReleaseDate, nfo.Premiered, "")
	if normalized != "" {
		media.ReleaseDateNormalized = normalized
	}
}

func (s *NFOService) applyTVShowNFOToSeries(series *model.Series, nfo *NFOTVShow) {
	if nfo.Title != "" {
		series.Title = nfo.Title
	}
	if nfo.OrigTitle != "" {
		series.OrigTitle = nfo.OrigTitle
	}
	if nfo.Year > 0 {
		series.Year = nfo.Year
	}
	if nfo.Plot != "" {
		series.Overview = nfo.Plot
	}
	if nfo.Rating > 0 {
		series.Rating = nfo.Rating
	}
	allGenres := append(nfo.Genres, nfo.Tags...)
	if len(allGenres) > 0 {
		seen := make(map[string]bool)
		var deduped []string
		for _, g := range allGenres {
			g = strings.TrimSpace(g)
			if g != "" && !seen[g] {
				seen[g] = true
				deduped = append(deduped, g)
			}
		}
		series.Genres = strings.Join(deduped, ",")
	}
	if nfo.Studio != "" {
		series.Studio = nfo.Studio
	}
	if nfo.Country != "" {
		series.Country = nfo.Country
	}
	if nfo.TMDbID > 0 {
		series.TMDbID = nfo.TMDbID
	}
	if nfo.DoubanID != "" {
		series.DoubanID = nfo.DoubanID
	}
}
