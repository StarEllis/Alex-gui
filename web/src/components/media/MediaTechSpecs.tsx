import { useState, useCallback } from 'react'
import { formatSize, formatDuration, formatDate } from '@/utils/format'
import type { TechSpecs, FileDetail, LibraryInfo, PlaybackStatsInfo, StreamDetail } from '@/types'
import {
  Monitor,
  Music,
  Subtitles,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  BarChart3,
  Users,
  Clock,
  Play,
  FolderOpen,
  Download,
  FileJson,
  FileCode,
  Shield,
  User,
  Hash,
  Info,
} from 'lucide-react'

/** 格式化码率为可读格式 */
function formatBitRate(bitRate?: string): string {
  if (!bitRate) return '-'
  const num = parseInt(bitRate)
  if (isNaN(num)) return bitRate
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)} Mbps`
  if (num >= 1000) return `${(num / 1000).toFixed(0)} Kbps`
  return `${num} bps`
}

/** 格式化采样率 */
function formatSampleRate(rate?: string): string {
  if (!rate) return '-'
  const num = parseInt(rate)
  if (isNaN(num)) return rate
  return `${num} Hz`
}

/** 格式化声道数 */
function formatChannels(channels?: number, layout?: string): string {
  if (layout) {
    const layoutMap: Record<string, string> = {
      'mono': '单声道',
      'stereo': '立体声',
      '5.1': '5.1 环绕声',
      '5.1(side)': '5.1 环绕声',
      '7.1': '7.1 环绕声',
      '7.1(wide)': '7.1 环绕声',
    }
    return layoutMap[layout] || layout
  }
  if (!channels) return '-'
  if (channels === 1) return '单声道'
  if (channels === 2) return '立体声'
  if (channels === 6) return '5.1 环绕声'
  if (channels === 8) return '7.1 环绕声'
  return `${channels} 声道`
}

/** 格式化编码器名称 */
function formatCodecName(name: string, longName?: string): string {
  const codecMap: Record<string, string> = {
    'h264': 'H.264 / AVC',
    'hevc': 'H.265 / HEVC',
    'h265': 'H.265 / HEVC',
    'vp9': 'VP9',
    'av1': 'AV1',
    'mpeg4': 'MPEG-4',
    'aac': 'AAC',
    'ac3': 'AC-3 / Dolby Digital',
    'eac3': 'E-AC-3 / Dolby Digital Plus',
    'dts': 'DTS',
    'flac': 'FLAC',
    'opus': 'Opus',
    'vorbis': 'Vorbis',
    'mp3': 'MP3',
    'truehd': 'Dolby TrueHD',
    'pcm_s16le': 'PCM 16-bit',
    'pcm_s24le': 'PCM 24-bit',
    'srt': 'SRT',
    'ass': 'ASS/SSA',
    'subrip': 'SRT',
    'hdmv_pgs_subtitle': 'PGS (蓝光)',
    'dvd_subtitle': 'VobSub',
    'webvtt': 'WebVTT',
    'mov_text': 'MOV Text',
  }
  return codecMap[name] || longName || name.toUpperCase()
}

/** 格式化容器格式名称 */
function formatContainerName(name: string): string {
  const containerMap: Record<string, string> = {
    'matroska,webm': 'Matroska (MKV)',
    'mov,mp4,m4a,3gp,3g2,mj2': 'MP4 / MOV',
    'avi': 'AVI',
    'mpegts': 'MPEG-TS',
    'flv': 'FLV',
    'ogg': 'OGG',
    'webm': 'WebM',
  }
  return containerMap[name] || name
}

/** 格式化语言代码 */
function formatLanguage(lang?: string): string {
  if (!lang || lang === 'und') return '未知'
  const langMap: Record<string, string> = {
    'chi': '中文', 'zho': '中文', 'zh': '中文',
    'eng': '英语', 'en': '英语',
    'jpn': '日语', 'ja': '日语',
    'kor': '韩语', 'ko': '韩语',
    'fre': '法语', 'fra': '法语', 'fr': '法语',
    'ger': '德语', 'deu': '德语', 'de': '德语',
    'spa': '西班牙语', 'es': '西班牙语',
    'ita': '意大利语', 'it': '意大利语',
    'por': '葡萄牙语', 'pt': '葡萄牙语',
    'rus': '俄语', 'ru': '俄语',
    'tha': '泰语', 'th': '泰语',
    'vie': '越南语', 'vi': '越南语',
    'ara': '阿拉伯语', 'ar': '阿拉伯语',
  }
  return langMap[lang] || lang
}

/** 格式化像素格式 */
function formatPixFmt(fmt?: string): string {
  if (!fmt) return '-'
  const fmtMap: Record<string, string> = {
    'yuv420p': 'YUV 4:2:0 8-bit',
    'yuv420p10le': 'YUV 4:2:0 10-bit',
    'yuv420p10be': 'YUV 4:2:0 10-bit',
    'yuv422p': 'YUV 4:2:2 8-bit',
    'yuv444p': 'YUV 4:4:4 8-bit',
    'yuv444p10le': 'YUV 4:4:4 10-bit',
    'rgb24': 'RGB 24-bit',
    'nv12': 'NV12',
  }
  return fmtMap[fmt] || fmt
}

/** 判断是否为HDR */
function isHDR(stream: StreamDetail): boolean {
  const hdrTransfers = ['smpte2084', 'arib-std-b67', 'smpte428']
  const hdrSpaces = ['bt2020nc', 'bt2020c']
  return (
    (stream.color_transfer ? hdrTransfers.includes(stream.color_transfer) : false) ||
    (stream.color_space ? hdrSpaces.includes(stream.color_space) : false) ||
    (stream.pix_fmt?.includes('10') ?? false)
  )
}

/** 获取HDR类型标签 */
function getHDRLabel(stream: StreamDetail): string {
  if (stream.color_transfer === 'smpte2084') return 'HDR10'
  if (stream.color_transfer === 'arib-std-b67') return 'HLG'
  if (stream.color_space === 'bt2020nc' || stream.color_space === 'bt2020c') return 'HDR'
  return 'SDR'
}

/** 格式化色彩原色 */
function formatColorPrimaries(primaries?: string): string {
  if (!primaries) return '--'
  const map: Record<string, string> = {
    'bt709': 'BT.709',
    'bt2020': 'BT.2020',
    'smpte170m': 'SMPTE 170M',
    'smpte240m': 'SMPTE 240M',
    'bt470bg': 'BT.470 BG',
  }
  return map[primaries] || primaries
}

interface MediaTechSpecsProps {
  techSpecs: TechSpecs | null
  fileInfo: FileDetail | null
  library: LibraryInfo | null
  playbackStats: PlaybackStatsInfo | null
  loading: boolean
}

export default function MediaTechSpecs({ techSpecs, fileInfo, library, playbackStats, loading }: MediaTechSpecsProps) {
  const [expanded, setExpanded] = useState(false)

  /** 导出技术规格为JSON */
  const exportJSON = useCallback(() => {
    const data = { techSpecs, fileInfo, library, playbackStats }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tech-specs-${fileInfo?.file_name || 'media'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [techSpecs, fileInfo, library, playbackStats])

  /** 导出技术规格为XML */
  const exportXML = useCallback(() => {
    const toXML = (obj: any, rootName: string): string => {
      const escape = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const convert = (o: any, name: string, indent: string): string => {
        if (o === null || o === undefined) return `${indent}<${name}/>\n`
        if (typeof o !== 'object') return `${indent}<${name}>${escape(String(o))}</${name}>\n`
        if (Array.isArray(o)) return o.map((item, i) => convert(item, name.replace(/s$/, ''), indent)).join('')
        let xml = `${indent}<${name}>\n`
        for (const [k, v] of Object.entries(o)) {
          xml += convert(v, k, indent + '  ')
        }
        xml += `${indent}</${name}>\n`
        return xml
      }
      return `<?xml version="1.0" encoding="UTF-8"?>\n${convert(obj, rootName, '')}`
    }
    const data = { techSpecs, fileInfo, library, playbackStats }
    const xml = toXML(data, 'MediaTechSpecs')
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tech-specs-${fileInfo?.file_name || 'media'}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }, [techSpecs, fileInfo, library, playbackStats])

  if (loading) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="skeleton h-5 w-32 rounded-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      </section>
    )
  }

  const videoStreams = techSpecs?.streams?.filter(s => s.codec_type === 'video') || []
  const audioStreams = techSpecs?.streams?.filter(s => s.codec_type === 'audio') || []
  const subtitleStreams = techSpecs?.streams?.filter(s => s.codec_type === 'subtitle') || []
  const mainVideo = videoStreams[0]
  const mainAudio = audioStreams[0]

  return (
    <section>
      {/* 标题栏 */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
          <Cpu size={16} className="text-neon/60" />
          技术规格
        </h3>
        <div className="flex items-center gap-2">
          {/* 导出按钮 */}
          {expanded && (
            <div className="flex items-center gap-1">
              <button
                onClick={exportJSON}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:text-neon"
                style={{ color: 'var(--text-muted)', background: 'var(--nav-hover-bg)' }}
                title="导出为 JSON"
              >
                <FileJson size={12} /> JSON
              </button>
              <button
                onClick={exportXML}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:text-neon"
                style={{ color: 'var(--text-muted)', background: 'var(--nav-hover-bg)' }}
                title="导出为 XML"
              >
                <FileCode size={12} /> XML
              </button>
            </div>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-neon"
            style={{ color: 'var(--text-muted)' }}
          >
            {expanded ? <><ChevronUp size={14} />收起详情</> : <><ChevronDown size={14} />展开详情</>}
          </button>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 视频概览 */}
        <div className="glass-panel-subtle rounded-xl p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--neon-blue-8)' }}>
              <Monitor size={14} className="text-neon" />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>视频</span>
            {mainVideo && isHDR(mainVideo) && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#FBBF24' }}>{getHDRLabel(mainVideo)}</span>
            )}
            {mainVideo?.is_interlaced && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>隔行</span>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {mainVideo ? `${mainVideo.width && mainVideo.height ? `${mainVideo.height}p` : ''} ${formatCodecName(mainVideo.codec_name)} ${getHDRLabel(mainVideo)}` : '-'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {mainVideo ? [
                mainVideo.width && mainVideo.height ? `${mainVideo.width}×${mainVideo.height}` : null,
                mainVideo.frame_rate ? `${parseFloat(mainVideo.frame_rate).toFixed(2)} fps` : null,
                mainVideo.bit_rate ? formatBitRate(mainVideo.bit_rate) : null,
              ].filter(Boolean).join(' · ') : '无视频流'}
            </p>
          </div>
        </div>

        {/* 音频概览 */}
        <div className="glass-panel-subtle rounded-xl p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--neon-purple-8)' }}>
              <Music size={14} className="text-purple-400" />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>音频</span>
            {audioStreams.length > 1 && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--neon-purple-8)', color: 'var(--text-secondary)' }}>
                {audioStreams.length} 轨
              </span>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {mainAudio ? `${formatCodecName(mainAudio.codec_name)} ${formatChannels(mainAudio.channels, mainAudio.channel_layout)}` : '-'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {mainAudio ? [
                mainAudio.sample_rate ? formatSampleRate(mainAudio.sample_rate) : null,
                mainAudio.bit_rate ? formatBitRate(mainAudio.bit_rate) : null,
                mainAudio.language ? formatLanguage(mainAudio.language) : null,
              ].filter(Boolean).join(' · ') : '无音频流'}
            </p>
          </div>
        </div>

        {/* 字幕概览 */}
        <div className="glass-panel-subtle rounded-xl p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(0, 255, 136, 0.08)' }}>
              <Subtitles size={14} style={{ color: 'var(--neon-green)' }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>字幕</span>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {subtitleStreams.length > 0 ? `${subtitleStreams.length} 条内嵌字幕` : '无内嵌字幕'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {subtitleStreams.length > 0
                ? subtitleStreams.map(s => formatLanguage(s.language)).filter((v, i, a) => a.indexOf(v) === i).join(' / ')
                : '-'
              }
            </p>
          </div>
        </div>

        {/* 容器格式 */}
        <div className="glass-panel-subtle rounded-xl p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(255, 165, 0, 0.08)' }}>
              <HardDrive size={14} style={{ color: '#FFA500' }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>容器</span>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {techSpecs?.format ? formatContainerName(techSpecs.format.format_name) : fileInfo?.file_ext?.toUpperCase() || '-'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {techSpecs?.format ? [
                techSpecs.format.bit_rate ? `总码率 ${formatBitRate(techSpecs.format.bit_rate)}` : null,
                techSpecs.format.stream_count ? `${techSpecs.format.stream_count} 个流` : null,
              ].filter(Boolean).join(' · ') : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* 展开的详细信息 */}
      {expanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          {/* 媒体库信息 */}
          {library && (
            <div className="glass-panel rounded-xl p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <FolderOpen size={14} className="text-neon/60" />
                所属媒体库
              </h4>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>名称：</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{library.name}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>类型：</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {{ movie: '电影', tvshow: '电视剧', mixed: '混合', other: '其他' }[library.type] || library.type}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 播放统计 */}
          {playbackStats && (playbackStats.total_play_count > 0 || playbackStats.unique_viewers > 0) && (
            <div className="glass-panel rounded-xl p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <BarChart3 size={14} className="text-neon/60" />
                播放统计
              </h4>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-bold" style={{ color: 'var(--neon-blue)' }}>
                    <Play size={16} />
                    {playbackStats.total_play_count}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>总播放次数</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-bold" style={{ color: 'var(--neon-blue)' }}>
                    <Users size={16} />
                    {playbackStats.unique_viewers}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>观看人数</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-bold" style={{ color: 'var(--neon-blue)' }}>
                    <Clock size={16} />
                    {playbackStats.total_watch_minutes > 60
                      ? `${(playbackStats.total_watch_minutes / 60).toFixed(1)}h`
                      : `${playbackStats.total_watch_minutes.toFixed(0)}m`
                    }
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>总观看时长</div>
                </div>
                {playbackStats.last_played_at && (
                  <div className="text-center">
                    <div className="text-sm font-bold" style={{ color: 'var(--neon-blue)' }}>
                      {formatDate(playbackStats.last_played_at)}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>最后播放</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== 视频流详情 — 表格布局 ===== */}
          {videoStreams.length > 0 && (
            <div className="glass-panel rounded-xl p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Monitor size={14} className="text-neon/60" />
                视频流详情
              </h4>
              {videoStreams.map((stream, idx) => (
                <div key={idx} className="rounded-lg p-3 mb-2 last:mb-0" style={{ background: 'var(--bg-subtle)' }}>
                  {/* 视频流标题行 */}
                  <div className="mb-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      {stream.width && stream.height ? `${stream.height}p` : ''} {formatCodecName(stream.codec_name)} {getHDRLabel(stream)}
                    </span>
                    {stream.is_default && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--neon-blue-8)', color: 'var(--neon-blue)' }}>默认</span>
                    )}
                  </div>
                  {/* 详细参数表格 — 3列网格 */}
                  <div className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <InfoItem label="编码器" value={formatCodecName(stream.codec_name, stream.codec_long_name)} />
                    {stream.profile && <InfoItem label="配置" value={stream.profile} />}
                    {stream.level ? <InfoItem label="等级" value={String(stream.level)} /> : null}
                    <InfoItem label="分辨率" value={stream.width && stream.height ? `${stream.width} × ${stream.height}` : '-'} />
                    <InfoItem label="帧率" value={stream.frame_rate ? `${parseFloat(stream.frame_rate).toFixed(2)} fps` : '-'} />
                    <InfoItem label="码率" value={formatBitRate(stream.bit_rate)} />
                    {stream.bit_depth ? <InfoItem label="位深度" value={`${stream.bit_depth} bit`} /> : null}
                    <InfoItem label="像素格式" value={formatPixFmt(stream.pix_fmt)} />
                    <InfoItem label="视频动态范围" value={getHDRLabel(stream)} />
                    {stream.aspect_ratio && <InfoItem label="宽高比" value={stream.aspect_ratio} />}
                    {stream.color_space && <InfoItem label="色彩空间" value={stream.color_space} />}
                    {stream.color_transfer && <InfoItem label="色彩转换" value={stream.color_transfer} />}
                    {stream.color_primaries && <InfoItem label="色彩原色" value={formatColorPrimaries(stream.color_primaries)} />}
                    {stream.color_range && <InfoItem label="色彩范围" value={stream.color_range === 'tv' ? 'TV (Limited)' : stream.color_range === 'pc' ? 'PC (Full)' : stream.color_range} />}
                    <InfoItem label="隔行扫描" value={stream.is_interlaced ? '是' : '否'} />
                    {stream.ref_frames ? <InfoItem label="参考帧" value={String(stream.ref_frames)} /> : null}
                    {stream.nb_frames && <InfoItem label="总帧数" value={stream.nb_frames} />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== 音频流详情 — 表格布局 ===== */}
          {audioStreams.length > 0 && (
            <div className="glass-panel rounded-xl p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Music size={14} className="text-purple-400/60" />
                音频轨道 ({audioStreams.length})
              </h4>
              {audioStreams.map((stream, idx) => (
                <div key={idx} className="rounded-lg p-3 mb-2 last:mb-0" style={{ background: 'var(--bg-subtle)' }}>
                  <div className="mb-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      {formatCodecName(stream.codec_name)} {formatChannels(stream.channels, stream.channel_layout)}
                    </span>
                    {stream.title && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>— {stream.title}</span>
                    )}
                    {stream.is_default && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--neon-blue-8)', color: 'var(--neon-blue)' }}>默认</span>
                    )}
                    {stream.is_forced && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(255,165,0,0.1)', color: '#FFA500' }}>强制</span>
                    )}
                  </div>
                  <div className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <InfoItem label="语言" value={formatLanguage(stream.language)} />
                    <InfoItem label="编码器" value={formatCodecName(stream.codec_name, stream.codec_long_name)} />
                    {stream.profile && <InfoItem label="配置" value={stream.profile} />}
                    <InfoItem label="布局" value={stream.channel_layout || '-'} />
                    <InfoItem label="声道" value={stream.channels ? `${stream.channels} ch` : '-'} />
                    <InfoItem label="采样率" value={formatSampleRate(stream.sample_rate)} />
                    <InfoItem label="码率" value={formatBitRate(stream.bit_rate)} />
                    {stream.bits_per_sample && stream.bits_per_sample > 0 && <InfoItem label="位深" value={`${stream.bits_per_sample}-bit`} />}
                    <InfoItem label="默认" value={stream.is_default ? '是' : '否'} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== 字幕流详情 ===== */}
          {subtitleStreams.length > 0 && (
            <div className="glass-panel rounded-xl p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Subtitles size={14} style={{ color: 'var(--neon-green)', opacity: 0.6 }} />
                字幕轨道 ({subtitleStreams.length})
              </h4>
              <div className="space-y-1.5">
                {subtitleStreams.map((stream, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--bg-subtle)' }}>
                    <span className="shrink-0 font-mono" style={{ color: 'var(--text-muted)' }}>#{stream.index}</span>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {formatCodecName(stream.codec_name)}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {formatLanguage(stream.language)}
                    </span>
                    {stream.title && (
                      <span className="truncate" style={{ color: 'var(--text-muted)' }}>{stream.title}</span>
                    )}
                    <div className="ml-auto flex gap-1.5">
                      {stream.is_default && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--neon-blue-8)', color: 'var(--neon-blue)' }}>默认</span>
                      )}
                      {stream.is_forced && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(255,165,0,0.1)', color: '#FFA500' }}>强制</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 文件详情 — 增强版 ===== */}
          {fileInfo && (
            <div className="glass-panel rounded-xl p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Layers size={14} className="text-neon/60" />
                文件详情
              </h4>
              <div className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem label="文件名" value={fileInfo.file_name} />
                <InfoItem label="文件格式" value={fileInfo.file_ext?.replace('.', '').toUpperCase() || '-'} />
                <InfoItem label="文件大小" value={formatSize(fileInfo.file_size)} />
                {fileInfo.mime_type && <InfoItem label="MIME 类型" value={fileInfo.mime_type} />}
                {techSpecs?.format?.duration && (
                  <InfoItem label="精确时长" value={formatDuration(parseFloat(techSpecs.format.duration))} />
                )}
                {techSpecs?.format?.bit_rate && (
                  <InfoItem label="总码率" value={formatBitRate(techSpecs.format.bit_rate)} />
                )}
                <InfoItem label="创建时间" value={fileInfo.created_at ? formatDate(fileInfo.created_at) : '-'} />
                <InfoItem label="修改时间" value={fileInfo.modified_at ? formatDate(fileInfo.modified_at) : '-'} />
                {fileInfo.permissions && fileInfo.permissions !== '-' && (
                  <InfoItem label="权限" value={fileInfo.permissions} icon={<Shield size={10} />} />
                )}
                {fileInfo.owner && fileInfo.owner !== '-' && (
                  <InfoItem label="所有者" value={fileInfo.owner} icon={<User size={10} />} />
                )}
                {fileInfo.md5 && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <InfoItem label="MD5" value={fileInfo.md5} icon={<Hash size={10} />} mono />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== 容器元数据标签 ===== */}
          {techSpecs?.format?.tags && Object.keys(techSpecs.format.tags).length > 0 && (
            <div className="glass-panel rounded-xl p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Info size={14} className="text-neon/60" />
                元数据标签
              </h4>
              <div className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(techSpecs.format.tags).map(([key, value]) => (
                  <InfoItem key={key} label={key} value={String(value)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** 信息项组件 */
function InfoItem({ label, value, highlight, icon, mono }: { label: string; value: string; highlight?: boolean; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
        {icon}
        {label}：
      </span>
      <span
        className={`${highlight ? 'font-semibold' : 'font-medium'} ${mono ? 'font-mono text-[11px] break-all' : ''}`}
        style={{ color: highlight ? '#FBBF24' : 'var(--text-primary)' }}
      >
        {value}
      </span>
    </div>
  )
}
