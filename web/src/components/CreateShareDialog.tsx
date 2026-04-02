import { useState } from 'react'
import { shareApi } from '@/api'
import { useToast } from '@/components/Toast'
import {
  Share2,
  Loader2,
  X,
  Copy,
  Lock,
  Clock,
  Eye,
  Download,
  Link2,
} from 'lucide-react'
import clsx from 'clsx'

interface CreateShareDialogProps {
  mediaId?: string
  seriesId?: string
  title?: string
  onClose: () => void
}

// 过期时间预设
const EXPIRE_PRESETS = [
  { label: '1小时', value: 1 },
  { label: '24小时', value: 24 },
  { label: '7天', value: 168 },
  { label: '30天', value: 720 },
  { label: '永不过期', value: 0 },
]

export default function CreateShareDialog({ mediaId, seriesId, title, onClose }: CreateShareDialogProps) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(null)

  // 表单
  const [shareTitle, setShareTitle] = useState(title || '')
  const [description, setDescription] = useState('')
  const [password, setPassword] = useState('')
  const [maxViews, setMaxViews] = useState(0)
  const [allowDownload, setAllowDownload] = useState(false)
  const [expiresIn, setExpiresIn] = useState(168) // 默认7天

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await shareApi.create({
        media_id: mediaId,
        series_id: seriesId,
        title: shareTitle,
        description,
        password: password || undefined,
        max_views: maxViews,
        allow_download: allowDownload,
        expires_in: expiresIn || undefined,
      })
      const code = res.data.data.code
      const url = `${window.location.origin}/share/${code}`
      setShareLink(url)
      toast.success('分享链接已创建')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '创建失败')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink)
      toast.success('链接已复制到剪贴板')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-panel w-full max-w-md rounded-2xl p-6 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            <Share2 size={20} className="text-neon" />
            创建分享链接
          </h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-200">
            <X size={18} />
          </button>
        </div>

        {shareLink ? (
          /* 创建成功 - 显示链接 */
          <div className="space-y-4">
            <div className="rounded-xl p-4 text-center" style={{ background: 'var(--nav-hover-bg)', border: '1px solid var(--border-default)' }}>
              <Link2 size={32} className="mx-auto mb-2 text-neon" />
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>分享链接已生成</p>
              <div className="flex items-center gap-2 rounded-lg p-2" style={{ background: 'var(--bg-primary)' }}>
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="input flex-1 text-xs font-mono"
                />
                <button onClick={copyLink} className="btn-primary gap-1 px-3 py-1.5 text-xs">
                  <Copy size={12} />
                  复制
                </button>
              </div>
              {password && (
                <p className="mt-2 text-xs text-amber-400 flex items-center justify-center gap-1">
                  <Lock size={12} /> 访问密码: {password}
                </p>
              )}
            </div>
            <button onClick={onClose} className="btn-primary w-full py-2.5 text-sm">完成</button>
          </div>
        ) : (
          /* 创建表单 */
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>分享标题</label>
              <input
                type="text"
                value={shareTitle}
                onChange={(e) => setShareTitle(e.target.value)}
                className="input w-full"
                placeholder="可选，默认使用媒体标题"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>描述（可选）</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input w-full resize-none"
                rows={2}
                placeholder="给分享添加一段描述..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  <Lock size={12} /> 访问密码
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input w-full"
                  placeholder="留空则无需密码"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  <Eye size={12} /> 最大访问次数
                </label>
                <input
                  type="number"
                  value={maxViews}
                  onChange={(e) => setMaxViews(parseInt(e.target.value) || 0)}
                  className="input w-full"
                  placeholder="0 = 不限"
                  min={0}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                <Clock size={12} /> 过期时间
              </label>
              <div className="flex flex-wrap gap-2">
                {EXPIRE_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setExpiresIn(p.value)}
                    className={clsx(
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                      expiresIn === p.value ? 'bg-neon/10 text-neon' : 'text-surface-400 hover:text-surface-200'
                    )}
                    style={expiresIn !== p.value ? { background: 'var(--nav-hover-bg)' } : undefined}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
                className="rounded"
              />
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <Download size={12} /> 允许下载
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">取消</button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="btn-primary gap-1.5 px-4 py-2 text-sm disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                创建分享
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
