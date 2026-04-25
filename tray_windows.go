//go:build windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"syscall"
	"unsafe"
)

const (
	trayWindowClassName = "NaviDesktopTrayWindow"

	wmApp         = 0x8000
	wmCommand     = 0x0111
	wmDestroy     = 0x0002
	wmClose       = 0x0010
	wmNull        = 0x0000
	wmContextMenu = 0x007B
	wmLButtonUp   = 0x0202
	wmLButtonDbl  = 0x0203
	wmRButtonUp   = 0x0205

	wmTrayIcon = wmApp + 1
	wmTrayQuit = wmApp + 2

	nimAdd        = 0x00000000
	nimModify     = 0x00000001
	nimDelete     = 0x00000002
	nimSetVersion = 0x00000004

	nifMessage = 0x00000001
	nifIcon    = 0x00000002
	nifTip     = 0x00000004
	nifShowTip = 0x00000080

	imageIcon      = 1
	lrLoadFromFile = 0x00000010
	lrDefaultSize  = 0x00000040

	mfString    = 0x00000000
	mfSeparator = 0x00000800

	tpmLeftAlign   = 0x0000
	tpmBottomAlign = 0x0020
	tpmRightButton = 0x0002

	trayCommandShow = 1001
	trayCommandExit = 1002

	notifyIconVersion4 = 4
	idiApplication     = 32512
)

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	shell32  = syscall.NewLazyDLL("shell32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")

	procAppendMenuW         = user32.NewProc("AppendMenuW")
	procCreatePopupMenu     = user32.NewProc("CreatePopupMenu")
	procCreateWindowExW     = user32.NewProc("CreateWindowExW")
	procDefWindowProcW      = user32.NewProc("DefWindowProcW")
	procDestroyIcon         = user32.NewProc("DestroyIcon")
	procDestroyMenu         = user32.NewProc("DestroyMenu")
	procDestroyWindow       = user32.NewProc("DestroyWindow")
	procDispatchMessageW    = user32.NewProc("DispatchMessageW")
	procExtractIconExW      = shell32.NewProc("ExtractIconExW")
	procGetCursorPos        = user32.NewProc("GetCursorPos")
	procGetMessageW         = user32.NewProc("GetMessageW")
	procGetModuleHandleW    = kernel32.NewProc("GetModuleHandleW")
	procLoadIconW           = user32.NewProc("LoadIconW")
	procLoadImageW          = user32.NewProc("LoadImageW")
	procPostMessageW        = user32.NewProc("PostMessageW")
	procPostQuitMessage     = user32.NewProc("PostQuitMessage")
	procRegisterClassExW    = user32.NewProc("RegisterClassExW")
	procSetForegroundWindow = user32.NewProc("SetForegroundWindow")
	procTrackPopupMenu      = user32.NewProc("TrackPopupMenu")
	procTranslateMessage    = user32.NewProc("TranslateMessage")

	procShellNotifyIconW = shell32.NewProc("Shell_NotifyIconW")

	trayWndProcCallback = syscall.NewCallback(trayWindowProc)

	trayWindowClassOnce sync.Once
	trayWindowClassErr  error
	trayWindows         sync.Map
)

type trayIcon struct {
	onShow func()
	onExit func()

	hwnd uintptr
	icon uintptr
	menu uintptr

	ready chan error
	done  chan struct{}
}

type trayPoint struct {
	X int32
	Y int32
}

type trayMessage struct {
	HWnd     uintptr
	Message  uint32
	WParam   uintptr
	LParam   uintptr
	Time     uint32
	Pt       trayPoint
	LPrivate uint32
}

type trayWindowClassEx struct {
	Size       uint32
	Style      uint32
	WndProc    uintptr
	ClsExtra   int32
	WndExtra   int32
	Instance   uintptr
	Icon       uintptr
	Cursor     uintptr
	Background uintptr
	MenuName   *uint16
	ClassName  *uint16
	IconSm     uintptr
}

