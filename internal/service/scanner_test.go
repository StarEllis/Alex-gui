package service

import (
	"fmt"
	"testing"
)

func TestParseEpisodeInfo(t *testing.T) {
	s := &ScannerService{}

	tests := []struct {
		filename       string
		wantSeasonNum  int
		wantEpisodeNum int
		wantTitle      string // 期望的 episode_title，默认为空字符串
		desc           string
	}{
		// === 用户要求的格式 ===
		{
			filename:       "[异域字幕组][一拳超人][One-Punch Man][01][1280x720][简体].mkv",
			wantSeasonNum:  0, // 文件名中无季号，由 collectEpisodes 默认为1
			wantEpisodeNum: 1,
			desc:           "字幕组标准格式：方括号内纯数字",
		},
		{
			filename:       "[异域字幕组][一拳超人][One-Punch Man][12][1280x720][简体].mkv",
			wantSeasonNum:  0,
			wantEpisodeNum: 12,
			desc:           "字幕组标准格式：第12集",
		},
		{
			filename:       "[HYSUB][ONE PUNCH MAN S2][OVA01][GB_MP4][1280X720].mp4",
			wantSeasonNum:  2, // 从文件名中的 S2 提取
			wantEpisodeNum: 1,
			desc:           "变体格式：含 S2 季号 + OVA01",
		},
		{
			filename:       "[HYSUB][ONE PUNCH MAN S2][OVA03][GB_MP4][1280X720].mp4",
			wantSeasonNum:  2,
			wantEpisodeNum: 3,
			desc:           "变体格式：OVA03",
		},

		// === 标准 SxxExx 格式 ===
		{
			filename:       "One.Punch.Man.S01E01.720p.mkv",
			wantSeasonNum:  1,
			wantEpisodeNum: 1,
			desc:           "标准 S01E01 格式",
		},
		{
			filename:       "One.Punch.Man.S02E12.1080p.mkv",
			wantSeasonNum:  2,
			wantEpisodeNum: 12,
			desc:           "标准 S02E12 格式",
		},

		// === EP 格式 ===
		{
			filename:       "[字幕组] 一拳超人 EP05 [1080P].mkv",
			wantSeasonNum:  0,
			wantEpisodeNum: 5,
			desc:           "EP05 格式",
		},

		// === 第X集 格式 ===
		{
			filename:       "一拳超人 第3集.mkv",
			wantSeasonNum:  0,
			wantEpisodeNum: 3,
			desc:           "中文第X集格式",
		},

		// === 分辨率不应被误匹配 ===
		{
			filename:       "[字幕组][剧名][01][1920x1080][简体].mkv",
			wantSeasonNum:  0,
			wantEpisodeNum: 1,
			desc:           "1920x1080 不应被误匹配为集号",
		},
		{
			filename:       "[字幕组][剧名][05][720P].mkv",
			wantSeasonNum:  0,
			wantEpisodeNum: 5,
			desc:           "720P 不应影响[05]的正确匹配",
		},

		// === SP 特别篇 ===
		{
			filename:       "[字幕组][一拳超人][SP01][1080P].mkv",
			wantSeasonNum:  0,
			wantEpisodeNum: 1,
			desc:           "SP01 特别篇",
		},

		// === [数字END] 格式 ===
		{
			filename:       "[异域字幕组][一拳超人][One-Punch Man][12END][1280x720][简体].mp4",
			wantSeasonNum:  0,
			wantEpisodeNum: 12,
			desc:           "[12END] 格式：最后一集带END标记",
		},
		{
			filename:       "[HYSUB][ONE PUNCH MAN][24][GB_MP4][1280X720][END]-remux nvl.mp4",
			wantSeasonNum:  0,
			wantEpisodeNum: 24,
			wantTitle:      "", // -remux nvl 不应成为标题
			desc:           "[24][END] 格式：END在单独方括号中，技术标记不作为标题",
		},
		{
			filename:       "[HYSUB][ONE PUNCH MAN][13][GB_MP4][1280X720]-remux nvl.mp4",
			wantSeasonNum:  0,
			wantEpisodeNum: 13,
			wantTitle:      "", // -remux nvl 不应成为标题
			desc:           "技术标记 remux nvl 不应被识别为剧集标题",
		},
		{
			filename:       "[字幕组][动漫名][13FINAL][1080P].mkv",
			wantSeasonNum:  0,
			wantEpisodeNum: 13,
			desc:           "[13FINAL] 格式：FINAL后缀",
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			ep := s.parseEpisodeInfo(tt.filename)
			if ep.SeasonNum != tt.wantSeasonNum {
				t.Errorf("文件名: %s\n  季号: 期望 %d, 得到 %d", tt.filename, tt.wantSeasonNum, ep.SeasonNum)
			}
			if ep.EpisodeNum != tt.wantEpisodeNum {
				t.Errorf("文件名: %s\n  集号: 期望 %d, 得到 %d", tt.filename, tt.wantEpisodeNum, ep.EpisodeNum)
			}
			if ep.EpisodeTitle != tt.wantTitle {
				t.Errorf("文件名: %s\n  标题: 期望 %q, 得到 %q", tt.filename, tt.wantTitle, ep.EpisodeTitle)
			}
			fmt.Printf("  ✓ %s → S%02dE%02d (title=%q)\n", tt.filename, ep.SeasonNum, ep.EpisodeNum, ep.EpisodeTitle)
		})
	}
}

