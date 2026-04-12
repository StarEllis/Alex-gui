//go:build windows

package service

import (
	"os"
	"syscall"
	"time"
)

func ResolveFileCreatedTime(info os.FileInfo) *time.Time {
	if info == nil {
		return nil
	}

	if data, ok := info.Sys().(*syscall.Win32FileAttributeData); ok {
		createdAt := time.Unix(0, data.CreationTime.Nanoseconds()).UTC().Truncate(time.Second)
		return &createdAt
	}

	fallback := info.ModTime().UTC().Truncate(time.Second)
	return &fallback
}
