import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatSize, formatDuration, formatDate } from '@/utils/format'
import type { Media, MediaPlayInfo, MediaPerson } from '@/types'
import {
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import clsx from 'clsx'
import { useToast } from '@/components/Toast'
import { useTranslation } from '@/i18n'

interface MediaInfoSectionProps {
  media: Media
  playInfo: MediaPlayInfo | null
  persons: MediaPerson[]
  isAdmin: boolean
}

export default function MediaInfoSection({ media, playInfo: _playInfo, persons, isAdmin }: MediaInfoSectionProps) {
  const toast = useToast()
  const { t } = useTranslation()
  const [overviewExpanded, setOverviewExpanded] = useState(false)
  const isLongOverview = (media.overview?.length || 0) > 200

  const copyFilePath = () => {
    if (media.file_path) {
      navigator.clipboard.writeText(media.file_path)
        .then(() => toast.success(t('hero.filePathCopied')))
        .catch(() => {})
    }
  }

  const directors = persons.filter(p => p.role === 'director')
  const actors = persons.filter(p => p.role === 'actor')

  return (
    <>
      {/* 剧情简介 — 可展开/收起 */}
      {media.overview && (
        <section>
          <div className="relative">
            <p className={clsx(
              'text-sm leading-relaxed transition-all duration-500',
              !overviewExpanded && isLongOverview && 'line-clamp-3'
            )} style={{ color: 'var(--text-secondary)' }}>
              {media.overview}
            </p>
            {isLongOverview && !overviewExpanded && (
              <div className="absolute bottom-0 left-0 right-0 h-8" style={{ background: `linear-gradient(to top, var(--bg-base), transparent)` }} />
            )}
          </div>
          {isLongOverview && (
            <button
              onClick={() => setOverviewExpanded(!overviewExpanded)}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-neon transition-colors hover:text-neon-blue"
            >
              {overviewExpanded ? (
                <><ChevronUp size={14} />{t('mediaInfo.collapse')}</>
              ) : (
                <><ChevronDown size={14} />{t('mediaInfo.expandAll')}</>
              )}
            </button>
          )}
        </section>
      )}

      {/* 类型标签 */}
      {media.genres && (
        <section className="flex flex-wrap gap-2">
          {media.genres.split(',').map((genre) => (
            <Link
              key={genre}
              to={`/search?q=${encodeURIComponent(genre.trim())}`}
              className="rounded-xl px-4 py-1.5 text-sm transition-all duration-300 hover:scale-[1.04]"
              style={{
                background: 'var(--neon-blue-4)',
                border: '1px solid var(--neon-blue-8)',
                color: 'var(--text-secondary)',
              }}
            >
              {genre.trim()}
            </Link>
          ))}
        </section>
      )}

      {/* 影片详情（导演/演员/国家/语言/出品方） */}
      {(media.country || media.language || media.studio || persons.length > 0) && (
        <section>
          <div className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {directors.length > 0 && (
              <div className="flex gap-2">
                <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>{t('mediaInfo.director')}</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {directors.map(d => d.person?.name || '').filter(Boolean).join(' / ')}
                </span>
              </div>
            )}
            {actors.length > 0 && (
              <div className="flex gap-2 sm:col-span-2">
                <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>{t('mediaInfo.actors')}</span>
                <span className="line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                  {actors.slice(0, 8).map(a => {
                    const name = a.person?.name || ''
                    return a.character ? `${name}${t('mediaInfo.asCharacter', { character: a.character })}` : name
                  }).filter(Boolean).join(' / ')}
                </span>
              </div>
            )}
            {media.country && (
              <div className="flex gap-2">
                <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>{t('mediaInfo.country')}</span>
                <span style={{ color: 'var(--text-primary)' }}>{media.country}</span>
              </div>
            )}
            {media.language && (
              <div className="flex gap-2">
                <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>{t('mediaInfo.language')}</span>
                <span style={{ color: 'var(--text-primary)' }}>{media.language}</span>
              </div>
            )}
            {media.studio && (
              <div className="flex gap-2">
                <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>{t('mediaInfo.studio')}</span>
                <span style={{ color: 'var(--text-primary)' }}>{media.studio}</span>
              </div>
            )}
            {/* 数据来源标识 */}
            {(media.tmdb_id > 0 || media.douban_id || media.bangumi_id > 0) && (
              <div className="flex gap-2 sm:col-span-2">
                <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>{t('mediaInfo.dataSource')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {media.tmdb_id > 0 && (
                    <a
                      href={`https://www.themoviedb.org/${media.media_type === 'episode' ? 'tv' : 'movie'}/${media.tmdb_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ background: 'rgba(1,180,228,0.12)', color: '#01b4e4' }}
                    >
                      🎬 TMDb #{media.tmdb_id}
                    </a>
                  )}
                  {media.douban_id && (
                    <a
                      href={`https://movie.douban.com/subject/${media.douban_id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ background: 'rgba(0,180,20,0.12)', color: '#00b414' }}
                    >
                      🎯 豆瓣 #{media.douban_id}
                    </a>
                  )}
                  {media.bangumi_id > 0 && (
                    <a
                      href={`https://bgm.tv/subject/${media.bangumi_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ background: 'rgba(240,145,153,0.12)', color: '#f09199' }}
                    >
                      📺 Bangumi #{media.bangumi_id}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 文件信息卡片 — 仅管理员可见 */}
      {isAdmin && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
            <FileText size={16} className="text-neon/60" />
            {t('mediaInfo.fileInfo')}
          </h3>
          <div className="glass-panel rounded-xl p-5">
            {media.file_path && (
              <div className="mb-4 flex items-start gap-3">
                <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('mediaInfo.filePath')}</span>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <code className="flex-1 truncate rounded-lg px-3 py-1.5 text-xs"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                  >
                    {media.file_path}
                  </code>
                  <button
                    onClick={copyFilePath}
                    className="shrink-0 rounded-lg p-1.5 transition-colors hover:text-neon hover:bg-neon-blue/5"
                    style={{ color: 'var(--text-muted)' }}
                    title={t('hero.copyFilePath')}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div>
                <span style={{ color: 'var(--text-muted)' }}>{t('mediaInfo.fileSize')}</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatSize(media.file_size)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>{t('mediaInfo.addedDate')}</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatDate(media.created_at)}</span>
              </div>
              {media.duration > 0 && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>{t('mediaInfo.totalDuration')}</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatDuration(media.duration)}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
