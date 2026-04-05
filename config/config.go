package config

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
			FFprobePath: "ffprobe", // Default system path
			FFmpegPath:  "ffmpeg",  // Default system path
		},
		Cache: CacheConfig{
			CacheDir: "cache",
		},
	}
}
