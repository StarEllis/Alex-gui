import { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'

interface TrailerModalProps {
  trailerUrl: string
  onClose: () => void
}

/**
 * 预告片弹窗 — 嵌入 YouTube iframe 播放预告片
 * 支持 ESC 关闭、点击遮罩关闭
 */
export default function TrailerModal({ trailerUrl, onClose }: TrailerModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // 从 YouTube URL 中提取视频 ID
  const getYouTubeId = (url: string): string | null => {
    // 支持多种格式：
    // https://www.youtube.com/watch?v=VIDEO_ID
    // https://youtu.be/VIDEO_ID
    // https://www.youtube.com/embed/VIDEO_ID
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  const videoId = getYouTubeId(trailerUrl)

  // ESC 关闭
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    // 防止背景滚动
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  // 点击遮罩关闭
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  if (!videoId) {
    // 非 YouTube 链接，直接打开新标签
    window.open(trailerUrl, '_blank', 'noopener,noreferrer')
    onClose()
    return null
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="预告片播放器"
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white/60 transition-colors hover:text-white"
        style={{ background: 'rgba(255, 255, 255, 0.1)' }}
        aria-label="关闭预告片"
      >
        <X size={22} />
      </button>

      {/* 视频容器 — 16:9 宽高比 */}
      <div className="w-full max-w-5xl animate-fade-in">
        <div className="relative overflow-hidden rounded-2xl" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
            title="预告片"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ border: 'none' }}
          />
        </div>
      </div>
    </div>
  )
}
