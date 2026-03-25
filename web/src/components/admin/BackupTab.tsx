import { useState, useEffect } from 'react'
import { backupApi } from '@/api'
import type { BackupFile } from '@/types'
import { useToast } from '@/components/Toast'
import { Download, Upload, Archive, FileJson, Loader2, HardDrive } from 'lucide-react'

export default function BackupTab() {
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const toast = useToast()

  const fetchBackups = async () => {
    setLoading(true)
    try {
      const res = await backupApi.list()
      setBackups(res.data.data || [])
    } catch {
      // 静默
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBackups()
  }, [])

  const handleExportJSON = async () => {
    setExporting(true)
    try {
      const res = await backupApi.exportJSON()
      toast.success(`备份完成: ${res.data.file}`)
      fetchBackups()
    } catch {
      toast.error('备份失败')
    } finally {
      setExporting(false)
    }
  }

  const handleExportZIP = async () => {
    setExporting(true)
    try {
      const res = await backupApi.exportZIP()
      toast.success(`备份完成: ${res.data.file}`)
      fetchBackups()
    } catch {
      toast.error('备份失败')
    } finally {
      setExporting(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      {/* 操作按钮区 */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExportJSON}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, var(--neon-blue), rgba(0,180,220,0.9))',
            color: 'var(--text-on-neon)',
            boxShadow: 'var(--shadow-neon)',
          }}
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileJson size={16} />}
          导出 JSON 备份
        </button>

        <button
          onClick={handleExportZIP}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:-translate-y-0.5"
          style={{
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
          导出 ZIP 备份
        </button>
      </div>

      {/* 备份文件列表 */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <HardDrive size={18} style={{ color: 'var(--neon-blue)' }} />
          <h3 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            备份文件
          </h3>
          <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
            共 {backups.length} 个
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--neon-blue)' }} />
          </div>
        ) : backups.length === 0 ? (
          <div className="py-12 text-center">
            <Download size={32} className="mx-auto mb-3 text-surface-600" />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              暂无备份文件，点击上方按钮创建备份
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {backups.map((backup) => (
              <div key={backup.name} className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-white/[0.02]">
                <div className="flex-shrink-0">
                  {backup.name.endsWith('.zip') ? (
                    <Archive size={18} className="text-purple-400" />
                  ) : (
                    <FileJson size={18} className="text-cyan-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {backup.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatSize(backup.size)} · {new Date(backup.modified).toLocaleString('zh-CN')}
                  </p>
                </div>
                <button
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <Upload size={12} />
                  恢复
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
