package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

// AppConfig defines the application configuration.
type AppConfig struct {
	FFprobePath string
	FFmpegPath  string
}

// CacheConfig defines the cache directory.
type CacheConfig struct {
	CacheDir string
}

// Config is a minimal shim for scanner.go compilation.
type Config struct {
	App   AppConfig
	Cache CacheConfig
}

// NewConfig creates a minimal configuration structure.
func NewConfig() *Config {
	return &Config{
		App: AppConfig{
			FFprobePath: resolveBinaryPath("ALEX_FFPROBE_PATH", "ffprobe_path", `C:\ffmpeg\bin\ffprobe.exe`, "ffprobe"),
			FFmpegPath:  resolveBinaryPath("ALEX_FFMPEG_PATH", "ffmpeg_path", `C:\ffmpeg\bin\ffmpeg.exe`, "ffmpeg"),
		},
		Cache: CacheConfig{
			CacheDir: "cache",
		},
	}
}

func resolveBinaryPath(envKey string, yamlKey string, fallbackPath string, fallbackName string) string {
	if value := strings.TrimSpace(os.Getenv(envKey)); value != "" {
		return value
	}

	if value := strings.TrimSpace(readSimpleYAMLValue(filepath.Join("config", "app.yaml"), yamlKey)); value != "" {
		return value
	}

	if _, err := os.Stat(fallbackPath); err == nil {
		return fallbackPath
	}

	return fallbackName
}

func readSimpleYAMLValue(path string, key string) string {
	file, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer file.Close()

	prefix := key + ":"
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || !strings.HasPrefix(line, prefix) {
			continue
		}

		value := strings.TrimSpace(strings.TrimPrefix(line, prefix))
		value = strings.Trim(value, `"'`)
		return value
	}

	return ""
}
