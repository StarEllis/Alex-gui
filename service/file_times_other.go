//go:build !windows

package service

import (
	"os"
	"time"
)

func ResolveFileCreatedTime(info os.FileInfo) *time.Time {
	if info == nil {
		return nil
	}

	fallback := info.ModTime().UTC().Truncate(time.Second)
	return &fallback
}
