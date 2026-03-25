package service

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"go.uber.org/zap"
)

// ==================== VFS 虚拟文件系统接口 ====================
// 抽象文件系统访问，为未来支持 WebDAV / 网盘 / SMB 等远程存储预留扩展接口

// VFSFile 虚拟文件接口
type VFSFile interface {
	io.ReadCloser
	io.ReaderAt
	Stat() (fs.FileInfo, error)
}

// VFS 虚拟文件系统接口
type VFS interface {
	// Open 打开文件
	Open(path string) (VFSFile, error)
	// ReadDir 读取目录内容
	ReadDir(path string) ([]fs.DirEntry, error)
	// Stat 获取文件信息
	Stat(path string) (fs.FileInfo, error)
	// Walk 递归遍历目录
	Walk(root string, fn filepath.WalkFunc) error
	// Type 返回文件系统类型标识
	Type() string
}

// ==================== 本地文件系统实现 ====================

// LocalFS 本地文件系统
type LocalFS struct {
	logger *zap.SugaredLogger
}

// localFile 本地文件（实现 VFSFile 接口）
type localFile struct {
	*os.File
}

func (f *localFile) ReadAt(p []byte, off int64) (n int, err error) {
	return f.File.ReadAt(p, off)
}

func NewLocalFS(logger *zap.SugaredLogger) *LocalFS {
	return &LocalFS{logger: logger}
}

func (lfs *LocalFS) Open(path string) (VFSFile, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	return &localFile{File: f}, nil
}

func (lfs *LocalFS) ReadDir(path string) ([]fs.DirEntry, error) {
	return os.ReadDir(path)
}

func (lfs *LocalFS) Stat(path string) (fs.FileInfo, error) {
	return os.Stat(path)
}

func (lfs *LocalFS) Walk(root string, fn filepath.WalkFunc) error {
	return filepath.Walk(root, fn)
}

func (lfs *LocalFS) Type() string {
	return "local"
}

// ==================== WebDAV 文件系统（预留实现） ====================

// WebDAVFS WebDAV 远程文件系统
type WebDAVFS struct {
	ServerURL string
	Username  string
	Password  string
	logger    *zap.SugaredLogger
}

func NewWebDAVFS(serverURL, username, password string, logger *zap.SugaredLogger) *WebDAVFS {
	return &WebDAVFS{
		ServerURL: strings.TrimRight(serverURL, "/"),
		Username:  username,
		Password:  password,
		logger:    logger,
	}
}

func (wfs *WebDAVFS) Open(path string) (VFSFile, error) {
	// TODO: 实现 WebDAV 文件读取
	return nil, fmt.Errorf("WebDAV Open 尚未实现")
}

func (wfs *WebDAVFS) ReadDir(path string) ([]fs.DirEntry, error) {
	// TODO: 实现 WebDAV 目录列表
	return nil, fmt.Errorf("WebDAV ReadDir 尚未实现")
}

func (wfs *WebDAVFS) Stat(path string) (fs.FileInfo, error) {
	// TODO: 实现 WebDAV 文件信息
	return nil, fmt.Errorf("WebDAV Stat 尚未实现")
}

func (wfs *WebDAVFS) Walk(root string, fn filepath.WalkFunc) error {
	// TODO: 实现 WebDAV 递归遍历
	return fmt.Errorf("WebDAV Walk 尚未实现")
}

func (wfs *WebDAVFS) Type() string {
	return "webdav"
}

// ==================== VFS 管理器 ====================

// VFSManager 管理多个文件系统实例
type VFSManager struct {
	filesystems map[string]VFS // libraryID -> VFS
	defaultFS   VFS            // 默认本地文件系统
	logger      *zap.SugaredLogger
}

func NewVFSManager(logger *zap.SugaredLogger) *VFSManager {
	return &VFSManager{
		filesystems: make(map[string]VFS),
		defaultFS:   NewLocalFS(logger),
		logger:      logger,
	}
}

// GetFS 获取指定媒体库的文件系统
func (m *VFSManager) GetFS(libraryID string) VFS {
	if vfs, ok := m.filesystems[libraryID]; ok {
		return vfs
	}
	return m.defaultFS
}

// RegisterFS 为指定媒体库注册文件系统
func (m *VFSManager) RegisterFS(libraryID string, vfs VFS) {
	m.filesystems[libraryID] = vfs
	m.logger.Infof("已注册 VFS: 媒体库=%s, 类型=%s", libraryID, vfs.Type())
}

// UnregisterFS 取消注册
func (m *VFSManager) UnregisterFS(libraryID string) {
	delete(m.filesystems, libraryID)
}

// GetDefault 获取默认文件系统（本地）
func (m *VFSManager) GetDefault() VFS {
	return m.defaultFS
}
