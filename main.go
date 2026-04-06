package main

import (
	"embed"
	"net/http"
	"net/url"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

type LocalFileHandler struct{}

func (h *LocalFileHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/local/") {
		filePath := strings.TrimPrefix(r.URL.Path, "/local/")
		if unescaped, err := url.PathUnescape(filePath); err == nil {
			filePath = unescaped
		}
		http.ServeFile(w, r, filePath)
		return
	}
	w.WriteHeader(http.StatusNotFound)
}

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "alex-desktop",
		Width:            1090,
		Height:           770,
		MinWidth:         1090,
		MinHeight:        770,
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: &LocalFileHandler{},
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
