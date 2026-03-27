import { useState, useEffect, useCallback } from 'react'
import { liveApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useNavigate } from 'react-router-dom'
import type { LiveSource, LiveRecording } from '@/types'
import { Radio, Play, Square, Trash2, Search, Filter, Circle, Disc, Settings } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LivePage() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [sources, setSources] = useState<LiveSource[]>([])
  const [recordings, setRecordings] = useState<LiveRecording[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'channels' | 'recordings'>('channels')
  const [selectedSource, setSelectedSource] = useState<LiveSource | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true)
      const res = await liveApi.listSources(selectedCategory || undefined, page, 50)
      setSources(res.data.data || [])
      setTotal(res.data.total)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, page])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await liveApi.getCategories()
      setCategories(res.data.data || [])
    } catch {
      // ignore
    }
  }, [])

  const fetchRecordings = useCallback(async () => {
    try {
      const res = await liveApi.listRecordings()
      setRecordings(res.data.data || [])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchSources()
    fetchCategories()
  }, [fetchSources, fetchCategories])

  useEffect(() => {
    if (activeTab === 'recordings') {
      fetchRecordings()
    }
  }, [activeTab, fetchRecordings])

  const handleStartRecording = async (source: LiveSource) => {
    const title = prompt('请输入录制标题', source.name + ' - 录制')
    if (!title) return
    try {
      await liveApi.startRecording(source.id, title)
      toast.success('录制已开始')
      fetchRecordings()
    } catch (err: unknown) {
      toast.error('启动录制失败: ' + ((err as { response?: { data?: { error?: string } } })?.response?.data?.error || '未知错误'))
    }
  }

  const handleStopRecording = async (id: string) => {
    try {
      await liveApi.stopRecording(id)
      toast.success('录制已停止')
      fetchRecordings()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || '停止失败')
    }
  }

  const handleDeleteRecording = async (id: string) => {
    if (!confirm('确定要删除该录制吗？')) return
    try {
      await liveApi.deleteRecording(id)
      toast.success('已删除')
      setRecordings(prev => prev.filter(r => r.id !== id))
    } catch {
      toast.error('删除失败')
    }
  }

  const filteredSources = sources.filter(s =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="text-neon" size={28} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>直播频道</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('channels')}
            className={`px-4 py-2 rounded-lg transition-all ${activeTab === 'channels' ? 'bg-neon/10 text-neon' : ''}`}
            style={activeTab !== 'channels' ? { color: 'var(--text-secondary)' } : undefined}
          >
            频道列表
          </button>
          <button
            onClick={() => setActiveTab('recordings')}
            className={`px-4 py-2 rounded-lg transition-all ${activeTab === 'recordings' ? 'bg-neon/10 text-neon' : ''}`}
            style={activeTab !== 'recordings' ? { color: 'var(--text-secondary)' } : undefined}
          >
            录制管理
          </button>
        </div>
      </div>

      {activeTab === 'channels' && (
        <>
          {/* 搜索和筛选 */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type="text"
                placeholder="搜索频道..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field w-full pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} style={{ color: 'var(--text-tertiary)' }} />
              <select
                value={selectedCategory}
                onChange={e => { setSelectedCategory(e.target.value); setPage(1) }}
                className="input-field"
              >
                <option value="">全部分类</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 频道列表 */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon border-t-transparent" />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredSources.map(source => (
                <div
                  key={source.id}
                  className={`glass-panel cursor-pointer rounded-xl p-4 transition-all hover:ring-2 hover:ring-neon/30 ${selectedSource?.id === source.id ? 'ring-2 ring-neon' : ''}`}
                  onClick={() => setSelectedSource(source)}
                >
                  <div className="flex items-center gap-3">
                    {source.logo ? (
                      <img src={source.logo} alt={source.name} className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <Radio size={20} className="text-neon" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>{source.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {source.category && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                            {source.category}
                          </span>
                        )}
                        {source.quality && (
                          <span className="text-xs text-neon">{source.quality}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {source.check_status === 'ok' ? (
                        <Circle size={8} className="fill-green-500 text-green-500" />
                      ) : source.check_status === 'error' ? (
                        <Circle size={8} className="fill-red-500 text-red-500" />
                      ) : (
                        <Circle size={8} className="fill-surface-400 text-surface-400" />
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStartRecording(source) }}
                        className="rounded-lg p-1.5 hover:bg-red-500/10" title="录制"
                      >
                        <Disc size={16} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredSources.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <Radio size={48} className="mb-4 text-surface-400" />
                  <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>暂无直播频道</p>
                  {user?.role === 'admin' ? (
                    <>
                      <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        您可以在系统管理中添加直播源或导入 M3U 播放列表
                      </p>
                      <button
                        onClick={() => navigate('/admin#live')}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:-translate-y-0.5"
                        style={{ background: 'linear-gradient(135deg, var(--neon-blue), rgba(0,180,220,0.9))', color: 'var(--text-on-neon)', boxShadow: 'var(--shadow-neon)' }}
                      >
                        <Settings size={16} />
                        前往直播源管理
                      </button>
                    </>
                  ) : (
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>请联系管理员添加直播源或导入 M3U 播放列表</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 分页 */}
          {total > 50 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary">上一页</button>
              <span className="flex items-center px-4" style={{ color: 'var(--text-secondary)' }}>
                第 {page} 页 / 共 {Math.ceil(total / 50)} 页
              </span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= total} className="btn-secondary">下一页</button>
            </div>
          )}

          {/* 选中频道的播放器区域 */}
          {selectedSource && (
            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {selectedSource.name}
                </h3>
                <div className="flex items-center gap-2">
                  <Play size={16} className="text-neon" />
                  <span className="text-sm text-neon">正在播放</span>
                </div>
              </div>
              <div className="aspect-video w-full rounded-lg overflow-hidden" style={{ background: '#000' }}>
                <video
                  src={selectedSource.url}
                  controls
                  autoPlay
                  className="h-full w-full"
                />
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'recordings' && (
        <div className="space-y-3">
          {recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Disc size={48} className="mb-4 text-surface-400" />
              <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>暂无录制记录</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>在频道列表中点击录制按钮开始录制</p>
            </div>
          ) : (
            recordings.map(rec => (
              <div key={rec.id} className="glass-panel flex items-center gap-4 rounded-xl p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  {rec.status === 'recording' ? (
                    <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  ) : (
                    <Play size={20} style={{ color: 'var(--text-secondary)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>{rec.title}</h4>
                  <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <span>{rec.source?.name}</span>
                    {rec.duration > 0 && <span>{formatDuration(rec.duration)}</span>}
                    {rec.file_size > 0 && <span>{formatFileSize(rec.file_size)}</span>}
                    <span>{new Date(rec.started_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    rec.status === 'recording' ? 'bg-red-500/10 text-red-400' :
                    rec.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                    'bg-surface-500/10 text-surface-400'
                  }`}>
                    {rec.status === 'recording' ? '录制中' : rec.status === 'completed' ? '已完成' : '失败'}
                  </span>
                  {rec.status === 'recording' && (
                    <button onClick={() => handleStopRecording(rec.id)} className="rounded-lg p-1.5 hover:bg-red-500/10" title="停止录制">
                      <Square size={16} className="text-red-400" />
                    </button>
                  )}
                  <button onClick={() => handleDeleteRecording(rec.id)} className="rounded-lg p-1.5 hover:bg-red-500/10" title="删除">
                    <Trash2 size={16} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
