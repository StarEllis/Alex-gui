//go:build windows

package main

import (
	"testing"
	"time"
)

func TestBuildStartupCommand(t *testing.T) {
	got := buildStartupCommand(`C:\Program Files\Navi\Navi.exe`)
	want := `"C:\Program Files\Navi\Navi.exe"`
	if got != want {
		t.Fatalf("buildStartupCommand() = %q, want %q", got, want)
	}
}

func TestIsTemporaryExecutablePath(t *testing.T) {
	testCases := []struct {
		path string
		want bool
	}{
		{path: `C:\Users\Philo\AppData\Local\Temp\go-build123\Navi.exe`, want: true},
		{path: `C:\Users\Philo\AppData\Local\Temp\wails\temp\Navi.exe`, want: true},
		{path: `C:\Program Files\Navi\Navi.exe`, want: false},
	}

	for _, testCase := range testCases {
		if got := isTemporaryExecutablePath(testCase.path); got != testCase.want {
			t.Fatalf("isTemporaryExecutablePath(%q) = %v, want %v", testCase.path, got, testCase.want)
		}
	}
}

func TestNewTrayIconLifecycle(t *testing.T) {
	tray, err := newTrayIcon(nil, nil)
	if err != nil {
		t.Fatalf("newTrayIcon() error = %v", err)
	}

	time.Sleep(150 * time.Millisecond)

	if err := tray.Close(); err != nil {
		t.Fatalf("tray.Close() error = %v", err)
	}
}

func TestTrayNotificationEventCodeUsesLoword(t *testing.T) {
	if got := loword(0x00010202); got != wmLButtonUp {
		t.Fatalf("loword(0x00010202) = %#x, want %#x", got, wmLButtonUp)
	}

	if got := loword(0x0001007B); got != wmContextMenu {
		t.Fatalf("loword(0x0001007B) = %#x, want %#x", got, wmContextMenu)
	}
}