// TestNormalizeSeriesName 测试目录名标准化系列名提取
func TestNormalizeSeriesName(t *testing.T) {
	s := &ScannerService{}

	tests := []struct {
		dirName string
		want    string
		desc    string
	}{
		{"一拳超人 S1", "一拳超人", "中文名+S1"},
		{"一拳超人 S2", "一拳超人", "中文名+S2"},
		{"Breaking Bad Season 1", "Breaking Bad", "英文名+Season 1"},
		{"Breaking Bad Season 2", "Breaking Bad", "英文名+Season 2"},
		{"一拳超人 第一季", "一拳超人", "中文名+第一季"},
		{"一拳超人 第二季", "一拳超人", "中文名+第二季"},
		{"一拳超人 第2季", "一拳超人", "中文名+第2季（数字）"},
		{"一拳超人", "一拳超人", "无季号标识"},
		{"Attack on Titan S3", "Attack on Titan", "英文名+S3"},
		{"进击的巨人 第三季", "进击的巨人", "中文名+第三季"},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			got := s.normalizeSeriesName(tt.dirName)
			if got != tt.want {
				t.Errorf("目录名: %q\n  期望: %q, 得到: %q", tt.dirName, tt.want, got)
			}
			fmt.Printf("  ✓ %q → %q\n", tt.dirName, got)
		})
	}
}

// TestExtractSeasonFromDirName 测试从目录名提取季号
func TestExtractSeasonFromDirName(t *testing.T) {
	s := &ScannerService{}

	tests := []struct {
		dirName string
		want    int
		desc    string
	}{
		{"一拳超人 S1", 1, "S1"},
		{"一拳超人 S02", 2, "S02"},
		{"Breaking Bad Season 3", 3, "Season 3"},
		{"一拳超人 第一季", 1, "第一季"},
		{"一拳超人 第二季", 2, "第二季"},
		{"一拳超人 第2季", 2, "第2季"},
		{"一拳超人", 0, "无季号"},
		{"Attack on Titan S10", 10, "S10"},
		{"进击的巨人 第三季", 3, "第三季"},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			got := s.extractSeasonFromDirName(tt.dirName)
			if got != tt.want {
				t.Errorf("目录名: %q\n  季号: 期望 %d, 得到 %d", tt.dirName, tt.want, got)
			}
			fmt.Printf("  ✓ %q → 季号 %d\n", tt.dirName, got)
		})
	}
}
