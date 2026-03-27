package service

import (
	"testing"

	"github.com/nowen-video/nowen-video/internal/config"
)

// ==================== AI 搜索意图解析测试 ====================

func TestCleanJSONResponse(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "纯 JSON",
			input:    `{"query": "三体", "media_type": "movie"}`,
			expected: `{"query": "三体", "media_type": "movie"}`,
		},
		{
			name:     "Markdown 代码块包裹",
			input:    "```json\n{\"query\": \"三体\"}\n```",
			expected: `{"query": "三体"}`,
		},
		{
			name:     "前后有多余文字",
			input:    "这是搜索结果：{\"query\": \"三体\"} 以上是结果",
			expected: `{"query": "三体"}`,
		},
		{
			name:     "多余空白",
			input:    "  \n  {\"query\": \"test\"}  \n  ",
			expected: `{"query": "test"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := cleanJSONResponse(tt.input)
			if result != tt.expected {
				t.Errorf("cleanJSONResponse() = %q, 期望 %q", result, tt.expected)
			}
		})
	}
}

func TestSearchIntentFormatDebug(t *testing.T) {
	intent := &SearchIntent{
		Query:     "三体",
		MediaType: "movie",
		Genre:     "科幻",
		YearMin:   2020,
		YearMax:   2025,
		MinRating: 8.0,
		SortBy:    "rating_desc",
	}

	debug := intent.FormatSearchIntentDebug()

	// 验证包含所有关键信息
	checks := []string{"三体", "movie", "科幻", "2020", "2025", "8.0", "rating_desc"}
	for _, check := range checks {
		found := false
		for i := 0; i < len(debug)-len(check)+1; i++ {
			if debug[i:i+len(check)] == check {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("FormatSearchIntentDebug() 缺少 %q, 输出: %s", check, debug)
		}
	}
}

func TestSearchIntentFormatDebug_Minimal(t *testing.T) {
	intent := &SearchIntent{
		Query: "test",
	}

	debug := intent.FormatSearchIntentDebug()
	if debug == "" {
		t.Error("FormatSearchIntentDebug() 不应返回空字符串")
	}
}

// ==================== AI 缓存测试 ====================

func TestAICache_MemoryLayer(t *testing.T) {
	svc := &AIService{
		cache:  make(map[string]*aiCacheEntry),
		cfg:    testAIConfig(),
		logger: testLogger(),
	}

	// 写入缓存
	svc.SetCache("test_key", "test_value")

	// 读取缓存
	val, ok := svc.GetCache("test_key")
	if !ok {
		t.Error("缓存应命中")
	}
	if val != "test_value" {
		t.Errorf("缓存值 = %q, 期望 %q", val, "test_value")
	}

	// 读取不存在的键
	_, ok = svc.GetCache("nonexistent")
	if ok {
		t.Error("不存在的键不应命中缓存")
	}
}

func TestAICache_ClearCache(t *testing.T) {
	svc := &AIService{
		cache:  make(map[string]*aiCacheEntry),
		cfg:    testAIConfig(),
		logger: testLogger(),
	}

	// 写入多条缓存
	svc.SetCache("key1", "value1")
	svc.SetCache("key2", "value2")
	svc.SetCache("key3", "value3")

	// 清空缓存
	count := svc.ClearCache()
	if count != 3 {
		t.Errorf("清空缓存返回 %d, 期望 3", count)
	}

	// 验证缓存已清空
	_, ok := svc.GetCache("key1")
	if ok {
		t.Error("清空后缓存不应命中")
	}
}

func TestAICache_Stats(t *testing.T) {
	svc := &AIService{
		cache:  make(map[string]*aiCacheEntry),
		cfg:    testAIConfig(),
		logger: testLogger(),
	}

	svc.SetCache("key1", "value1")
	svc.SetCache("key2", "value2")

	stats := svc.GetCacheStats()
	memTotal, ok := stats["memory_total"].(int)
	if !ok || memTotal != 2 {
		t.Errorf("缓存统计 memory_total = %v, 期望 2", stats["memory_total"])
	}
}

// ==================== 辅助函数 ====================

func testAIConfig() config.AIConfig {
	return config.AIConfig{
		Enabled:       false,
		CacheTTLHours: 24,
	}
}