type trayNotifyIconData struct {
	CbSize            uint32
	HWnd              uintptr
	UID               uint32
	UFlags            uint32
	UCallbackMessage  uint32
	HIcon             uintptr
	SzTip             [128]uint16
	DwState           uint32
	DwStateMask       uint32
	SzInfo            [256]uint16
	UTimeoutOrVersion uint32
	SzInfoTitle       [64]uint16
	DwInfoFlags       uint32
	GuidItem          [16]byte
	HBalloonIcon      uintptr
}

func newTrayIcon(onShow func(), onExit func()) (*trayIcon, error) {
	result := &trayIcon{
		onShow: onShow,
		onExit: onExit,
		ready:  make(chan error, 1),
		done:   make(chan struct{}),
	}

	go result.run()

	if err := <-result.ready; err != nil {
		return nil, err
	}

	return result, nil
}

func (t *trayIcon) run() {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	hwnd, iconHandle, menuHandle, err := t.createNativeTray()
	if err != nil {
		t.ready <- err
		close(t.done)
		return
	}

	t.hwnd = hwnd
	t.icon = iconHandle
	t.menu = menuHandle
	trayWindows.Store(hwnd, t)
	t.ready <- nil

	var message trayMessage
	for {
		ret, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&message)), 0, 0, 0)
		switch int32(ret) {
		case -1:
			t.cleanup()
			close(t.done)
			return
		case 0:
			t.cleanup()
			close(t.done)
			return
		default:
			procTranslateMessage.Call(uintptr(unsafe.Pointer(&message)))
			procDispatchMessageW.Call(uintptr(unsafe.Pointer(&message)))
		}
	}
}

func (t *trayIcon) Close() error {
	if t == nil || t.hwnd == 0 {
		return nil
	}

	if ok, _, err := procPostMessageW.Call(t.hwnd, wmTrayQuit, 0, 0); ok == 0 {
		return err
	}

	<-t.done
	return nil
}

func (t *trayIcon) createNativeTray() (uintptr, uintptr, uintptr, error) {
	instance, _, err := procGetModuleHandleW.Call(0)
	if instance == 0 {
		return 0, 0, 0, fmt.Errorf("get module handle: %w", err)
	}

	if err := registerTrayWindowClass(instance); err != nil {
		return 0, 0, 0, err
	}

	className, _ := syscall.UTF16PtrFromString(trayWindowClassName)
	windowTitle, _ := syscall.UTF16PtrFromString("Navi")
	hwnd, _, err := procCreateWindowExW.Call(
		0,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(windowTitle)),
		0,
		0, 0, 0, 0,
		0, 0, instance, 0,
	)
	if hwnd == 0 {
		return 0, 0, 0, fmt.Errorf("create tray window: %w", err)
	}

	iconHandle := loadTrayIcon()
	if iconHandle == 0 {
		procDestroyWindow.Call(hwnd)
		return 0, 0, 0, fmt.Errorf("load tray icon failed")
	}

	menuHandle, _, err := procCreatePopupMenu.Call()
	if menuHandle == 0 {
		procDestroyIcon.Call(iconHandle)
		procDestroyWindow.Call(hwnd)
		return 0, 0, 0, fmt.Errorf("create tray menu: %w", err)
	}

	if err := appendTrayMenuItem(menuHandle, mfString, trayCommandShow, "打开 Navi"); err != nil {
		procDestroyMenu.Call(menuHandle)
		procDestroyIcon.Call(iconHandle)
		procDestroyWindow.Call(hwnd)
		return 0, 0, 0, err
	}
	if _, _, err := procAppendMenuW.Call(menuHandle, mfSeparator, 0, 0); err != syscall.Errno(0) {
		// ignore separator append error and continue with a simpler menu
	}
	if err := appendTrayMenuItem(menuHandle, mfString, trayCommandExit, "退出"); err != nil {
		procDestroyMenu.Call(menuHandle)
		procDestroyIcon.Call(iconHandle)
		procDestroyWindow.Call(hwnd)
		return 0, 0, 0, err
	}

	if err := addTrayIcon(hwnd, iconHandle); err != nil {
		procDestroyMenu.Call(menuHandle)
		procDestroyIcon.Call(iconHandle)
		procDestroyWindow.Call(hwnd)
		return 0, 0, 0, err
	}

	return hwnd, iconHandle, menuHandle, nil
}

