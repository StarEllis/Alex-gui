import { useState, useEffect, useCallback } from 'react'
import { cloudSyncApi } from '@/api'
import type { SyncDevice, UserSyncConfig } from '@/types'
import { Cloud, Smartphone, Tablet, Tv, Monitor, Globe, Trash2, RefreshCw, Download, Settings, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SyncPage() {
  const [devices, setDevices] = useState<SyncDevice[]>([])
  const [syncConfig, setSyncConfig] = useState<UserSyncConfig | null>(null)
  const [activeTab, setActiveTab] = useState<'devices' | 'settings' | 'export'>('devices')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetchDevices = useCallback(async () => {
    try {
      const res = await cloudSyncApi.listDevices()
      setDevices(res.data.data || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchConfig = useCallback(async () => {
    try {
      const res = await cloudSyncApi.getSyncConfig()
      setSyncConfig(res.data.data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchDevices()
    fetchConfig()
  }, [fetchDevices, fetchConfig])

  const handleUnregisterDevice = async (deviceId: string) => {
    if (!confirm('确定要注销该设备吗？')) return
    try {
      await cloudSyncApi.unregisterDevice(deviceId)
      toast.success('设备已注销')
      setDevices(prev => prev.filter(d => d.device_id !== deviceId))
    } catch {
      toast.error('注销失败')
    }
  }

  const handleFullSync = async () => {
    setSyncing(true)
    try {
      await cloudSyncApi.fullSync()
      toast.success('全量同步完成')
    } catch {
      toast.error('同步失败')
    } finally {
      setSyncing(false)
    }
  }

  const handleUpdateConfig = async (updates: Partial<UserSyncConfig>) => {
    if (!syncConfig) return
    const newConfig = { ...syncConfig, ...updates }
    try {
      await cloudSyncApi.updateSyncConfig(newConfig)
      setSyncConfig(newConfig)
      toast.success('配置已更新')
    } catch {
      toast.error('更新失败')
    }
  }

  const handleExport = async () => {
    try {
      const res = await cloudSyncApi.exportData()
      const blob = new Blob([res.data as BlobPart], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nowen_export_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('数据导出成功')
    } catch {
      toast.error('导出失败')
    }
  }

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'phone': return <Smartphone size={20} />
      case 'tablet': return <Tablet size={20} />
      case 'tv': return <Tv size={20} />
      case 'desktop': return <Monitor size={20} />
      case 'browser': return <Globe size={20} />
      default: return <Monitor size={20} />
    }
  }

  const getDeviceTypeName = (type: string) => {
    const names: Record<string, string> = {
      phone: '手机', tablet: '平板', tv: '电视', desktop: '电脑', browser: '浏览器'
    }
    return names[type] || type
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cloud className="text-neon" size={28} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>云端同步</h1>
        </div>
        <button
          onClick={handleFullSync}
          disabled={syncing}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? '同步中...' : '立即同步'}
        </button>
      </div>

      {/* 标签页 */}
      <div className="flex gap-2 border-b pb-2" style={{ borderColor: 'var(--border-default)' }}>
        {[
          { key: 'devices' as const, label: '我的设备', icon: Monitor },
          { key: 'settings' as const, label: '同步设置', icon: Settings },
          { key: 'export' as const, label: '数据导出', icon: Download },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === tab.key ? 'bg-neon/10 text-neon' : ''}`}
            style={activeTab !== tab.key ? { color: 'var(--text-secondary)' } : undefined}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* 设备列表 */}
      {activeTab === 'devices' && (
        <div className="space-y-3">
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Monitor size={48} className="mb-4 text-surface-400" />
              <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>暂无已注册设备</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>在其他设备上登录后会自动注册</p>
            </div>
          ) : (
            devices.map(device => (
              <div key={device.id} className="glass-panel flex items-center gap-4 rounded-xl p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                  <span className={device.is_online ? 'text-neon' : 'text-surface-400'}>
                    {getDeviceIcon(device.device_type)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>{device.device_name}</h4>
                    {device.is_online && (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> 在线
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <span>{getDeviceTypeName(device.device_type)}</span>
                    {device.platform && <span>{device.platform}</span>}
                    {device.app_version && <span>v{device.app_version}</span>}
                    {device.last_sync_at && (
                      <span>上次同步: {new Date(device.last_sync_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleUnregisterDevice(device.device_id)}
                  className="rounded-lg p-2 hover:bg-red-500/10" title="注销设备"
                >
                  <Trash2 size={16} className="text-red-400" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* 同步设置 */}
      {activeTab === 'settings' && syncConfig && (
        <div className="glass-panel rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>同步选项</h3>

          {[
            { key: 'sync_progress' as const, label: '观看进度', desc: '同步各设备间的观看进度' },
            { key: 'sync_favorites' as const, label: '我的收藏', desc: '同步收藏的媒体内容' },
            { key: 'sync_playlists' as const, label: '播放列表', desc: '同步自定义播放列表' },
            { key: 'sync_history' as const, label: '观看历史', desc: '同步观看历史记录' },
            { key: 'sync_settings' as const, label: '用户设置', desc: '同步个人偏好设置' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{item.desc}</p>
              </div>
              <button
                onClick={() => handleUpdateConfig({ [item.key]: !syncConfig[item.key] })}
                className={`relative h-6 w-11 rounded-full transition-all ${syncConfig[item.key] ? 'bg-neon' : 'bg-surface-600'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${syncConfig[item.key] ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border-default)' }}>
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>自动同步</p>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>自动在后台同步数据</p>
            </div>
            <button
              onClick={() => handleUpdateConfig({ auto_sync: !syncConfig.auto_sync })}
              className={`relative h-6 w-11 rounded-full transition-all ${syncConfig.auto_sync ? 'bg-neon' : 'bg-surface-600'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${syncConfig.auto_sync ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>

          {syncConfig.auto_sync && (
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>同步间隔</p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>自动同步的时间间隔</p>
              </div>
              <select
                value={syncConfig.sync_interval_min}
                onChange={e => handleUpdateConfig({ sync_interval_min: parseInt(e.target.value) })}
                className="input-field"
              >
                <option value={1}>1 分钟</option>
                <option value={5}>5 分钟</option>
                <option value={15}>15 分钟</option>
                <option value={30}>30 分钟</option>
                <option value={60}>1 小时</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* 数据导出 */}
      {activeTab === 'export' && (
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>数据导出</h3>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            导出您的所有数据，包括观看进度、收藏、播放列表等。可用于数据备份或迁移到其他设备。
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
              <Check size={16} className="text-green-400" />
              <span style={{ color: 'var(--text-secondary)' }}>观看进度和历史记录</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
              <Check size={16} className="text-green-400" />
              <span style={{ color: 'var(--text-secondary)' }}>收藏列表</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
              <Check size={16} className="text-green-400" />
              <span style={{ color: 'var(--text-secondary)' }}>自定义播放列表</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
              <Check size={16} className="text-green-400" />
              <span style={{ color: 'var(--text-secondary)' }}>个人偏好设置</span>
            </div>
          </div>

          <button onClick={handleExport} className="btn-primary mt-6 flex items-center gap-2">
            <Download size={16} /> 导出数据 (JSON)
          </button>
        </div>
      )}
    </div>
  )
}
