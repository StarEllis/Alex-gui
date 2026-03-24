import { useEffect, useState, useCallback, useMemo } from 'react'
import { adminApi, libraryApi } from '@/api'
import { useWebSocket, WS_EVENTS } from '@/hooks/useWebSocket'
import type { SystemInfo, Library, User, TranscodeJob, TMDbConfigStatus, SystemSettings } from '@/types'
import type { ScanProgressData, ScrapeProgressData, TranscodeProgressData } from '@/hooks/useWebSocket'
import {
  Server,
  Cpu,
  HardDrive,
  Users,
  Trash2,
  Zap,
  AlertCircle,
  Film,
  Eye,
  EyeOff,
  Key,
  ExternalLink,
  Check,
  X,
  Loader2,
  Wifi,
  WifiOff,
  LayoutDashboard,
  FolderOpen,
  ListTodo,
  Activity,
  Search,
  ChevronRight,
  Settings,
  Link,
  FolderCog,
  Save,
} from 'lucide-react'
import clsx from 'clsx'
import LibraryManager from '@/components/LibraryManager'
import SystemMonitor from '@/components/SystemMonitor'

// ==================== 标签页定义 ====================
const TABS = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard, shortLabel: '仪表盘' },
  { id: 'library', label: '媒体库管理', icon: FolderOpen, shortLabel: '媒体库' },
  { id: 'users', label: '用户管理', icon: Users, shortLabel: '用户' },
  { id: 'tasks', label: '任务与转码', icon: ListTodo, shortLabel: '任务' },
  { id: 'monitor', label: '监控与日志', icon: Activity, shortLabel: '监控' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function AdminPage() {
  // 从 URL hash 读取初始标签
  const getInitialTab = (): TabId => {
    const hash = window.location.hash.replace('#', '')
    if (TABS.some((t) => t.id === hash)) return hash as TabId
    return 'dashboard'
  }

  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab)
  const [searchQuery, setSearchQuery] = useState('')

  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [libraries, setLibraries] = useState<Library[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [transcodeJobs, setTranscodeJobs] = useState<TranscodeJob[]>([])
  const [scanning, setScanning] = useState<Set<string>>(new Set())

  // 系统全局设置
  const [sysSettings, setSysSettings] = useState<SystemSettings>({
    enable_gpu_transcode: true,
    gpu_fallback_cpu: true,
    metadata_store_path: '',
    play_cache_path: '',
    enable_direct_link: false,
  })
  const [sysSettingsSaving, setSysSettingsSaving] = useState(false)
  const [sysSettingsMsg, setSysSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // TMDb 配置状态
  const [tmdbConfig, setTmdbConfig] = useState<TMDbConfigStatus | null>(null)
  const [tmdbKeyInput, setTmdbKeyInput] = useState('')
  const [tmdbEditing, setTmdbEditing] = useState(false)
  const [tmdbShowKey, setTmdbShowKey] = useState(false)
  const [tmdbSaving, setTmdbSaving] = useState(false)
  const [tmdbMessage, setTmdbMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // WebSocket 实时进度
  const { connected, on, off } = useWebSocket()
  const [scanProgress, setScanProgress] = useState<Record<string, ScanProgressData>>({})
  const [scrapeProgress, setScrapeProgress] = useState<Record<string, ScrapeProgressData>>({})
  const [transcodeProgress, setTranscodeProgress] = useState<Record<string, TranscodeProgressData>>({})
  const [realtimeMessages, setRealtimeMessages] = useState<string[]>([])

  // 标签页切换 — 同步到 URL hash
  const switchTab = useCallback((tab: TabId) => {
    setActiveTab(tab)
    window.location.hash = tab
    setSearchQuery('')
  }, [])

  // 添加实时消息（保留最近20条）
  const addMessage = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setRealtimeMessages((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 20))
  }, [])

  // ==================== WebSocket 事件监听 ====================
  useEffect(() => {
    const handleScanStarted = (data: ScanProgressData) => {
      setScanning((s) => new Set(s).add(data.library_id))
      setScanProgress((prev) => ({ ...prev, [data.library_id]: data }))
      addMessage(`📂 ${data.message}`)
    }
    const handleScanProgress = (data: ScanProgressData) => {
      setScanProgress((prev) => ({ ...prev, [data.library_id]: data }))
    }
    const handleScanCompleted = (data: ScanProgressData) => {
      setScanProgress((prev) => {
        const next = { ...prev }
        delete next[data.library_id]
        return next
      })
      addMessage(`✅ ${data.message}`)
      libraryApi.list().then((res) => setLibraries(res.data.data || []))
    }
    const handleScanFailed = (data: ScanProgressData) => {
      setScanning((s) => {
        const ns = new Set(s)
        ns.delete(data.library_id)
        return ns
      })
      setScanProgress((prev) => {
        const next = { ...prev }
        delete next[data.library_id]
        return next
      })
      addMessage(`❌ ${data.message}`)
    }

    const handleScrapeStarted = (data: ScrapeProgressData) => {
      setScrapeProgress((prev) => ({ ...prev, [data.library_id || 'default']: data }))
      addMessage(`🎨 ${data.message}`)
    }
    const handleScrapeProgress = (data: ScrapeProgressData) => {
      setScrapeProgress((prev) => ({ ...prev, [data.library_id || 'default']: data }))
    }
    const handleScrapeCompleted = (data: ScrapeProgressData) => {
      setScrapeProgress((prev) => {
        const next = { ...prev }
        delete next[data.library_id || 'default']
        return next
      })
      setScanning((s) => {
        const ns = new Set(s)
        if (data.library_id) ns.delete(data.library_id)
        return ns
      })
      addMessage(`✨ ${data.message}`)
    }

    const handleTranscodeStarted = (data: TranscodeProgressData) => {
      setTranscodeProgress((prev) => ({ ...prev, [data.task_id]: data }))
      addMessage(`🎥 ${data.message}`)
    }
    const handleTranscodeProgress = (data: TranscodeProgressData) => {
      setTranscodeProgress((prev) => ({ ...prev, [data.task_id]: data }))
    }
    const handleTranscodeCompleted = (data: TranscodeProgressData) => {
      setTranscodeProgress((prev) => {
        const next = { ...prev }
        delete next[data.task_id]
        return next
      })
      addMessage(`✅ ${data.message}`)
    }
    const handleTranscodeFailed = (data: TranscodeProgressData) => {
      setTranscodeProgress((prev) => {
        const next = { ...prev }
        delete next[data.task_id]
        return next
      })
      addMessage(`❌ ${data.message}`)
    }

    on(WS_EVENTS.SCAN_STARTED, handleScanStarted)
    on(WS_EVENTS.SCAN_PROGRESS, handleScanProgress)
    on(WS_EVENTS.SCAN_COMPLETED, handleScanCompleted)
    on(WS_EVENTS.SCAN_FAILED, handleScanFailed)
    on(WS_EVENTS.SCRAPE_STARTED, handleScrapeStarted)
    on(WS_EVENTS.SCRAPE_PROGRESS, handleScrapeProgress)
    on(WS_EVENTS.SCRAPE_COMPLETED, handleScrapeCompleted)
    on(WS_EVENTS.TRANSCODE_STARTED, handleTranscodeStarted)
    on(WS_EVENTS.TRANSCODE_PROGRESS, handleTranscodeProgress)
    on(WS_EVENTS.TRANSCODE_COMPLETED, handleTranscodeCompleted)
    on(WS_EVENTS.TRANSCODE_FAILED, handleTranscodeFailed)

    return () => {
      off(WS_EVENTS.SCAN_STARTED, handleScanStarted)
      off(WS_EVENTS.SCAN_PROGRESS, handleScanProgress)
      off(WS_EVENTS.SCAN_COMPLETED, handleScanCompleted)
      off(WS_EVENTS.SCAN_FAILED, handleScanFailed)
      off(WS_EVENTS.SCRAPE_STARTED, handleScrapeStarted)
      off(WS_EVENTS.SCRAPE_PROGRESS, handleScrapeProgress)
      off(WS_EVENTS.SCRAPE_COMPLETED, handleScrapeCompleted)
      off(WS_EVENTS.TRANSCODE_STARTED, handleTranscodeStarted)
      off(WS_EVENTS.TRANSCODE_PROGRESS, handleTranscodeProgress)
      off(WS_EVENTS.TRANSCODE_COMPLETED, handleTranscodeCompleted)
      off(WS_EVENTS.TRANSCODE_FAILED, handleTranscodeFailed)
    }
  }, [on, off, addMessage])

  // ==================== 加载数据 ====================
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [sysRes, libRes, userRes, transRes, tmdbRes, settingsRes] = await Promise.all([
          adminApi.systemInfo(),
          libraryApi.list(),
          adminApi.listUsers(),
          adminApi.transcodeStatus(),
          adminApi.getTMDbConfig(),
          adminApi.getSystemSettings(),
        ])
        setSystemInfo(sysRes.data.data)
        setLibraries(libRes.data.data || [])
        setUsers(userRes.data.data || [])
        setTranscodeJobs(transRes.data.data || [])
        setTmdbConfig(tmdbRes.data.data)
        if (settingsRes.data.data) setSysSettings(settingsRes.data.data)
      } catch {
        // 静默处理
      }
    }
    loadAll()
  }, [])

  // ==================== 用户管理操作 ====================
  const handleDeleteUser = async (id: string) => {
    if (!confirm('确定删除此用户？')) return
    try {
      await adminApi.deleteUser(id)
      setUsers((u) => u.filter((user) => user.id !== id))
    } catch {
      alert('删除失败')
    }
  }

  const hwAccelLabel = (hw: string) => {
    switch (hw) {
      case 'qsv': return 'Intel QSV'
      case 'vaapi': return 'VAAPI'
      case 'nvenc': return 'NVIDIA NVENC'
      case 'none': return '软件编码'
      default: return hw
    }
  }

  // ==================== TMDb 配置操作 ====================
  const showTmdbMessage = (type: 'success' | 'error', text: string) => {
    setTmdbMessage({ type, text })
    setTimeout(() => setTmdbMessage(null), 4000)
  }

  const handleSaveTMDbKey = async () => {
    const key = tmdbKeyInput.trim()
    if (!key) return
    setTmdbSaving(true)
    try {
      const res = await adminApi.updateTMDbConfig(key)
      setTmdbConfig(res.data.data)
      setTmdbKeyInput('')
      setTmdbEditing(false)
      setTmdbShowKey(false)
      showTmdbMessage('success', 'TMDb API Key 已保存成功')
    } catch (err: any) {
      const msg = err?.response?.data?.error || '保存失败，请稍后重试'
      showTmdbMessage('error', msg)
    } finally {
      setTmdbSaving(false)
    }
  }

  const handleClearTMDbKey = async () => {
    if (!confirm('确定清除 TMDb API Key？清除后元数据刮削功能将不可用。')) return
    try {
      const res = await adminApi.clearTMDbConfig()
      setTmdbConfig(res.data.data)
      setTmdbKeyInput('')
      setTmdbEditing(false)
      showTmdbMessage('success', 'TMDb API Key 已清除')
    } catch {
      showTmdbMessage('error', '清除失败，请稍后重试')
    }
  }

  // ==================== 搜索匹配 ====================
  // 快捷导航条目
  const quickNavItems = useMemo(() => {
    const items = [
      { label: '系统状态', tab: 'dashboard' as TabId, icon: Server },
      { label: '系统设置', tab: 'dashboard' as TabId, icon: Settings },
      { label: '实时进度', tab: 'dashboard' as TabId, icon: Loader2 },
      { label: '活动日志', tab: 'dashboard' as TabId, icon: Activity },
      { label: '媒体库管理', tab: 'library' as TabId, icon: FolderOpen },
      { label: 'TMDb 刮削配置', tab: 'library' as TabId, icon: Film },
      { label: '用户管理', tab: 'users' as TabId, icon: Users },
      { label: '转码任务', tab: 'tasks' as TabId, icon: Zap },
      { label: '系统监控', tab: 'monitor' as TabId, icon: Activity },
    ]
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return items.filter((item) => item.label.toLowerCase().includes(q))
  }, [searchQuery])

  // 实时进度是否有活动
  const hasActiveProgress = Object.keys(scanProgress).length > 0 || Object.keys(scrapeProgress).length > 0 || Object.keys(transcodeProgress).length > 0

  return (
    <div className="space-y-0">
      {/* ==================== 顶部标题栏 ==================== */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-2xl font-bold tracking-wide" style={{ color: 'var(--text-primary)' }}>
            系统管理
          </h1>
          <div className="flex items-center gap-3">
            {/* 搜索框 */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9 pr-3 py-1.5 text-sm w-48 lg:w-64"
                placeholder="搜索设置项..."
              />
              {/* 搜索结果下拉 */}
              {quickNavItems.length > 0 && (
                <div
                  className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl py-1 animate-slide-up"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    boxShadow: 'var(--shadow-elevated)',
                  }}
                >
                  {quickNavItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.label}
                        onClick={() => {
                          switchTab(item.tab)
                          setSearchQuery('')
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--nav-hover-bg)]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <Icon size={14} className="text-neon/60" />
                        <span>{item.label}</span>
                        <ChevronRight size={12} className="ml-auto text-surface-600" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            {/* WebSocket 状态 */}
            <div className="flex items-center gap-2 text-xs">
              {connected ? (
                <span className="flex items-center gap-1.5 text-neon">
                  <Wifi size={14} />
                  <span className="hidden sm:inline">实时连接</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-surface-500">
                  <WifiOff size={14} />
                  <span className="hidden sm:inline">未连接</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ==================== 标签页导航 ==================== */}
        <div
          className="flex gap-1 overflow-x-auto pb-px scrollbar-hide"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            // 给「任务」标签添加活动指示器
            const hasIndicator = tab.id === 'tasks' && (hasActiveProgress || transcodeJobs.some((j) => j.status === 'running'))
            // 给「仪表盘」标签在有进度时添加指示器
            const hasDashIndicator = tab.id === 'dashboard' && hasActiveProgress

            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={clsx('admin-tab whitespace-nowrap', isActive && 'active')}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                {(hasIndicator || hasDashIndicator) && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-neon" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ==================== 标签页内容区 ==================== */}
      <div className="tab-content-enter" key={activeTab}>
        {/* ===== 仪表盘标签页 ===== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* 实时进度面板（优先展示） */}
            {hasActiveProgress && (
              <section className="animate-slide-up">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  <Loader2 size={20} className="animate-spin text-neon" />
                  实时进度
                </h2>
                <div className="space-y-3">
                  {Object.entries(scanProgress).map(([libId, data]) => (
                    <div key={`scan-${libId}`} className="glass-panel-subtle rounded-xl p-4" style={{ borderColor: 'rgba(0,240,255,0.15)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          📂 扫描: {data.library_name}
                        </span>
                        <span className="text-xs text-neon">新增 {data.new_found} 个文件</span>
                      </div>
                      <p className="text-xs text-surface-400">{data.message}</p>
                    </div>
                  ))}
                  {Object.entries(scrapeProgress).map(([key, data]) => (
                    <div key={`scrape-${key}`} className="glass-panel-subtle rounded-xl p-4" style={{ borderColor: 'rgba(138,43,226,0.15)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          🎨 元数据刮削
                        </span>
                        <span className="text-xs text-purple-400">
                          {data.current}/{data.total} (成功:{data.success} 失败:{data.failed})
                        </span>
                      </div>
                      <div className="mb-2 h-2 overflow-hidden rounded-full" style={{ background: 'rgba(0,240,255,0.06)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ background: 'linear-gradient(90deg, var(--neon-purple), var(--neon-pink))', width: `${data.total > 0 ? (data.current / data.total) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-surface-400">{data.message}</p>
                    </div>
                  ))}
                  {Object.entries(transcodeProgress).map(([taskId, data]) => (
                    <div key={`transcode-${taskId}`} className="glass-panel-subtle rounded-xl p-4" style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          🎥 转码: {data.title} ({data.quality})
                        </span>
                        <span className="text-xs text-amber-400">
                          {data.progress.toFixed(1)}% {data.speed && `| ${data.speed}`}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full" style={{ background: 'rgba(0,240,255,0.06)' }}>
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${data.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 系统信息 */}
            {systemInfo && (
              <section>
                <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                  <Server size={20} className="text-neon/60" />
                  系统状态
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="glass-panel-subtle rounded-xl p-4">
                    <div className="flex items-center gap-2 text-surface-400">
                      <Cpu size={16} className="text-neon/60" />
                      <span className="text-xs">CPU / 协程</span>
                    </div>
                    <p className="mt-2 font-display text-lg font-bold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                      {systemInfo.cpus} 核 / {systemInfo.goroutines}
                    </p>
                  </div>
                  <div className="glass-panel-subtle rounded-xl p-4">
                    <div className="flex items-center gap-2 text-surface-400">
                      <HardDrive size={16} className="text-neon/60" />
                      <span className="text-xs">内存使用</span>
                    </div>
                    <p className="mt-2 font-display text-lg font-bold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                      {systemInfo.memory.alloc_mb} MB
                    </p>
                  </div>
                  <div className="glass-panel-subtle rounded-xl p-4">
                    <div className="flex items-center gap-2 text-surface-400">
                      <Zap size={16} className="text-neon/60" />
                      <span className="text-xs">硬件加速</span>
                    </div>
                    <p className={clsx(
                      'mt-2 text-lg font-bold',
                      systemInfo.hw_accel !== 'none' ? 'text-green-400' : 'text-yellow-400'
                    )}>
                      {hwAccelLabel(systemInfo.hw_accel)}
                    </p>
                  </div>
                  <div className="glass-panel-subtle rounded-xl p-4">
                    <div className="flex items-center gap-2 text-surface-400">
                      <Server size={16} className="text-neon/60" />
                      <span className="text-xs">版本</span>
                    </div>
                    <p className="mt-2 font-display text-lg font-bold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                      v{systemInfo.version}
                    </p>
                    <p className="text-xs text-surface-500">
                      {systemInfo.go_version} / {systemInfo.os}_{systemInfo.arch}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* 系统全局设置面板 */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                <Settings size={20} className="text-neon/60" />
                系统设置
              </h2>
              <div className="glass-panel rounded-xl p-5 space-y-6">
                {/* 提示信息 */}
                <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--nav-hover-bg)', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)' }}>
                  以下设置为系统全局配置，对所有媒体库统一生效。媒体库的独立设置请在「媒体库管理」标签页中配置。
                </div>

                {/* GPU 加速转码 */}
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Zap size={16} style={{ color: 'var(--neon-blue)' }} />
                        <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>GPU 加速转码</h4>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                        启用 GPU 硬件加速转码，显著提升转码速度。支持 NVIDIA NVENC、Intel QSV、VAAPI 等。
                      </p>
                    </div>
                    <button
                      type="button" role="switch" aria-checked={sysSettings.enable_gpu_transcode}
                      onClick={() => setSysSettings((s) => ({ ...s, enable_gpu_transcode: !s.enable_gpu_transcode }))}
                      className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-300 focus:outline-none"
                      style={{
                        background: sysSettings.enable_gpu_transcode ? 'linear-gradient(135deg, var(--neon-blue), var(--neon-purple))' : 'var(--border-default)',
                        boxShadow: sysSettings.enable_gpu_transcode ? '0 0 12px rgba(0,240,255,0.25)' : 'none',
                      }}
                    >
                      <span className="pointer-events-none inline-block h-5 w-5 rounded-full shadow-lg transition-transform duration-300" style={{ transform: sysSettings.enable_gpu_transcode ? 'translateX(20px) translateY(2px)' : 'translateX(2px) translateY(2px)', background: sysSettings.enable_gpu_transcode ? '#fff' : 'var(--text-muted)' }} />
                    </button>
                  </div>
                  {sysSettings.enable_gpu_transcode && (
                    <div className="mt-3 ml-6 flex items-start justify-between gap-4 rounded-lg p-3" style={{ background: 'var(--nav-hover-bg)' }}>
                      <div className="flex-1">
                        <h4 className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>GPU 不支持时自动回退 CPU</h4>
                        <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>当 GPU 不支持特定格式解码时，系统自动切换至 CPU 进行转码，确保兼容性。</p>
                      </div>
                      <button
                        type="button" role="switch" aria-checked={sysSettings.gpu_fallback_cpu}
                        onClick={() => setSysSettings((s) => ({ ...s, gpu_fallback_cpu: !s.gpu_fallback_cpu }))}
                        className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-300 focus:outline-none"
                        style={{
                          background: sysSettings.gpu_fallback_cpu ? 'linear-gradient(135deg, var(--neon-blue), var(--neon-purple))' : 'var(--border-default)',
                          boxShadow: sysSettings.gpu_fallback_cpu ? '0 0 12px rgba(0,240,255,0.25)' : 'none',
                        }}
                      >
                        <span className="pointer-events-none inline-block h-5 w-5 rounded-full shadow-lg transition-transform duration-300" style={{ transform: sysSettings.gpu_fallback_cpu ? 'translateX(20px) translateY(2px)' : 'translateX(2px) translateY(2px)', background: sysSettings.gpu_fallback_cpu ? '#fff' : 'var(--text-muted)' }} />
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--border-default)' }} />

                {/* 媒体元数据存储位置 */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FolderCog size={16} style={{ color: '#F59E0B' }} />
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>媒体元数据存储位置</h4>
                  </div>
                  <p className="mt-1 mb-2.5 text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    自定义媒体元数据（海报、NFO、缩略图等）的保存路径。留空则使用系统默认路径。
                  </p>
                  <input
                    type="text"
                    value={sysSettings.metadata_store_path}
                    onChange={(e) => setSysSettings((s) => ({ ...s, metadata_store_path: e.target.value }))}
                    className="input w-full"
                    placeholder="留空使用默认路径，如: /data/metadata"
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border-default)' }} />

                {/* 播放缓存目录 */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <HardDrive size={16} style={{ color: '#10B981' }} />
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>播放缓存目录</h4>
                  </div>
                  <p className="mt-1 mb-2.5 text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    自定义播放时转码产生的临时文件缓存目录。留空则使用系统默认缓存路径。
                  </p>
                  <input
                    type="text"
                    value={sysSettings.play_cache_path}
                    onChange={(e) => setSysSettings((s) => ({ ...s, play_cache_path: e.target.value }))}
                    className="input w-full"
                    placeholder="留空使用默认路径，如: /cache/transcode"
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border-default)' }} />

                {/* 网盘优先直连播放 */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link size={16} style={{ color: '#F59E0B' }} />
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>网盘优先直连播放</h4>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                      播放网盘文件时优先使用直链进行在线播放，显著提升播放速度和用户体验。需要网盘支持直链访问。
                    </p>
                  </div>
                  <button
                    type="button" role="switch" aria-checked={sysSettings.enable_direct_link}
                    onClick={() => setSysSettings((s) => ({ ...s, enable_direct_link: !s.enable_direct_link }))}
                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-300 focus:outline-none"
                    style={{
                      background: sysSettings.enable_direct_link ? 'linear-gradient(135deg, var(--neon-blue), var(--neon-purple))' : 'var(--border-default)',
                      boxShadow: sysSettings.enable_direct_link ? '0 0 12px rgba(0,240,255,0.25)' : 'none',
                    }}
                  >
                    <span className="pointer-events-none inline-block h-5 w-5 rounded-full shadow-lg transition-transform duration-300" style={{ transform: sysSettings.enable_direct_link ? 'translateX(20px) translateY(2px)' : 'translateX(2px) translateY(2px)', background: sysSettings.enable_direct_link ? '#fff' : 'var(--text-muted)' }} />
                  </button>
                </div>

                {/* 保存按钮 + 提示 */}
                <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '1rem' }}>
                  {sysSettingsMsg && (
                    <div className={clsx(
                      'mb-3 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm',
                      sysSettingsMsg.type === 'success' && 'bg-green-500/10 text-green-400',
                      sysSettingsMsg.type === 'error' && 'bg-red-500/10 text-red-400'
                    )}>
                      {sysSettingsMsg.type === 'success' ? <Check size={16} /> : <X size={16} />}
                      {sysSettingsMsg.text}
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      setSysSettingsSaving(true)
                      setSysSettingsMsg(null)
                      try {
                        await adminApi.updateSystemSettings(sysSettings)
                        setSysSettingsMsg({ type: 'success', text: '系统设置已保存' })
                        setTimeout(() => setSysSettingsMsg(null), 4000)
                      } catch {
                        setSysSettingsMsg({ type: 'error', text: '保存失败，请稍后重试' })
                      } finally {
                        setSysSettingsSaving(false)
                      }
                    }}
                    disabled={sysSettingsSaving}
                    className="btn-primary gap-1.5 px-5 py-2.5 text-sm"
                  >
                    {sysSettingsSaving ? (
                      <><Loader2 size={14} className="animate-spin" />保存中...</>
                    ) : (
                      <><Save size={14} />保存设置</>
                    )}
                  </button>
                </div>
              </div>
            </section>

            {/* 活动日志 */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                <Activity size={20} className="text-neon/60" />
                活动日志
              </h2>
              {realtimeMessages.length > 0 ? (
                <div className="glass-panel-subtle max-h-48 overflow-y-auto rounded-xl p-4 space-y-1.5">
                  {realtimeMessages.map((msg, i) => (
                    <p key={i} className={clsx('text-xs font-mono', i === 0 ? 'text-surface-300' : 'text-surface-500')}>
                      {msg}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="glass-panel-subtle flex items-center justify-center rounded-xl py-12 text-center">
                  <p className="text-sm text-surface-500">暂无活动日志，操作后将在此显示实时消息</p>
                </div>
              )}
            </section>

            {/* 快捷入口卡片 */}
            <section>
              <h2 className="mb-4 font-display text-lg font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                快捷入口
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TABS.filter((t) => t.id !== 'dashboard').map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => switchTab(tab.id)}
                      className="glass-panel-subtle group flex flex-col items-center gap-3 rounded-xl p-5 transition-all duration-300 hover:border-neon-blue/20 hover:shadow-card-hover"
                    >
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110"
                        style={{
                          background: 'rgba(0, 240, 255, 0.06)',
                          border: '1px solid rgba(0, 240, 255, 0.1)',
                        }}
                      >
                        <Icon size={22} className="text-neon/70 transition-colors group-hover:text-neon" />
                      </div>
                      <span className="text-sm font-medium transition-colors group-hover:text-neon" style={{ color: 'var(--text-secondary)' }}>
                        {tab.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {/* ===== 媒体库管理标签页 ===== */}
        {activeTab === 'library' && (
          <div className="space-y-8">
            {/* 媒体库管理器 */}
            <LibraryManager
              libraries={libraries}
              setLibraries={setLibraries}
              scanning={scanning}
              setScanning={setScanning}
              scanProgress={scanProgress}
              scrapeProgress={scrapeProgress}
            />

            {/* TMDb 元数据刮削配置 */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                <Film size={20} className="text-neon/60" />
                元数据刮削配置
              </h2>
              <div className="glass-panel rounded-xl p-5">
                {/* 说明信息 */}
                <div className="mb-5 rounded-lg p-4" style={{ background: 'var(--nav-hover-bg)', border: '1px solid var(--border-default)' }}>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    通过配置{' '}
                    <span className="font-medium text-neon">TMDb（The Movie Database）</span>{' '}
                    API 密钥，系统将自动获取视频的海报、简介、评分、类型等元数据信息，让您的媒体库内容更加丰富完整。
                  </p>
                  <a
                    href="https://www.themoviedb.org/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-neon hover:text-neon-blue transition-colors"
                  >
                    <ExternalLink size={14} />
                    前往 TMDb 官网免费申请 API Key
                  </a>
                </div>

                {/* 当前状态 */}
                <div className="mb-4 flex items-center gap-3">
                  <div className={clsx(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    tmdbConfig?.configured ? 'bg-green-500/10' : ''
                  )}
                    style={!tmdbConfig?.configured ? { background: 'var(--nav-hover-bg)', border: '1px solid var(--border-default)' } : undefined}
                  >
                    <Key size={18} className={tmdbConfig?.configured ? 'text-green-400' : 'text-surface-500'} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {tmdbConfig?.configured ? 'API Key 已配置' : 'API Key 未配置'}
                    </p>
                    {tmdbConfig?.configured && tmdbConfig.masked_key && (
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-surface-400 font-mono">
                        {tmdbShowKey ? tmdbConfig.masked_key : '••••••••••••••••••••'}
                        <button
                          onClick={() => setTmdbShowKey(!tmdbShowKey)}
                          className="text-surface-500 hover:text-surface-300 transition-colors"
                          title={tmdbShowKey ? '隐藏密钥' : '显示掩码密钥'}
                        >
                          {tmdbShowKey ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </p>
                    )}
                  </div>
                </div>

                {/* 操作提示消息 */}
                {tmdbMessage && (
                  <div className={clsx(
                    'mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm',
                    tmdbMessage.type === 'success' && 'bg-green-500/10 text-green-400',
                    tmdbMessage.type === 'error' && 'bg-red-500/10 text-red-400'
                  )}>
                    {tmdbMessage.type === 'success' ? <Check size={16} /> : <X size={16} />}
                    {tmdbMessage.text}
                  </div>
                )}

                {/* 编辑表单 */}
                {tmdbEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        输入 TMDb API Key
                      </label>
                      <input
                        type="text"
                        value={tmdbKeyInput}
                        onChange={(e) => setTmdbKeyInput(e.target.value)}
                        className="input font-mono"
                        placeholder="例如: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveTMDbKey()}
                      />
                      <p className="mt-1.5 text-xs text-surface-500">
                        TMDb API Key 通常是一个32位的十六进制字符串，请从{' '}
                        <a
                          href="https://www.themoviedb.org/settings/api"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neon hover:underline"
                        >
                          TMDb 账户设置页
                        </a>
                        {' '}中获取。
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveTMDbKey}
                        disabled={!tmdbKeyInput.trim() || tmdbSaving}
                        className="btn-primary gap-1.5 px-4 py-2 text-sm disabled:opacity-50"
                      >
                        {tmdbSaving ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            保存中...
                          </>
                        ) : (
                          <>
                            <Check size={14} />
                            保存
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setTmdbEditing(false)
                          setTmdbKeyInput('')
                        }}
                        className="btn-ghost px-4 py-2 text-sm"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTmdbEditing(true)}
                      className="btn-primary gap-1.5 px-4 py-2 text-sm"
                    >
                      <Key size={14} />
                      {tmdbConfig?.configured ? '修改 API Key' : '配置 API Key'}
                    </button>
                    {tmdbConfig?.configured && (
                      <button
                        onClick={handleClearTMDbKey}
                        className="btn-ghost gap-1.5 px-4 py-2 text-sm text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={14} />
                        清除密钥
                      </button>
                    )}
                  </div>
                )}

                {/* 功能说明 */}
                <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border-default)' }}>
                  <p className="text-xs font-medium text-surface-400 mb-2">配置后可使用以下功能：</p>
                  <ul className="space-y-1.5 text-xs text-surface-500">
                    <li className="flex items-center gap-2">
                      <span className={clsx(
                        'inline-block h-1.5 w-1.5 rounded-full',
                        tmdbConfig?.configured ? 'bg-green-400' : 'bg-surface-600'
                      )} />
                      扫描媒体库时自动获取海报、简介、评分等信息
                    </li>
                    <li className="flex items-center gap-2">
                      <span className={clsx(
                        'inline-block h-1.5 w-1.5 rounded-full',
                        tmdbConfig?.configured ? 'bg-green-400' : 'bg-surface-600'
                      )} />
                      在媒体详情页手动刮削指定视频的元数据
                    </li>
                    <li className="flex items-center gap-2">
                      <span className={clsx(
                        'inline-block h-1.5 w-1.5 rounded-full',
                        tmdbConfig?.configured ? 'bg-green-400' : 'bg-surface-600'
                      )} />
                      自动匹配电影/剧集的中文类型标签
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ===== 用户管理标签页 ===== */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                <Users size={20} className="text-neon/60" />
                用户管理
              </h2>
              <span className="text-sm text-surface-400">共 {users.length} 个用户</span>
            </div>

            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="glass-panel-subtle flex items-center justify-between rounded-xl p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" style={{ background: 'linear-gradient(135deg, var(--neon-blue), var(--neon-purple))', boxShadow: 'var(--shadow-neon)', color: 'var(--text-on-neon)' }}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{user.username}</p>
                      <p className="text-xs text-surface-500">
                        {user.role === 'admin' ? '管理员' : '普通用户'}
                        <span className="ml-2">
                          注册于 {new Date(user.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </p>
                    </div>
                  </div>
                  {user.role !== 'admin' && (
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="btn-ghost p-2 text-red-400 hover:text-red-300"
                      title="删除用户"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 rounded-xl p-3 text-xs text-yellow-400/80" style={{ background: 'rgba(234, 179, 8, 0.03)', border: '1px solid rgba(234, 179, 8, 0.08)' }}>
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>新用户可以通过登录页面的"创建账号"自行注册。第一个注册的用户将自动成为管理员。</span>
            </div>
          </div>
        )}

        {/* ===== 任务与转码标签页 ===== */}
        {activeTab === 'tasks' && (
          <div className="space-y-8">
            {/* 实时转码进度 */}
            {Object.keys(transcodeProgress).length > 0 && (
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  <Loader2 size={20} className="animate-spin text-neon" />
                  转码进行中
                </h2>
                <div className="space-y-3">
                  {Object.entries(transcodeProgress).map(([taskId, data]) => (
                    <div key={`transcode-${taskId}`} className="glass-panel-subtle rounded-xl p-4" style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          🎥 {data.title} ({data.quality})
                        </span>
                        <span className="text-xs text-amber-400">
                          {data.progress.toFixed(1)}% {data.speed && `| ${data.speed}`}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full" style={{ background: 'rgba(0,240,255,0.06)' }}>
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${data.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 转码任务列表 */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                <Zap size={20} className="text-neon/60" />
                转码任务
              </h2>
              {transcodeJobs.length > 0 ? (
                <div className="space-y-2">
                  {transcodeJobs.map((job) => (
                    <div
                      key={job.id}
                      className="glass-panel-subtle flex items-center justify-between rounded-xl p-3"
                    >
                      <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        <span className="text-surface-400">媒体ID:</span> {job.media_id.slice(0, 8)}...
                        <span className="ml-3 text-surface-400">质量:</span> {job.quality}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-32 overflow-hidden rounded-full" style={{ background: 'rgba(0,240,255,0.06)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${job.progress}%`, background: 'linear-gradient(90deg, var(--neon-blue), var(--neon-purple))' }}
                          />
                        </div>
                        <span
                          className={clsx(
                            'text-xs font-medium',
                            job.status === 'running' && 'text-neon',
                            job.status === 'pending' && 'text-yellow-400',
                            job.status === 'done' && 'text-green-400',
                            job.status === 'failed' && 'text-red-400'
                          )}
                        >
                          {job.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-panel-subtle flex items-center justify-center rounded-xl py-16 text-center">
                  <div>
                    <Zap size={36} className="mx-auto mb-3 text-surface-600" />
                    <p className="text-sm text-surface-500">暂无转码任务</p>
                    <p className="mt-1 text-xs text-surface-600">在媒体详情页可以发起转码操作</p>
                  </div>
                </div>
              )}
            </section>

            {/* 定时任务提示 */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                <ListTodo size={20} className="text-neon/60" />
                定时任务
              </h2>
              <div className="glass-panel-subtle flex items-center justify-center rounded-xl py-16 text-center">
                <div>
                  <ListTodo size={36} className="mx-auto mb-3 text-surface-600" />
                  <p className="text-sm text-surface-500">定时任务功能即将上线</p>
                  <p className="mt-1 text-xs text-surface-600">支持定时扫描媒体库、自动清理缓存等功能</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ===== 监控与日志标签页 ===== */}
        {activeTab === 'monitor' && (
          <div className="space-y-8">
            <SystemMonitor />

            {/* 最近活动日志 */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                <Activity size={20} className="text-neon/60" />
                最近活动
              </h2>
              {realtimeMessages.length > 0 ? (
                <div className="glass-panel-subtle max-h-64 overflow-y-auto rounded-xl p-4 space-y-1.5">
                  {realtimeMessages.map((msg, i) => (
                    <p key={i} className={clsx('text-xs font-mono', i === 0 ? 'text-surface-300' : 'text-surface-500')}>
                      {msg}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="glass-panel-subtle flex items-center justify-center rounded-xl py-12 text-center">
                  <p className="text-sm text-surface-500">暂无活动记录</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* 搜索遮罩 */}
      {searchQuery && quickNavItems.length > 0 && (
        <div className="fixed inset-0 z-40" onClick={() => setSearchQuery('')} />
      )}
    </div>
  )
}