func (t *trayIcon) cleanup() {
	if t.hwnd != 0 {
		removeTrayIcon(t.hwnd)
		trayWindows.Delete(t.hwnd)
	}
	if t.menu != 0 {
		procDestroyMenu.Call(t.menu)
		t.menu = 0
	}
	if t.icon != 0 {
		procDestroyIcon.Call(t.icon)
		t.icon = 0
	}
	t.hwnd = 0
}

func (t *trayIcon) handleMessage(hwnd uintptr, message uint32, wParam, lParam uintptr) uintptr {
	switch message {
	case wmCommand:
		switch loword(uintptrToUint32(wParam)) {
		case trayCommandShow:
			if t.onShow != nil {
				go t.onShow()
			}
			return 0
		case trayCommandExit:
			if t.onExit != nil {
				go t.onExit()
			}
			return 0
		}
	case wmTrayIcon:
		switch loword(uintptrToUint32(lParam)) {
		case wmLButtonUp, wmLButtonDbl:
			if t.onShow != nil {
				go t.onShow()
			}
			return 0
		case wmRButtonUp, wmContextMenu:
			t.showContextMenu(hwnd)
			return 0
		}
	case wmTrayQuit:
		procDestroyWindow.Call(hwnd)
		return 0
	case wmClose:
		procDestroyWindow.Call(hwnd)
		return 0
	case wmDestroy:
		procPostQuitMessage.Call(0)
		return 0
	}

	result, _, _ := procDefWindowProcW.Call(hwnd, uintptr(message), wParam, lParam)
	return result
}

func (t *trayIcon) showContextMenu(hwnd uintptr) {
	if hwnd == 0 || t.menu == 0 {
		return
	}

	var cursorPos trayPoint
	if ok, _, _ := procGetCursorPos.Call(uintptr(unsafe.Pointer(&cursorPos))); ok == 0 {
		return
	}

	procSetForegroundWindow.Call(hwnd)
	procTrackPopupMenu.Call(
		t.menu,
		tpmLeftAlign|tpmBottomAlign|tpmRightButton,
		uintptr(cursorPos.X),
		uintptr(cursorPos.Y),
		0,
		hwnd,
		0,
	)
	procPostMessageW.Call(hwnd, wmNull, 0, 0)
}

func trayWindowProc(hwnd uintptr, message uint32, wParam, lParam uintptr) uintptr {
	if value, ok := trayWindows.Load(hwnd); ok {
		return value.(*trayIcon).handleMessage(hwnd, message, wParam, lParam)
	}

	if message == wmDestroy {
		procPostQuitMessage.Call(0)
		return 0
	}

	result, _, _ := procDefWindowProcW.Call(hwnd, uintptr(message), wParam, lParam)
	return result
}

func registerTrayWindowClass(instance uintptr) error {
	trayWindowClassOnce.Do(func() {
		className, _ := syscall.UTF16PtrFromString(trayWindowClassName)
		windowClass := trayWindowClassEx{
			Size:      uint32(unsafe.Sizeof(trayWindowClassEx{})),
			WndProc:   trayWndProcCallback,
			Instance:  instance,
			ClassName: className,
		}

		atom, _, err := procRegisterClassExW.Call(uintptr(unsafe.Pointer(&windowClass)))
		if atom == 0 && err != syscall.Errno(1410) {
			trayWindowClassErr = fmt.Errorf("register tray window class: %w", err)
		}
	})

	return trayWindowClassErr
}

func appendTrayMenuItem(menuHandle uintptr, flags uintptr, itemID uintptr, title string) error {
	titlePtr, _ := syscall.UTF16PtrFromString(title)
	if ok, _, err := procAppendMenuW.Call(menuHandle, flags, itemID, uintptr(unsafe.Pointer(titlePtr))); ok == 0 {
		return fmt.Errorf("append tray menu item %q: %w", title, err)
	}
	return nil
}

