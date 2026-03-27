import { useState, useEffect, useCallback } from 'react'
import { embyCompatApi } from '@/api'
import type { EmbyDetectResult, EmbyScannedItem, EmbyImportResult, EmbyImportRequest } from '@/api/emby'
import {
  FolderOpen, Search, Upload, Loader2, CheckCircle, AlertCircle,
  X, Film, Tv, FileText, Image, Subtitles, ChevronDown, ChevronRight,
  Info, Settings, ArrowRight, RefreshCw,
} from 'lucide-react'
import clsx from 'clsx'

interface EmbyImportPanelProps {
  libraries: { id: string; name: string }[]
  onClose: () => void
  onImportComplete?: () => void
}

type Phase = 'detect' | 'select' | 'config' | 'importing' | 'result'

export default function EmbyImportPanel({ libraries, onClose, onImportComplete }: EmbyImportPanelProps) {
  const [phase, setPhase] = useState<Phase>('detect')
  const [rootPath, setRootPath] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [detectResult, setDetectResult] = useState<EmbyDetectResult | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [targetLibraryId, setTargetLibraryId] = useState(libraries[0]?.id || '')
  const [importMode, setImportMode] = useState<'full' | 'incremental'>('incremental')
  const [importNFO, setImportNFO] = useState(true)
  const [importImages, setImportImages] = useState(true)
  const [importProgress, setImportProgress] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<EmbyImportResult | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 检测 EMBY 格式
  const handleDetect = useCallback(async () => {
    if (!rootPath.trim()) return
    setDetecting(true)
    setMessage(null)
    try {
      const res = await embyCompatApi.detect(rootPath.trim())
      const result = res.data.data
      setDetectResult(result)
      if (result.is_emby_format) {
        // 默认全选
        const allPaths = new Set<string>()
        result.movies?.forEach(m => allPaths.add(m.path))
        result.tvshows?.forEach(t => allPaths.add(t.path))
        setSelectedPaths(allPaths)
        setPhase('select')
      } else {
        setMessage({ type: 'error', text: `未检测到有效的 EMBY 媒体库格式（置信度: ${Math.round(result.confidence * 100)}%）` })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || '检测失败' })
    } finally {
      setDetecting(false)
    }
  }, [rootPath])

  // 切换选择
  const toggleSelect = (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (!detectResult) return
    const allPaths = [
      ...(detectResult.movies || []).map(m => m.path),
      ...(detectResult.tvshows || []).map(t => t.path),
    ]
    if (selectedPaths.size === allPaths.length) {
      setSelectedPaths(new Set())
    } else {
      setSelectedPaths(new Set(allPaths))
    }
  }

  // 展开/折叠
  const toggleExpand = (path: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // 开始导入
  const handleImport = async () => {
    if (!targetLibraryId || selectedPaths.size === 0) return
    setImporting(true)
    setPhase('importing')
    try {
      const req: EmbyImportRequest = {
        root_path: rootPath.trim(),
        target_library_id: targetLibraryId,
        import_mode: importMode,
        import_nfo: importNFO,
        import_images: importImages,
        import_progress: importProgress,
        selected_paths: Array.from(selectedPaths),
      }
      const res = await embyCompatApi.importLibrary(req)
      setImportResult(res.data.data)
      setPhase('result')
      onImportComplete?.()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || '导入失败' })
      setPhase('config')
    } finally {
      setImporting(false)
    }
  }

  // 获取文件夹类型标签
  const getFolderTypeLabel = (type: string) => {
    switch (type) {
      case 'movies': return '电影库'
      case 'tvshows': return '剧集库'
      case 'mixed': return '混合库'
      default: return '未知'
    }
  }

  // 渲染扫描项
  const renderScannedItem = (item: EmbyScannedItem) => {
    const isExpanded = expandedItems.has(item.path)
    const isSelected = selectedPaths.has(item.path)
    const isMovie = item.media_type === 'movie'

    return (
      <div key={item.path} className="rounded-xl overflow-hidden" style={{
        background: isSelected ? 'rgba(var(--neon-blue-rgb, 59, 130, 246), 0.05)' : 'transparent',
        border: `1px solid ${isSelected ? 'var(--neon-blue-15)' : 'rgba(255,255,255,0.05)'}`,
      }}>
        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
          onClick={() => toggleSelect(item.path)}>
          {/* 复选框 */}
          <div className={clsx(
            'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0',
            isSelected ? 'bg-neon-blue border-neon-blue' : 'border-surface-600'
          )}>
            {isSelected && <CheckCircle className="h-3.5 w-3.5 text-white" />}
          </div>

          {/* 图标 */}
          {isMovie ? (
            <Film className="h-5 w-5 text-neon-purple flex-shrink-0" />
          ) : (
            <Tv className="h-5 w-5 text-neon-blue flex-shrink-0" />
          )}

          {/* 标题 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white truncate">{item.title}</span>
              {item.year > 0 && <span className="text-xs text-surface-500">({item.year})</span>}
              {item.imported && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  已导入
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-surface-500">
              <span>{item.video_files?.length || 0} 个视频</span>
              {item.has_nfo && <span className="flex items-center gap-1"><FileText className="h-3 w-3" />NFO</span>}
              {item.poster_file && <span className="flex items-center gap-1"><Image className="h-3 w-3" />海报</span>}
              {item.subtitle_files?.length > 0 && (
                <span className="flex items-center gap-1"><Subtitles className="h-3 w-3" />{item.subtitle_files.length} 字幕</span>
              )}
              {item.seasons && item.seasons.length > 0 && (
                <span>{item.seasons.length} 季</span>
              )}
            </div>
          </div>

          {/* 展开按钮 */}
          {item.seasons && item.seasons.length > 0 && (
            <button onClick={e => { e.stopPropagation(); toggleExpand(item.path) }}
              className="text-surface-400 hover:text-white p-1">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* 季详情 */}
        {isExpanded && item.seasons && item.seasons.length > 0 && (
          <div className="px-4 pb-3 pl-14 space-y-1">
            {item.seasons.map(season => (
              <div key={season.season_num} className="flex items-center gap-2 text-xs text-surface-400">
                <span className="text-surface-500">第 {season.season_num} 季</span>
                <span>·</span>
                <span>{season.episodes} 集</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl" style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--neon-blue-15)',
        backdropFilter: 'blur(20px)',
      }}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <FolderOpen className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-white">EMBY 格式导入</h3>
              <p className="text-xs text-surface-500">自动识别 EMBY/Jellyfin 标准文件夹结构并导入</p>
            </div>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={clsx(
            'mx-6 mt-4 rounded-xl px-4 py-2.5 text-sm font-medium flex items-center gap-2',
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          )}>
            {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* ===== 阶段1: 检测 ===== */}
          {phase === 'detect' && (
            <div className="space-y-4">
              <div className="card-glass rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Search className="h-4 w-4 text-neon-blue" />
                  <h4 className="text-sm font-medium text-white">选择 EMBY 媒体库目录</h4>
                </div>
                <p className="text-xs text-surface-400 mb-4">
                  请输入 EMBY 媒体库的根目录路径。系统将自动识别标准的 EMBY 文件夹结构（Movies、TV Shows 等），
                  解析 NFO 元数据文件，并检测海报、字幕等关联资源。
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={rootPath}
                    onChange={e => setRootPath(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleDetect()}
                    placeholder="例如: D:\Media 或 /mnt/media"
                    className="input-glass flex-1 rounded-lg px-4 py-2.5 text-sm"
                  />
                  <button
                    onClick={handleDetect}
                    disabled={detecting || !rootPath.trim()}
                    className="btn-neon rounded-lg px-5 py-2.5 text-sm font-medium flex items-center gap-2"
                  >
                    {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    检测
                  </button>
                </div>
              </div>

              {/* 支持的格式说明 */}
              <div className="card-glass rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-4 w-4 text-surface-400" />
                  <h4 className="text-sm font-medium text-surface-300">支持的文件夹结构</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs text-surface-400">
                  <div>
                    <p className="text-surface-300 font-medium mb-1">电影</p>
                    <code className="block bg-surface-800/50 rounded-lg p-2 font-mono leading-relaxed">
                      Movies/<br />
                      ├── 电影名 (2023)/<br />
                      │   ├── movie.mkv<br />
                      │   ├── movie.nfo<br />
                      │   └── poster.jpg<br />
                    </code>
                  </div>
                  <div>
                    <p className="text-surface-300 font-medium mb-1">剧集</p>
                    <code className="block bg-surface-800/50 rounded-lg p-2 font-mono leading-relaxed">
                      TV Shows/<br />
                      ├── 剧名/<br />
                      │   ├── tvshow.nfo<br />
                      │   ├── Season 01/<br />
                      │   │   └── S01E01.mkv<br />
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== 阶段2: 选择媒体 ===== */}
          {phase === 'select' && detectResult && (
            <div className="space-y-4">
              {/* 检测概览 */}
              <div className="card-glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <h4 className="text-sm font-medium text-white">
                      检测到 {getFolderTypeLabel(detectResult.folder_type)}
                    </h4>
                    <span className="text-xs text-surface-500">
                      置信度 {Math.round(detectResult.confidence * 100)}%
                    </span>
                  </div>
                  <button onClick={() => { setPhase('detect'); setDetectResult(null) }}
                    className="text-xs text-surface-400 hover:text-white flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> 重新检测
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: '电影', value: detectResult.movies?.length || 0, icon: Film, color: 'text-neon-purple' },
                    { label: '剧集', value: detectResult.tvshows?.length || 0, icon: Tv, color: 'text-neon-blue' },
                    { label: '视频', value: detectResult.video_files, icon: Film, color: 'text-surface-300' },
                    { label: 'NFO', value: detectResult.nfo_files, icon: FileText, color: 'text-yellow-400' },
                    { label: '图片', value: detectResult.image_files, icon: Image, color: 'text-green-400' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="text-center">
                      <Icon className={clsx('h-4 w-4 mx-auto mb-1', color)} />
                      <p className="text-lg font-semibold text-white">{value}</p>
                      <p className="text-[10px] text-surface-500">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 选择列表 */}
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-surface-300">
                  选择要导入的内容 ({selectedPaths.size} / {(detectResult.movies?.length || 0) + (detectResult.tvshows?.length || 0)})
                </h4>
                <button onClick={toggleSelectAll} className="text-xs text-neon-blue hover:text-neon-blue/80">
                  {selectedPaths.size === (detectResult.movies?.length || 0) + (detectResult.tvshows?.length || 0) ? '取消全选' : '全选'}
                </button>
              </div>

              {/* 电影列表 */}
              {detectResult.movies && detectResult.movies.length > 0 && (
                <div>
                  <h5 className="text-xs text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Film className="h-3.5 w-3.5" /> 电影 ({detectResult.movies.length})
                  </h5>
                  <div className="space-y-1.5">
                    {detectResult.movies.map(renderScannedItem)}
                  </div>
                </div>
              )}

              {/* 剧集列表 */}
              {detectResult.tvshows && detectResult.tvshows.length > 0 && (
                <div>
                  <h5 className="text-xs text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Tv className="h-3.5 w-3.5" /> 剧集 ({detectResult.tvshows.length})
                  </h5>
                  <div className="space-y-1.5">
                    {detectResult.tvshows.map(renderScannedItem)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== 阶段3: 导入配置 ===== */}
          {phase === 'config' && (
            <div className="space-y-4">
              <div className="card-glass rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="h-4 w-4 text-neon-purple" />
                  <h4 className="text-sm font-medium text-white">导入配置</h4>
                </div>

                <div className="space-y-4">
                  {/* 目标媒体库 */}
                  <div>
                    <label className="text-xs text-surface-400 mb-1 block">目标媒体库</label>
                    <select value={targetLibraryId}
                      onChange={e => setTargetLibraryId(e.target.value)}
                      className="input-glass w-full rounded-lg px-3 py-2.5 text-sm">
                      {libraries.map(lib => (
                        <option key={lib.id} value={lib.id}>{lib.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 导入模式 */}
                  <div>
                    <label className="text-xs text-surface-400 mb-2 block">导入模式</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'incremental' as const, label: '增量导入', desc: '跳过已导入的内容' },
                        { key: 'full' as const, label: '全量导入', desc: '重新导入所有内容' },
                      ].map(({ key, label, desc }) => (
                        <button key={key}
                          onClick={() => setImportMode(key)}
                          className={clsx(
                            'rounded-xl p-3 text-left transition-all border',
                            importMode === key
                              ? 'bg-neon-blue/10 border-neon-blue/30 text-white'
                              : 'bg-surface-800/30 border-white/5 text-surface-400 hover:border-white/10'
                          )}>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-[10px] mt-0.5 opacity-70">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 导入选项 */}
                  <div>
                    <label className="text-xs text-surface-400 mb-2 block">导入选项</label>
                    <div className="space-y-2">
                      {[
                        { key: 'nfo', label: '导入 NFO 元数据', desc: '标题、简介、评分、类型等', checked: importNFO, onChange: setImportNFO },
                        { key: 'images', label: '导入图片资源', desc: '海报、背景图、缩略图', checked: importImages, onChange: setImportImages },
                        { key: 'progress', label: '导入播放进度', desc: '播放次数、上次播放位置', checked: importProgress, onChange: setImportProgress },
                      ].map(({ key, label, desc, checked, onChange }) => (
                        <label key={key} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.02] cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
                            className="w-4 h-4 rounded border-surface-600 text-neon-blue focus:ring-neon-blue/30" />
                          <div>
                            <p className="text-sm text-white">{label}</p>
                            <p className="text-[10px] text-surface-500">{desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 导入概要 */}
              <div className="card-glass rounded-xl p-4">
                <p className="text-xs text-surface-400">
                  即将导入 <span className="text-white font-medium">{selectedPaths.size}</span> 个项目
                  到 <span className="text-white font-medium">{libraries.find(l => l.id === targetLibraryId)?.name}</span>
                  （{importMode === 'incremental' ? '增量模式' : '全量模式'}）
                </p>
              </div>
            </div>
          )}

          {/* ===== 阶段4: 导入中 ===== */}
          {phase === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-12 w-12 text-neon-blue animate-spin mb-4" />
              <p className="text-white font-medium">正在导入 EMBY 媒体库...</p>
              <p className="text-xs text-surface-500 mt-1">请勿关闭此窗口</p>
            </div>
          )}

          {/* ===== 阶段5: 导入结果 ===== */}
          {phase === 'result' && importResult && (
            <div className="space-y-4">
              <div className={clsx(
                'rounded-xl p-8 text-center',
                importResult.failed === 0
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-yellow-500/10 border border-yellow-500/20'
              )}>
                {importResult.failed === 0 ? (
                  <CheckCircle className="h-14 w-14 text-green-400 mx-auto mb-4" />
                ) : (
                  <AlertCircle className="h-14 w-14 text-yellow-400 mx-auto mb-4" />
                )}
                <p className="text-white font-semibold text-xl mb-2">EMBY 媒体库导入完成</p>
                <div className="flex justify-center gap-8 mt-4 text-sm">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{importResult.total}</p>
                    <p className="text-xs text-surface-500">总计</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">{importResult.imported}</p>
                    <p className="text-xs text-surface-500">导入</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-400">{importResult.skipped}</p>
                    <p className="text-xs text-surface-500">跳过</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-400">{importResult.failed}</p>
                    <p className="text-xs text-surface-500">失败</p>
                  </div>
                </div>
                {(importResult.movies_imported > 0 || importResult.series_imported > 0) && (
                  <div className="flex justify-center gap-4 mt-3 text-xs text-surface-400">
                    {importResult.movies_imported > 0 && <span>电影 {importResult.movies_imported}</span>}
                    {importResult.series_imported > 0 && <span>剧集 {importResult.series_imported}</span>}
                  </div>
                )}
              </div>

              {/* 错误列表 */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="card-glass rounded-xl p-4">
                  <h4 className="text-sm font-medium text-red-400 mb-2">导入错误 ({importResult.errors.length})</h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-surface-400">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 flex-shrink-0">
          <div className="text-xs text-surface-500">
            {phase === 'select' && detectResult && (
              <span>已选择 {selectedPaths.size} 个项目</span>
            )}
          </div>
          <div className="flex gap-3">
            {phase === 'select' && (
              <>
                <button onClick={() => setPhase('detect')} className="btn-ghost rounded-lg px-4 py-2 text-sm">
                  返回
                </button>
                <button onClick={() => setPhase('config')} disabled={selectedPaths.size === 0}
                  className="btn-neon rounded-lg px-5 py-2 text-sm font-medium flex items-center gap-2">
                  下一步 <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}
            {phase === 'config' && (
              <>
                <button onClick={() => setPhase('select')} className="btn-ghost rounded-lg px-4 py-2 text-sm">
                  返回
                </button>
                <button onClick={handleImport} disabled={importing}
                  className="btn-neon rounded-lg px-5 py-2 text-sm font-medium flex items-center gap-2">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  开始导入
                </button>
              </>
            )}
            {phase === 'result' && (
              <button onClick={onClose} className="btn-neon rounded-lg px-6 py-2 text-sm font-medium">
                完成
              </button>
            )}
            {phase === 'detect' && (
              <button onClick={onClose} className="btn-ghost rounded-lg px-4 py-2 text-sm">
                取消
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
