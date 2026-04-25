//go:build windows

package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/sys/windows/registry"
)

const (
	startupRegistryKey       = `Software\Microsoft\Windows\CurrentVersion\Run`
	startupRegistryValueName = "Navi"
)

type desktopIntegration struct {
	app *App

	mu        sync.Mutex
	allowQuit bool
	tray      *trayIcon
}

func newDesktopIntegration(app *App) *desktopIntegration {
	return &desktopIntegration{app: app}
}

func (a *App) syncDesktopIntegration(settings *DesktopSettings) error {
	if a.desktop == nil || settings == nil {
		return nil
	}
	return a.desktop.sync(settings)
}

func (a *App) beforeClose(ctx context.Context) bool {
	if a.desktop == nil {
		return false
	}
	return a.desktop.beforeClose(ctx)
}

func (a *App) shutdownDesktopIntegration() {
	if a.desktop == nil {
		return
	}
	a.desktop.shutdown()
}

func (d *desktopIntegration) sync(settings *DesktopSettings) error {
	if settings == nil {
		return nil
	}

	if err := syncWindowsStartupSetting(settings.StartWithOS); err != nil {
		return err
	}

	if !settings.MinToTray {
		d.hideTray()
	}

	return nil
}

func (d *desktopIntegration) beforeClose(ctx context.Context) bool {
	d.mu.Lock()
	if d.allowQuit {
		d.allowQuit = false
		d.mu.Unlock()
		return false
	}
	d.mu.Unlock()

	settings, err := d.app.GetDesktopSettings()
	if err != nil || settings == nil || !settings.MinToTray {
		return false
	}

	if err := d.ensureTray(); err != nil {
		if d.app.logger != nil {
			d.app.logger.Warnf("enable tray failed: %v", err)
		}
		return false
	}

	wailsRuntime.WindowHide(ctx)
	return true
}

func (d *desktopIntegration) shutdown() {
	d.hideTray()
}

func (d *desktopIntegration) ensureTray() error {
	d.mu.Lock()
	if d.tray != nil {
		d.mu.Unlock()
		return nil
	}
	d.mu.Unlock()

	tray, err := newTrayIcon(
		func() {
			d.restoreFromTray()
		},
		func() {
			d.quitFromTray()
		},
	)
	if err != nil {
		return err
	}

	d.mu.Lock()
	if d.tray != nil {
		d.mu.Unlock()
		_ = tray.Close()
		return nil
	}
	d.tray = tray
	d.mu.Unlock()

	return nil
}

func (d *desktopIntegration) hideTray() {
	d.mu.Lock()
	tray := d.tray
	d.tray = nil
	d.mu.Unlock()

	if tray != nil {
		_ = tray.Close()
	}
}

func (d *desktopIntegration) restoreFromTray() {
	if d.app == nil || d.app.ctx == nil {
		return
	}
	wailsRuntime.WindowShow(d.app.ctx)
	wailsRuntime.WindowUnminimise(d.app.ctx)
	d.hideTray()
}

func (d *desktopIntegration) quitFromTray() {
	d.mu.Lock()
	d.allowQuit = true
	d.mu.Unlock()

	d.hideTray()

	if d.app == nil || d.app.ctx == nil {
		return
	}
	wailsRuntime.Quit(d.app.ctx)
}

func syncWindowsStartupSetting(enabled bool) error {
	key, _, err := registry.CreateKey(registry.CURRENT_USER, startupRegistryKey, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("open startup registry key: %w", err)
	}
	defer key.Close()

	if !enabled {
		err := key.DeleteValue(startupRegistryValueName)
		if err != nil && !errors.Is(err, registry.ErrNotExist) {
			return fmt.Errorf("remove startup entry: %w", err)
		}
		return nil
	}

	executablePath, err := resolveStartupExecutablePath()
	if err != nil {
		return err
	}

	if err := key.SetStringValue(startupRegistryValueName, buildStartupCommand(executablePath)); err != nil {
		return fmt.Errorf("write startup entry: %w", err)
	}

	return nil
}

func resolveStartupExecutablePath() (string, error) {
	executablePath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("resolve executable path: %w", err)
	}

	if resolved, resolveErr := filepath.EvalSymlinks(executablePath); resolveErr == nil && strings.TrimSpace(resolved) != "" {
		executablePath = resolved
	}

	executablePath = filepath.Clean(executablePath)
	if !isTemporaryExecutablePath(executablePath) {
		return executablePath, nil
	}

	if workingDir, wdErr := os.Getwd(); wdErr == nil {
		candidate := filepath.Join(workingDir, "build", "bin", "Navi.exe")
		if info, statErr := os.Stat(candidate); statErr == nil && !info.IsDir() {
			if absolutePath, absErr := filepath.Abs(candidate); absErr == nil {
				return absolutePath, nil
			}
			return filepath.Clean(candidate), nil
		}
	}

	return executablePath, nil
}

func buildStartupCommand(executablePath string) string {
	return `"` + strings.TrimSpace(executablePath) + `"`
}

func isTemporaryExecutablePath(executablePath string) bool {
	normalizedPath := strings.ToLower(filepath.Clean(strings.TrimSpace(executablePath)))
	if normalizedPath == "" {
		return false
	}

	tempDir := strings.ToLower(filepath.Clean(os.TempDir()))
	if tempDir != "" && (normalizedPath == tempDir || strings.HasPrefix(normalizedPath, tempDir+`\`)) {
		return true
	}

	return strings.Contains(normalizedPath, `\go-build\`) || strings.Contains(normalizedPath, `\wails\temp\`)
}
