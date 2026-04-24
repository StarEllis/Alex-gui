//go:build !windows

package main

import "context"

type desktopIntegration struct{}

func newDesktopIntegration(_ *App) *desktopIntegration {
	return &desktopIntegration{}
}

func (a *App) syncDesktopIntegration(_ *DesktopSettings) error {
	return nil
}

func (a *App) beforeClose(_ context.Context) bool {
	return false
}

func (a *App) shutdownDesktopIntegration() {
}