func addTrayIcon(hwnd uintptr, iconHandle uintptr) error {
	var notifyIcon trayNotifyIconData
	notifyIcon.CbSize = uint32(unsafe.Sizeof(trayNotifyIconData{}))
	notifyIcon.HWnd = hwnd
	notifyIcon.UID = 1
	notifyIcon.UFlags = nifMessage | nifIcon | nifTip | nifShowTip
	notifyIcon.UCallbackMessage = wmTrayIcon
	notifyIcon.HIcon = iconHandle
	copy(notifyIcon.SzTip[:], syscall.StringToUTF16("Navi"))

	if ok, _, err := procShellNotifyIconW.Call(nimAdd, uintptr(unsafe.Pointer(&notifyIcon))); ok == 0 {
		return fmt.Errorf("add tray icon: %w", err)
	}

	notifyIcon.UTimeoutOrVersion = notifyIconVersion4
	procShellNotifyIconW.Call(nimSetVersion, uintptr(unsafe.Pointer(&notifyIcon)))
	return nil
}

func removeTrayIcon(hwnd uintptr) {
	var notifyIcon trayNotifyIconData
	notifyIcon.CbSize = uint32(unsafe.Sizeof(trayNotifyIconData{}))
	notifyIcon.HWnd = hwnd
	notifyIcon.UID = 1
	procShellNotifyIconW.Call(nimDelete, uintptr(unsafe.Pointer(&notifyIcon)))
}

func loadTrayIcon() uintptr {
	if iconPath := resolveTrayIconPath(); iconPath != "" {
		if iconPtr, err := syscall.UTF16PtrFromString(iconPath); err == nil {
			if iconHandle, _, _ := procLoadImageW.Call(0, uintptr(unsafe.Pointer(iconPtr)), imageIcon, 0, 0, lrLoadFromFile|lrDefaultSize); iconHandle != 0 {
				return iconHandle
			}
		}
	}

	if executablePath, err := os.Executable(); err == nil {
		if iconHandle := extractExecutableIcon(executablePath); iconHandle != 0 {
			return iconHandle
		}
	}

	iconHandle, _, _ := procLoadIconW.Call(0, idiApplication)
	return iconHandle
}

func extractExecutableIcon(executablePath string) uintptr {
	if executablePath == "" {
		return 0
	}

	iconPath, err := syscall.UTF16PtrFromString(executablePath)
	if err != nil {
		return 0
	}

	var largeIcon uintptr
	var smallIcon uintptr
	count, _, _ := procExtractIconExW.Call(
		uintptr(unsafe.Pointer(iconPath)),
		0,
		uintptr(unsafe.Pointer(&largeIcon)),
		uintptr(unsafe.Pointer(&smallIcon)),
		1,
	)
	if count == 0 {
		return 0
	}

	if smallIcon != 0 {
		if largeIcon != 0 {
			procDestroyIcon.Call(largeIcon)
		}
		return smallIcon
	}

	return largeIcon
}

func resolveTrayIconPath() string {
	candidates := make([]string, 0, 4)

	if workingDir, err := os.Getwd(); err == nil {
		candidates = append(candidates, filepath.Join(workingDir, "build", "windows", "icon.ico"))
	}

	if executablePath, err := resolveStartupExecutablePath(); err == nil {
		executableDir := filepath.Dir(executablePath)
		candidates = append(candidates,
			filepath.Join(executableDir, "icon.ico"),
			filepath.Join(executableDir, "..", "windows", "icon.ico"),
			filepath.Join(executableDir, "..", "build", "windows", "icon.ico"),
		)
	}

	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			if absolutePath, absErr := filepath.Abs(candidate); absErr == nil {
				return absolutePath
			}
			return candidate
		}
	}

	return ""
}

func loword(value uint32) uintptr {
	return uintptr(value & 0xffff)
}

func uintptrToUint32(value uintptr) uint32 {
	return uint32(value & 0xffffffff)
}
