import api from './client'
import { useAuthStore } from '@/stores/auth'
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  User,
  Library,
  CreateLibraryRequest,
  Media,
  Series,
  SeasonInfo,
  WatchHistory,
  Favorite,
  Playlist,
  CreatePlaylistRequest,
  SubtitleInfo,
  PaginatedResponse,
  ListResponse,
  AggregatedRecentResponse,
  MixedItem,
  SystemInfo,
  TranscodeJob,
  MediaPlayInfo,
  TMDbConfigStatus,
  RecommendedMedia,
  CastDevice,
  CastSession,
  CastRequest,
  CastControlRequest,
  Bookmark,
  CreateBookmarkRequest,
  Comment,
  CreateCommentRequest,
  CommentListResponse,
  SystemMetrics,
  ScheduledTask,
  CreateScheduledTaskRequest,
  UserPermission,
  UpdatePermissionRequest,
  ContentRating,
  AccessLog,
  TMDbSearchResult,
  TMDbImageInfo,
  BangumiSubject,
  BangumiConfigStatus,
  SystemSettings,
  SearchIntent,
  AIStatus,
  AIErrorLog,
  AICacheStats,
  AITestResult,
} from '@/types'

// ==================== 认证 ====================
export const authApi = {
  login: (data: LoginRequest) =>
    api.post<TokenResponse>('/auth/login', data),

  register: (data: RegisterRequest) =>
    api.post<TokenResponse>('/auth/register', data),

  refreshToken: () =>
    api.post<TokenResponse>('/auth/refresh'),
}

// ==================== 媒体库 ====================
export const libraryApi = {
  list: () =>
    api.get<ListResponse<Library>>('/libraries'),

  create: (data: CreateLibraryRequest) =>
    api.post<{ data: Library }>('/libraries', data),

  update: (id: string, data: Partial<CreateLibraryRequest>) =>
    api.put<{ data: Library }>(`/libraries/${id}`, data),

  scan: (id: string) =>
    api.post(`/libraries/${id}/scan`),

  reindex: (id: string) =>
    api.post(`/libraries/${id}/reindex`),

  delete: (id: string) =>
    api.delete(`/libraries/${id}`),
}

// ==================== 媒体 ====================
export const mediaApi = {
  list: (params: { page?: number; size?: number; library_id?: string }) =>
    api.get<PaginatedResponse<Media>>('/media', { params }),

  listAggregated: (params: { page?: number; size?: number; library_id?: string }) =>
    api.get<PaginatedResponse<Media>>('/media/aggregated', { params }),

  detail: (id: string) =>
    api.get<{ data: Media }>(`/media/${id}`),

  getPersons: (id: string) =>
    api.get<ListResponse<import('@/types').MediaPerson>>(`/media/${id}/persons`),

  recent: (limit = 20) =>
    api.get<ListResponse<Media>>('/media/recent', { params: { limit } }),

  recentAggregated: (limit = 20) =>
    api.get<AggregatedRecentResponse>('/media/recent/aggregated', { params: { limit } }),

  recentMixed: (limit = 20) =>
    api.get<ListResponse<MixedItem>>('/media/recent/mixed', { params: { limit } }),

  listMixed: (params: { page?: number; size?: number; library_id?: string }) =>
    api.get<PaginatedResponse<MixedItem>>('/media/mixed', { params }),

  continueWatching: (limit = 10) =>
    api.get<ListResponse<WatchHistory>>('/media/continue', { params: { limit } }),

  search: (q: string, page = 1, size = 20) =>
    api.get<PaginatedResponse<Media>>('/search', { params: { q, page, size } }),

  searchAdvanced: (params: {
    q?: string
    type?: string
    genre?: string
    year_min?: number
    year_max?: number
    min_rating?: number
    sort_by?: string
    sort_order?: string
    page?: number
    size?: number
  }) =>
    api.get<PaginatedResponse<Media>>('/search/advanced', { params }),

  searchMixed: (q: string, page = 1, size = 20) =>
    api.get<{
      media: Media[]
      series: Series[]
      media_total: number
      series_total: number
      page: number
      size: number
    }>('/search/mixed', { params: { q, page, size } }),

  scrape: (id: string) =>
    api.post(`/media/${id}/scrape`),
}

// ==================== 流媒体 ====================

function withToken(url: string): string {
  const token = useAuthStore.getState().token
  if (!token) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}token=${encodeURIComponent(token)}`
}

export const streamApi = {
  getPlayInfo: (mediaId: string) =>
    api.get<{ data: MediaPlayInfo }>(`/stream/${mediaId}/info`),

  getMasterUrl: (mediaId: string) =>
    withToken(`/api/stream/${mediaId}/master.m3u8`),

  getDirectUrl: (mediaId: string) =>
    withToken(`/api/stream/${mediaId}/direct`),

  getPosterUrl: (mediaId: string) =>
    withToken(`/api/media/${mediaId}/poster`),

  getSeriesPosterUrl: (seriesId: string) =>
    withToken(`/api/series/${seriesId}/poster`),

  getSeriesBackdropUrl: (seriesId: string) =>
    withToken(`/api/series/${seriesId}/backdrop`),
}

// ==================== 字幕 ====================
export const subtitleApi = {
  getTracks: (mediaId: string) =>
    api.get<{ data: SubtitleInfo }>(`/subtitle/${mediaId}/tracks`),

  getExtractUrl: (mediaId: string, index: number) =>
    withToken(`/api/subtitle/${mediaId}/extract/${index}`),

  getExternalUrl: (path: string) =>
    withToken(`/api/subtitle/external?path=${encodeURIComponent(path)}`),
}

// ==================== 用户 ====================
export const userApi = {
  profile: () =>
    api.get<{ data: User }>('/users/me'),

  updateProgress: (mediaId: string, position: number, duration: number) =>
    api.put(`/users/me/progress/${mediaId}`, { position, duration }),

  favorites: (page = 1, size = 20) =>
    api.get<PaginatedResponse<Favorite>>('/users/me/favorites', { params: { page, size } }),

  addFavorite: (mediaId: string) =>
    api.post(`/users/me/favorites/${mediaId}`),

  removeFavorite: (mediaId: string) =>
    api.delete(`/users/me/favorites/${mediaId}`),

  checkFavorite: (mediaId: string) =>
    api.get<{ data: boolean }>(`/users/me/favorites/${mediaId}/check`),

  getProgress: (mediaId: string) =>
    api.get<{ data: import('@/types').WatchHistory | null }>(`/users/me/progress/${mediaId}`),

  history: (page = 1, size = 20) =>
    api.get<PaginatedResponse<WatchHistory>>('/users/me/history', { params: { page, size } }),

  deleteHistory: (mediaId: string) =>
    api.delete(`/users/me/history/${mediaId}`),

  clearHistory: () =>
    api.delete('/users/me/history'),
}

// ==================== 播放列表 ====================
export const playlistApi = {
  list: () =>
    api.get<ListResponse<Playlist>>('/playlists'),

  create: (data: CreatePlaylistRequest) =>
    api.post<{ data: Playlist }>('/playlists', data),

  detail: (id: string) =>
    api.get<{ data: Playlist }>(`/playlists/${id}`),

  delete: (id: string) =>
    api.delete(`/playlists/${id}`),

  addItem: (playlistId: string, mediaId: string) =>
    api.post(`/playlists/${playlistId}/items/${mediaId}`),

  removeItem: (playlistId: string, mediaId: string) =>
    api.delete(`/playlists/${playlistId}/items/${mediaId}`),
}

// ==================== 剧集合集 ====================
export const seriesApi = {
  list: (params: { page?: number; size?: number; library_id?: string }) =>
    api.get<PaginatedResponse<Series>>('/series', { params }),

  detail: (id: string) =>
    api.get<{ data: Series }>(`/series/${id}`),

  seasons: (id: string) =>
    api.get<ListResponse<SeasonInfo>>(`/series/${id}/seasons`),

  seasonEpisodes: (id: string, season: number) =>
    api.get<ListResponse<Media>>(`/series/${id}/seasons/${season}`),

  nextEpisode: (id: string, season: number, episode: number) =>
    api.get<{ data: Media | null; message?: string }>(`/series/${id}/next`, {
      params: { season, episode },
    }),
}

// ==================== 管理 ====================
export const adminApi = {
  listUsers: () =>
    api.get<ListResponse<User>>('/admin/users'),

  deleteUser: (id: string) =>
    api.delete(`/admin/users/${id}`),

  systemInfo: () =>
    api.get<{ data: SystemInfo }>('/admin/system'),

  transcodeStatus: () =>
    api.get<ListResponse<TranscodeJob>>('/admin/transcode/status'),

  cancelTranscode: (taskId: string) =>
    api.post(`/admin/transcode/${taskId}/cancel`),

  // TMDb 配置管理
  getTMDbConfig: () =>
    api.get<{ data: TMDbConfigStatus }>('/admin/settings/tmdb'),

  updateTMDbConfig: (apiKey: string) =>
    api.put<{ message: string; data: TMDbConfigStatus }>('/admin/settings/tmdb', { api_key: apiKey }),

  clearTMDbConfig: () =>
    api.delete<{ message: string; data: TMDbConfigStatus }>('/admin/settings/tmdb'),

  // 系统监控
  getMetrics: () =>
    api.get<{ data: SystemMetrics }>('/admin/metrics'),

  // 定时任务
  listTasks: () =>
    api.get<ListResponse<ScheduledTask>>('/admin/tasks'),

  createTask: (data: CreateScheduledTaskRequest) =>
    api.post<{ data: ScheduledTask }>('/admin/tasks', data),

  updateTask: (id: string, data: { name: string; schedule: string; enabled: boolean }) =>
    api.put(`/admin/tasks/${id}`, data),

  deleteTask: (id: string) =>
    api.delete(`/admin/tasks/${id}`),

  runTaskNow: (id: string) =>
    api.post(`/admin/tasks/${id}/run`),

  // 批量操作
  batchScan: (libraryIds: string[]) =>
    api.post('/admin/batch/scan', { library_ids: libraryIds }),

  batchScrape: (mediaIds: string[]) =>
    api.post('/admin/batch/scrape', { media_ids: mediaIds }),

  // 权限管理
  getUserPermission: (userId: string) =>
    api.get<{ data: UserPermission }>(`/admin/permissions/${userId}`),

  updateUserPermission: (userId: string, data: UpdatePermissionRequest) =>
    api.put(`/admin/permissions/${userId}`, data),

  // 内容分级
  getContentRating: (mediaId: string) =>
    api.get<{ data: ContentRating }>(`/admin/rating/${mediaId}`),

  setContentRating: (mediaId: string, level: string) =>
    api.put(`/admin/rating/${mediaId}`, { level }),

  // 访问日志
  listAccessLogs: (params: { page?: number; size?: number; user_id?: string; action?: string }) =>
    api.get<PaginatedResponse<AccessLog>>('/admin/logs', { params }),

  // 手动元数据匹配
  searchMetadata: (q: string, type_: string = 'movie', year?: number) =>
    api.get<ListResponse<TMDbSearchResult>>('/admin/metadata/search', {
      params: { q, type: type_, year },
    }),

  matchMetadata: (mediaId: string, tmdbId: number) =>
    api.post(`/admin/media/${mediaId}/match`, { tmdb_id: tmdbId }),

  unmatchMetadata: (mediaId: string) =>
    api.post(`/admin/media/${mediaId}/unmatch`),

  deleteMedia: (mediaId: string) =>
    api.delete(`/admin/media/${mediaId}`),

  updateMediaMetadata: (mediaId: string, data: {
    title?: string
    orig_title?: string
    year?: number
    overview?: string
    rating?: number
    genres?: string
    country?: string
    language?: string
    tagline?: string
    studio?: string
  }) =>
    api.put<{ message: string; data: import('@/types').Media }>(`/admin/media/${mediaId}/metadata`, data),

  // 剧集合集管理
  matchSeriesMetadata: (seriesId: string, tmdbId: number) =>
    api.post(`/admin/series/${seriesId}/match`, { tmdb_id: tmdbId }),

  unmatchSeriesMetadata: (seriesId: string) =>
    api.post(`/admin/series/${seriesId}/unmatch`),

  scrapeSeriesMetadata: (seriesId: string) =>
    api.post(`/admin/series/${seriesId}/scrape`),

  deleteSeries: (seriesId: string) =>
    api.delete(`/admin/series/${seriesId}`),

  updateSeriesMetadata: (seriesId: string, data: {
    title?: string
    orig_title?: string
    year?: number
    overview?: string
    rating?: number
    genres?: string
    country?: string
    language?: string
    studio?: string
  }) =>
    api.put<{ message: string; data: import('@/types').Series }>(`/admin/series/${seriesId}/metadata`, data),

  // 系统全局设置
  getSystemSettings: () =>
    api.get<{ data: SystemSettings }>('/admin/settings/system'),

  updateSystemSettings: (data: Partial<SystemSettings>) =>
    api.put<{ data: SystemSettings }>('/admin/settings/system', data),

  // 图片管理
  searchTMDbImages: (tmdbId: number, type_: string = 'movie') =>
    api.get<{ data: { posters: TMDbImageInfo[]; backdrops: TMDbImageInfo[] } }>('/admin/images/tmdb', {
      params: { tmdb_id: tmdbId, type: type_ },
    }),

  uploadMediaImage: (mediaId: string, file: File, imageType: 'poster' | 'backdrop' = 'poster') => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/admin/media/${mediaId}/image/upload?type=${imageType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  uploadSeriesImage: (seriesId: string, file: File, imageType: 'poster' | 'backdrop' = 'poster') => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/admin/series/${seriesId}/image/upload?type=${imageType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  setMediaImageByURL: (mediaId: string, url: string, imageType: 'poster' | 'backdrop' = 'poster') =>
    api.post(`/admin/media/${mediaId}/image/url`, { url, image_type: imageType }),

  setSeriesImageByURL: (seriesId: string, url: string, imageType: 'poster' | 'backdrop' = 'poster') =>
    api.post(`/admin/series/${seriesId}/image/url`, { url, image_type: imageType }),

  setMediaImageFromTMDb: (mediaId: string, tmdbPath: string, imageType: 'poster' | 'backdrop' = 'poster') =>
    api.post(`/admin/media/${mediaId}/image/tmdb`, { tmdb_path: tmdbPath, image_type: imageType }),

  setSeriesImageFromTMDb: (seriesId: string, tmdbPath: string, imageType: 'poster' | 'backdrop' = 'poster') =>
    api.post(`/admin/series/${seriesId}/image/tmdb`, { tmdb_path: tmdbPath, image_type: imageType }),

  // Bangumi 数据源
  searchBangumi: (q: string, type_: number = 2, year?: number) =>
    api.get<ListResponse<BangumiSubject>>('/admin/metadata/bangumi/search', {
      params: { q, type: type_, year },
    }),

  getBangumiSubject: (subjectId: number) =>
    api.get<{ data: BangumiSubject }>(`/admin/metadata/bangumi/subject/${subjectId}`),

  matchMediaBangumi: (mediaId: string, bangumiId: number) =>
    api.post(`/admin/media/${mediaId}/match/bangumi`, { bangumi_id: bangumiId }),

  matchSeriesBangumi: (seriesId: string, bangumiId: number) =>
    api.post(`/admin/series/${seriesId}/match/bangumi`, { bangumi_id: bangumiId }),

  getBangumiConfig: () =>
    api.get<{ data: BangumiConfigStatus }>('/admin/settings/bangumi'),

  updateBangumiConfig: (accessToken: string) =>
    api.put<{ message: string; data: BangumiConfigStatus }>('/admin/settings/bangumi', { access_token: accessToken }),

  clearBangumiConfig: () =>
    api.delete<{ message: string; data: BangumiConfigStatus }>('/admin/settings/bangumi'),

  // 文件系统浏览
  browseFS: (path: string) =>
    api.get<{ data: { current: string; parent: string; items: { name: string; path: string; is_dir: boolean }[] } }>('/admin/fs/browse', {
      params: { path },
    }),
}

// ==================== 智能推荐 ====================
export const recommendApi = {
  getRecommendations: (limit = 20) =>
    api.get<ListResponse<RecommendedMedia>>('/recommend', { params: { limit } }),

  getSimilarMedia: (mediaId: string, limit = 12) =>
    api.get<ListResponse<RecommendedMedia>>(`/recommend/similar/${mediaId}`, { params: { limit } }),
}

// ==================== 投屏 ====================
export const castApi = {
  listDevices: () =>
    api.get<ListResponse<CastDevice>>('/cast/devices'),

  refreshDevices: () =>
    api.post('/cast/devices/refresh'),

  startCast: (data: CastRequest) =>
    api.post<{ data: CastSession; message: string }>('/cast/start', data),

  listSessions: () =>
    api.get<ListResponse<CastSession>>('/cast/sessions'),

  getSession: (sessionId: string) =>
    api.get<{ data: CastSession }>(`/cast/sessions/${sessionId}`),

  control: (sessionId: string, data: CastControlRequest) =>
    api.post(`/cast/sessions/${sessionId}/control`, data),

  stopSession: (sessionId: string) =>
    api.delete(`/cast/sessions/${sessionId}`),
}

// ==================== 视频书签 ====================
export const bookmarkApi = {
  create: (data: CreateBookmarkRequest) =>
    api.post<{ data: Bookmark }>('/bookmarks', data),

  listByUser: (page = 1, size = 20) =>
    api.get<PaginatedResponse<Bookmark>>('/bookmarks', { params: { page, size } }),

  listByMedia: (mediaId: string) =>
    api.get<ListResponse<Bookmark>>(`/bookmarks/media/${mediaId}`),

  update: (id: string, title: string, note: string) =>
    api.put(`/bookmarks/${id}`, { title, note }),

  delete: (id: string) =>
    api.delete(`/bookmarks/${id}`),
}

// ==================== 评论 ====================
export const commentApi = {
  listByMedia: (mediaId: string, page = 1, size = 20) =>
    api.get<CommentListResponse>(`/media/${mediaId}/comments`, { params: { page, size } }),

  create: (mediaId: string, data: CreateCommentRequest) =>
    api.post<{ data: Comment }>(`/media/${mediaId}/comments`, data),

  delete: (id: string) =>
    api.delete(`/comments/${id}`),
}

// ==================== 播放统计 ====================
export const statsApi = {
  recordPlayback: (mediaId: string, watchMinutes: number) =>
    api.post('/stats/playback', { media_id: mediaId, watch_minutes: watchMinutes }),

  getMyStats: () =>
    api.get<{ data: import('@/types').UserStatsOverview }>('/stats/me'),
}

// ==================== 数据备份 ====================
export const backupApi = {
  exportJSON: () =>
    api.post<{ message: string; file: string }>('/admin/backup/json'),

  exportZIP: () =>
    api.post<{ message: string; file: string }>('/admin/backup/zip'),

  importBackup: (filePath: string) =>
    api.post('/admin/backup/import', { file_path: filePath }),

  list: () =>
    api.get<{ data: import('@/types').BackupFile[] }>('/admin/backup/list'),
}

// ==================== AI 智能功能 ====================
export const aiApi = {
  // AI 智能搜索（解析自然语言查询）
  smartSearch: (q: string) =>
    api.get<{ data: SearchIntent }>('/ai/search', { params: { q } }),

  // 获取 AI 服务状态（管理员）
  getStatus: () =>
    api.get<{ data: AIStatus }>('/admin/ai/status'),

  // 更新 AI 配置（管理员）
  updateConfig: (updates: Partial<{
    enabled: boolean
    provider: string
    api_base: string
    api_key: string
    model: string
    timeout: number
    enable_smart_search: boolean
    enable_recommend_reason: boolean
    enable_metadata_enhance: boolean
    monthly_budget: number
    cache_ttl_hours: number
    max_concurrent: number
    request_interval_ms: number
  }>) =>
    api.put<{ message: string; data: AIStatus }>('/admin/ai/config', updates),

  // 测试 AI 连接（管理员）
  testConnection: () =>
    api.post<{ data: AITestResult }>('/admin/ai/test'),

  // 清空 AI 缓存（管理员）
  clearCache: () =>
    api.delete<{ message: string; data: { cleared: number } }>('/admin/ai/cache'),

  // 获取缓存统计（管理员）
  getCacheStats: () =>
    api.get<{ data: AICacheStats }>('/admin/ai/cache'),

  // 获取错误日志（管理员）
  getErrorLogs: () =>
    api.get<{ data: AIErrorLog[] }>('/admin/ai/errors'),

  // 测试智能搜索（管理员）
  testSmartSearch: (query: string) =>
    api.post<{ data: AITestResult }>('/admin/ai/test/search', { query }),

  // 测试推荐理由（管理员）
  testRecommendReason: (title: string, genres: string) =>
    api.post<{ data: AITestResult }>('/admin/ai/test/recommend', { title, genres }),
}

// ==================== 刮削数据管理 ====================
export const scrapeApi = {
  // 创建单个刮削任务
  createTask: (data: { url: string; source?: string; media_type?: string; title?: string }) =>
    api.post<{ data: import('@/types').ScrapeTask; message: string }>('/admin/scrape/tasks', data),

  // 批量创建刮削任务
  batchCreateTasks: (data: { urls: string[]; source?: string; media_type?: string }) =>
    api.post<{ message: string; created: number; skipped: number; errors: string[] }>('/admin/scrape/tasks/batch', data),

  // 列表查询
  listTasks: (params: { page?: number; size?: number; status?: string; source?: string }) =>
    api.get<import('@/types').PaginatedResponse<import('@/types').ScrapeTask>>('/admin/scrape/tasks', { params }),

  // 获取任务详情
  getTask: (id: string) =>
    api.get<{ data: import('@/types').ScrapeTask }>(`/admin/scrape/tasks/${id}`),

  // 更新任务
  updateTask: (id: string, data: Record<string, unknown>) =>
    api.put<{ data: import('@/types').ScrapeTask; message: string }>(`/admin/scrape/tasks/${id}`, data),

  // 删除任务
  deleteTask: (id: string) =>
    api.delete(`/admin/scrape/tasks/${id}`),

  // 开始刮削
  startScrape: (id: string) =>
    api.post(`/admin/scrape/tasks/${id}/scrape`),

  // 翻译任务
  translateTask: (id: string, data: { target_lang: string; fields?: string[] }) =>
    api.post(`/admin/scrape/tasks/${id}/translate`, data),

  // 批量刮削
  batchStartScrape: (taskIds: string[]) =>
    api.post<{ message: string; started: number; errors: string[] }>('/admin/scrape/batch/scrape', { task_ids: taskIds }),

  // 批量翻译
  batchTranslate: (data: { task_ids: string[]; target_lang: string; fields?: string[] }) =>
    api.post<{ message: string; started: number; errors: string[] }>('/admin/scrape/batch/translate', data),

  // 批量删除
  batchDeleteTasks: (taskIds: string[]) =>
    api.post<{ message: string; deleted: number }>('/admin/scrape/batch/delete', { task_ids: taskIds }),

  // 导出
  exportTasks: (taskIds: string[]) =>
    api.post<{ data: Record<string, unknown>[] }>('/admin/scrape/export', { task_ids: taskIds }),

  // 统计信息
  getStatistics: () =>
    api.get<{ data: import('@/types').ScrapeStatistics }>('/admin/scrape/statistics'),

  // 操作历史
  getHistory: (params: { task_id?: string; limit?: number }) =>
    api.get<{ data: import('@/types').ScrapeHistory[] }>('/admin/scrape/history', { params }),
}

// ==================== 影视文件管理 ====================
export const fileManagerApi = {
  // 文件列表
  listFiles: (params: {
    page?: number; size?: number; library_id?: string;
    media_type?: string; keyword?: string; sort_by?: string;
    sort_order?: string; scraped?: string
  }) =>
    api.get<import('@/types').PaginatedResponse<import('@/types').Media>>('/admin/files', { params }),

  // 文件详情
  getFileDetail: (id: string) =>
    api.get<{ data: import('@/types').Media }>(`/admin/files/${id}`),

  // 导入单个文件
  importFile: (data: import('@/types').FileImportRequest) =>
    api.post<{ data: import('@/types').Media; message: string }>('/admin/files/import', data),

  // 批量导入
  batchImportFiles: (files: import('@/types').FileImportRequest[]) =>
    api.post<{ message: string; data: import('@/types').BatchImportResult }>('/admin/files/import/batch', { files }),

  // 扫描目录
  scanDirectory: (path: string) =>
    api.get<{ data: import('@/types').ScannedFile[]; total: number }>('/admin/files/scan', { params: { path } }),

  // 更新文件信息
  updateFile: (id: string, data: Record<string, unknown>) =>
    api.put<{ data: import('@/types').Media; message: string }>(`/admin/files/${id}`, data),

  // 删除文件记录
  deleteFile: (id: string) =>
    api.delete(`/admin/files/${id}`),

  // 批量删除
  batchDeleteFiles: (mediaIds: string[]) =>
    api.post<{ message: string; deleted: number; errors: string[] }>('/admin/files/batch/delete', { media_ids: mediaIds }),

  // 单个文件刮削
  scrapeFile: (id: string, source?: string) =>
    api.post(`/admin/files/${id}/scrape`, { source }),

  // 批量刮削
  batchScrapeFiles: (mediaIds: string[], source?: string) =>
    api.post<{ message: string; started: number; errors: string[] }>('/admin/files/batch/scrape', { media_ids: mediaIds, source }),

  // 预览重命名
  previewRename: (mediaIds: string[], template?: string) =>
    api.post<{ data: import('@/types').RenamePreview[] }>('/admin/files/rename/preview', { media_ids: mediaIds, template }),

  // 执行重命名
  executeRename: (mediaIds: string[], template?: string) =>
    api.post<{ message: string; renamed: number; errors: string[] }>('/admin/files/rename/execute', { media_ids: mediaIds, template }),

  // AI智能重命名（支持多语言翻译）
  aiGenerateRenames: (mediaIds: string[], targetLang?: string) =>
    api.post<{ data: import('@/types').RenamePreview[] }>('/admin/files/rename/ai', { media_ids: mediaIds, target_lang: targetLang }),

  // 获取重命名模板
  getRenameTemplates: () =>
    api.get<{ data: import('@/types').RenameTemplate[] }>('/admin/files/rename/templates'),

  // 统计信息
  getStats: () =>
    api.get<{ data: import('@/types').FileManagerStats }>('/admin/files/stats'),

  // 操作日志
  getOperationLogs: (limit?: number) =>
    api.get<{ data: import('@/types').FileOperationLog[] }>('/admin/files/logs', { params: { limit } }),
}

// ==================== AI 助手 ====================
export const aiAssistantApi = {
  // 对话
  chat: (data: {
    session_id?: string
    message: string
    media_ids?: string[]
    library_id?: string
  }) =>
    api.post<{ data: import('@/types').ChatResponse }>('/admin/assistant/chat', data),

  // 执行操作
  executeAction: (data: { session_id: string; action_id: string }) =>
    api.post<{ data: import('@/types').ExecuteResponse }>('/admin/assistant/execute', data),

  // 撤销操作
  undoOperation: (opId: string) =>
    api.post<{ data: import('@/types').ExecuteResponse }>(`/admin/assistant/undo/${opId}`),

  // 获取会话
  getSession: (sessionId: string) =>
    api.get<{ data: import('@/types').ChatSession }>(`/admin/assistant/session/${sessionId}`),

  // 删除会话
  deleteSession: (sessionId: string) =>
    api.delete(`/admin/assistant/session/${sessionId}`),

  // 获取操作历史
  getOperationHistory: (limit?: number) =>
    api.get<{ data: import('@/types').AssistantOperation[] }>('/admin/assistant/history', { params: { limit } }),

  // 误分类分析
  analyzeMisclassification: () =>
    api.get<{ data: import('@/types').MisclassificationReport }>('/admin/assistant/misclassification'),

  // 批量重分类
  reclassifyFiles: (data: import('@/types').ReclassifyRequest) =>
    api.post<{ data: import('@/types').ReclassifyResult }>('/admin/assistant/reclassify', data),
}

// ==================== 字幕在线搜索 ====================
export const subtitleSearchApi = {
  // 搜索字幕
  search: (mediaId: string, params: { language?: string; title?: string; year?: number; type?: string }) =>
    api.get<{ data: import('@/types').SubtitleSearchResult[] }>(`/subtitle/${mediaId}/search`, { params }),

  // 下载字幕
  download: (mediaId: string, fileId: string) =>
    api.post<{ message: string; data: import('@/types').SubtitleDownloadResult }>(`/subtitle/${mediaId}/download`, { file_id: fileId }),
}

// ==================== 智能通知系统 ====================
export const notificationApi = {
  // 获取通知配置
  getConfig: () =>
    api.get<{ data: import('@/types').NotificationConfig }>('/admin/notification/config'),

  // 更新通知配置
  updateConfig: (config: import('@/types').NotificationConfig) =>
    api.put<{ message: string; data: import('@/types').NotificationConfig }>('/admin/notification/config', config),

  // 测试通知
  test: (channel: 'email' | 'telegram' | 'webhook') =>
    api.post<{ message: string }>(`/admin/notification/test?channel=${channel}`),
}

// ==================== 批量元数据编辑 ====================
export const batchMetadataApi = {
  // 批量更新媒体元数据
  batchUpdateMedia: (data: import('@/types').BatchUpdateRequest) =>
    api.post<{ message: string; data: import('@/types').BatchUpdateResult }>('/admin/batch/metadata/media', data),

  // 批量更新剧集合集元数据
  batchUpdateSeries: (data: { series_ids: string[]; updates: Record<string, string> }) =>
    api.post<{ message: string; data: import('@/types').BatchUpdateResult }>('/admin/batch/metadata/series', data),
}

// ==================== 媒体库导入/导出 ====================
export const importExportApi = {
  // 测试连接
  testConnection: (source: import('@/types').ImportSource) =>
    api.post<{ message: string }>('/admin/import/test', source),

  // 获取外部服务器媒体库列表
  fetchLibraries: (source: import('@/types').ImportSource) =>
    api.post<{ data: import('@/types').EmbyLibrary[] }>('/admin/import/libraries', source),

  // 从外部服务器导入
  importFromExternal: (data: { source: import('@/types').ImportSource; library_id: string; target_library_id: string }) =>
    api.post<{ message: string; data: import('@/types').ImportResult }>('/admin/import/external', data),

  // 导出媒体库数据
  exportLibrary: (libraryId?: string) =>
    api.get<{ message: string; data: import('@/types').ExportData }>('/admin/export/library', { params: { library_id: libraryId } }),

  // 从导出数据导入
  importFromData: (data: { data: import('@/types').ExportData; target_library_id: string }) =>
    api.post<{ message: string; data: import('@/types').ImportResult }>('/admin/import/data', data),
}

// ==================== V3: AI 场景识别与内容理解 ====================
export const aiSceneApi = {
  // 生成视频章节
  generateChapters: (mediaId: string) =>
    api.post<{ data: import('@/types').AIAnalysisTask; message: string }>(`/media/${mediaId}/ai/chapters`),

  // 获取视频章节
  getChapters: (mediaId: string) =>
    api.get<{ data: import('@/types').VideoChapter[] }>(`/media/${mediaId}/chapters`),

  // 提取精彩片段
  extractHighlights: (mediaId: string) =>
    api.post<{ data: import('@/types').AIAnalysisTask; message: string }>(`/media/${mediaId}/ai/highlights`),

  // 获取精彩片段
  getHighlights: (mediaId: string) =>
    api.get<{ data: import('@/types').VideoHighlight[] }>(`/media/${mediaId}/highlights`),

  // 生成封面候选
  generateCoverCandidates: (mediaId: string) =>
    api.post<{ data: import('@/types').AIAnalysisTask; message: string }>(`/media/${mediaId}/ai/covers`),

  // 获取封面候选
  getCoverCandidates: (mediaId: string) =>
    api.get<{ data: import('@/types').CoverCandidate[] }>(`/media/${mediaId}/covers`),

  // 选择封面
  selectCover: (mediaId: string, candidateId: string) =>
    api.post<{ message: string }>(`/media/${mediaId}/covers/${candidateId}/select`),

  // 应用选中的封面
  applyCover: (mediaId: string) =>
    api.post<{ message: string }>(`/media/${mediaId}/covers/apply`),

  // 获取AI分析任务列表
  getAnalysisTasks: (mediaId: string) =>
    api.get<{ data: import('@/types').AIAnalysisTask[] }>(`/media/${mediaId}/ai/tasks`),

  // 获取单个分析任务
  getAnalysisTask: (taskId: string) =>
    api.get<{ data: import('@/types').AIAnalysisTask }>(`/ai/tasks/${taskId}`),
}

// ==================== V3: 家庭社交互动 ====================
export const familySocialApi = {
  // 创建家庭组
  createGroup: (name: string) =>
    api.post<{ data: import('@/types').FamilyGroup }>('/family/groups', { name }),

  // 获取家庭组列表
  listGroups: () =>
    api.get<{ data: import('@/types').FamilyGroup[] }>('/family/groups'),

  // 加入家庭组
  joinGroup: (inviteCode: string) =>
    api.post<{ data: import('@/types').FamilyGroup; message: string }>('/family/groups/join', { invite_code: inviteCode }),

  // 获取家庭组详情
  getGroup: (groupId: string) =>
    api.get<{ data: import('@/types').FamilyGroup }>(`/family/groups/${groupId}`),

  // 解散家庭组
  deleteGroup: (groupId: string) =>
    api.delete<{ message: string }>(`/family/groups/${groupId}`),

  // 离开家庭组
  leaveGroup: (groupId: string) =>
    api.post<{ message: string }>(`/family/groups/${groupId}/leave`),

  // 重新生成邀请码
  regenerateInviteCode: (groupId: string) =>
    api.post<{ invite_code: string }>(`/family/groups/${groupId}/invite-code`),

  // 分享媒体到家庭组
  shareMedia: (groupId: string, data: { media_id?: string; series_id?: string; message?: string }) =>
    api.post<{ data: import('@/types').MediaShare }>(`/family/groups/${groupId}/share`, data),

  // 获取家庭组分享列表
  listGroupShares: (groupId: string, page = 1, size = 20) =>
    api.get<{ data: import('@/types').MediaShare[]; total: number }>(`/family/groups/${groupId}/shares`, { params: { page, size } }),

  // 点赞
  likeMedia: (mediaId: string) =>
    api.post<{ message: string }>(`/media/${mediaId}/like`),

  // 取消点赞
  unlikeMedia: (mediaId: string) =>
    api.delete<{ message: string }>(`/media/${mediaId}/like`),

  // 获取点赞状态
  getLikeStatus: (mediaId: string) =>
    api.get<{ is_liked: boolean; count: number }>(`/media/${mediaId}/like`),

  // 推荐媒体
  recommendMedia: (data: { to_user_id: string; media_id?: string; series_id?: string; message?: string }) =>
    api.post<{ data: import('@/types').MediaRecommendation }>('/family/recommend', data),

  // 获取推荐列表
  listRecommendations: (page = 1, size = 20) =>
    api.get<{ data: import('@/types').MediaRecommendation[]; total: number }>('/family/recommendations', { params: { page, size } }),

  // 标记推荐已读
  markRecommendationRead: (recId: string) =>
    api.post<{ message: string }>(`/family/recommendations/${recId}/read`),

  // 获取未读推荐数
  getUnreadCount: () =>
    api.get<{ count: number }>('/family/recommendations/unread'),
}

// ==================== V3: 实时直播 ====================
export const liveApi = {
  // 获取直播源列表
  listSources: (category?: string, page = 1, size = 50) =>
    api.get<{ data: import('@/types').LiveSource[]; total: number }>('/live/sources', { params: { category, page, size } }),

  // 获取直播源详情
  getSource: (id: string) =>
    api.get<{ data: import('@/types').LiveSource }>(`/live/sources/${id}`),

  // 获取直播分类
  getCategories: () =>
    api.get<{ data: string[] }>('/live/categories'),

  // 添加直播源（管理员）
  addSource: (data: { name: string; url: string; type?: string; category?: string; logo?: string; quality?: string }) =>
    api.post<{ data: import('@/types').LiveSource }>('/admin/live/sources', data),

  // 管理员获取直播源列表（包含禁用的）
  listSourcesAdmin: (params?: { category?: string; keyword?: string; page?: number; size?: number }) =>
    api.get<{ data: import('@/types').LiveSource[]; total: number }>('/admin/live/sources', { params }),

  // 切换直播源启用/禁用（管理员）
  toggleSourceActive: (id: string) =>
    api.post<{ data: import('@/types').LiveSource }>(`/admin/live/sources/${id}/toggle`),

  // 更新直播源（管理员）
  updateSource: (id: string, data: Partial<import('@/types').LiveSource>) =>
    api.put<{ data: import('@/types').LiveSource }>(`/admin/live/sources/${id}`, data),

  // 删除直播源（管理员）
  deleteSource: (id: string) =>
    api.delete<{ message: string }>(`/admin/live/sources/${id}`),

  // 检测直播源（管理员）
  checkSource: (id: string) =>
    api.post<{ status: string }>(`/admin/live/sources/${id}/check`),

  // 批量检测（管理员）
  batchCheck: () =>
    api.post<{ data: Record<string, string> }>('/admin/live/sources/batch-check'),

  // 导入M3U（管理员）
  importM3U: (data: { name: string; url?: string; file_path?: string }) =>
    api.post<{ data: import('@/types').LivePlaylist; count: number; message: string }>('/admin/live/playlists/import', data),

  // 获取播放列表（管理员）
  listPlaylists: () =>
    api.get<{ data: import('@/types').LivePlaylist[] }>('/admin/live/playlists'),

  // 删除播放列表（管理员）
  deletePlaylist: (id: string) =>
    api.delete<{ message: string }>(`/admin/live/playlists/${id}`),

  // 开始录制
  startRecording: (sourceId: string, title: string) =>
    api.post<{ data: import('@/types').LiveRecording; message: string }>('/live/recordings', { source_id: sourceId, title }),

  // 停止录制
  stopRecording: (id: string) =>
    api.post<{ message: string }>(`/live/recordings/${id}/stop`),

  // 获取录制列表
  listRecordings: (page = 1, size = 20) =>
    api.get<{ data: import('@/types').LiveRecording[]; total: number }>('/live/recordings', { params: { page, size } }),

  // 删除录制
  deleteRecording: (id: string) =>
    api.delete<{ message: string }>(`/live/recordings/${id}`),
}

// ==================== V3: 云端同步 ====================
export const cloudSyncApi = {
  // 注册设备
  registerDevice: (data: { device_id: string; device_name: string; device_type: string; platform?: string; app_version?: string }) =>
    api.post<{ data: import('@/types').SyncDevice }>('/sync/devices', data),

  // 获取设备列表
  listDevices: () =>
    api.get<{ data: import('@/types').SyncDevice[] }>('/sync/devices'),

  // 注销设备
  unregisterDevice: (deviceId: string) =>
    api.delete<{ message: string }>(`/sync/devices/${deviceId}`),

  // 同步数据（上传）
  syncData: (data: { device_id: string; data_type: string; data_key: string; data_value: string; version?: number }) =>
    api.post<{ message: string }>('/sync/data', data),

  // 拉取数据（下载）
  pullData: (dataType: string, sinceVersion = 0) =>
    api.get<{ data: import('@/types').SyncRecord[] }>('/sync/data', { params: { data_type: dataType, since: sinceVersion } }),

  // 批量同步
  batchSync: (deviceId: string, records: import('@/types').SyncRecord[]) =>
    api.post<{ success: number; failed: number; message: string }>('/sync/batch', { device_id: deviceId, records }),

  // 全量同步
  fullSync: () =>
    api.get<{ data: Record<string, unknown> }>('/sync/full'),

  // 获取同步配置
  getSyncConfig: () =>
    api.get<{ data: import('@/types').UserSyncConfig }>('/sync/config'),

  // 更新同步配置
  updateSyncConfig: (config: Partial<import('@/types').UserSyncConfig>) =>
    api.put<{ message: string }>('/sync/config', config),

  // 导出数据
  exportData: () =>
    api.get('/sync/export', { responseType: 'blob' }),
}

// ==================== V2: 多用户配置文件 ====================
export const userProfileApi = {
  list: () => api.get<{ data: import('@/types').UserProfile[] }>('/admin/profiles'),
  create: (profile: Partial<import('@/types').UserProfile>) => api.post<{ data: import('@/types').UserProfile }>('/admin/profiles', profile),
  get: (id: string) => api.get<{ data: import('@/types').UserProfile }>(`/admin/profiles/${id}`),
  update: (id: string, updates: Partial<import('@/types').UserProfile>) => api.put(`/admin/profiles/${id}`, updates),
  delete: (id: string) => api.delete(`/admin/profiles/${id}`),
  switch: (id: string, pin?: string) => api.post<{ data: import('@/types').UserProfile }>(`/admin/profiles/${id}/switch`, { pin }),
  getWatchLogs: (id: string, days = 7) => api.get<{ data: import('@/types').ProfileWatchLog[] }>(`/admin/profiles/${id}/watch-logs`, { params: { days } }),
  getDailyUsage: (id: string, days = 30) => api.get<{ data: import('@/types').ProfileDailyUsage[] }>(`/admin/profiles/${id}/usage`, { params: { days } }),
  getStats: (id: string) => api.get<{ data: Record<string, unknown> }>(`/admin/profiles/${id}/stats`),
}

// ==================== V2: 离线下载 ====================
export const offlineDownloadApi = {
  create: (data: { media_id: string; title: string; file_size: number; file_path: string; quality: string }) =>
    api.post<{ data: import('@/types').DownloadTask }>('/admin/downloads', data),
  batchCreate: (items: { media_id: string; title: string; file_size: number; file_path: string; quality: string }[]) =>
    api.post<{ data: import('@/types').DownloadTask[] }>('/admin/downloads/batch', { items }),
  list: (status?: string) => api.get<{ data: import('@/types').DownloadTask[] }>('/admin/downloads', { params: { status } }),
  getQueue: () => api.get<{ data: import('@/types').DownloadQueueInfo }>('/admin/downloads/queue'),
  cancel: (id: string) => api.post(`/admin/downloads/${id}/cancel`),
  pause: (id: string) => api.post(`/admin/downloads/${id}/pause`),
  resume: (id: string) => api.post(`/admin/downloads/${id}/resume`),
  delete: (id: string) => api.delete(`/admin/downloads/${id}`),
}

// ==================== V2: 插件系统 ====================
export const pluginApi = {
  list: () => api.get<{ data: import('@/types').PluginInfo[] }>('/admin/plugins'),
  get: (id: string) => api.get<{ data: import('@/types').PluginInfo; manifest: import('@/types').PluginManifest }>(`/admin/plugins/${id}`),
  enable: (id: string) => api.post(`/admin/plugins/${id}/enable`),
  disable: (id: string) => api.post(`/admin/plugins/${id}/disable`),
  uninstall: (id: string) => api.delete(`/admin/plugins/${id}`),
  updateConfig: (id: string, config: Record<string, unknown>) => api.put(`/admin/plugins/${id}/config`, config),
  scan: () => api.post<{ data: import('@/types').PluginManifest[] }>('/admin/plugins/scan'),
}

// ==================== V2: 音乐库 ====================
export const musicApi = {
  listTracks: (params: { library_id?: string; page?: number; size?: number; sort?: string }) =>
    api.get<{ data: import('@/types').MusicTrack[]; total: number }>('/music/tracks', { params }),
  listAlbums: (params: { library_id?: string; page?: number; size?: number }) =>
    api.get<{ data: import('@/types').MusicAlbum[]; total: number }>('/music/albums', { params }),
  getAlbum: (id: string) => api.get<{ data: import('@/types').MusicAlbum }>(`/music/albums/${id}`),
  search: (q: string, limit = 20) => api.get<{ data: import('@/types').MusicTrack[] }>('/music/search', { params: { q, limit } }),
  getLyrics: (id: string) => api.get<{ data: string }>(`/music/tracks/${id}/lyrics`),
  toggleLove: (id: string) => api.post<{ loved: boolean }>(`/music/tracks/${id}/love`),
  scan: (libraryId: string, path: string) => api.post<{ count: number }>('/admin/music/scan', { library_id: libraryId, path }),
  listPlaylists: () => api.get<{ data: import('@/types').MusicPlaylist[] }>('/music/playlists'),
  createPlaylist: (name: string) => api.post<{ data: import('@/types').MusicPlaylist }>('/music/playlists', { name }),
  getPlaylist: (id: string) => api.get<{ data: import('@/types').MusicPlaylist }>(`/music/playlists/${id}`),
  addToPlaylist: (id: string, trackIds: string[]) => api.post(`/music/playlists/${id}/tracks`, { track_ids: trackIds }),
}

// ==================== V2: 图片库 ====================
export const photoApi = {
  list: (params: { library_id?: string; page?: number; size?: number; sort?: string; album_id?: string; tag?: string; favorite?: string }) =>
    api.get<{ data: import('@/types').Photo[]; total: number }>('/photos', { params }),
  get: (id: string) => api.get<{ data: import('@/types').Photo }>(`/photos/${id}`),
  listAlbums: () => api.get<{ data: import('@/types').PhotoAlbum[] }>('/photos/albums'),
  createAlbum: (name: string, description?: string) => api.post<{ data: import('@/types').PhotoAlbum }>('/photos/albums', { name, description }),
  addToAlbum: (albumId: string, photoIds: string[]) => api.post(`/photos/albums/${albumId}/photos`, { photo_ids: photoIds }),
  toggleFavorite: (id: string) => api.post<{ is_favorite: boolean }>(`/photos/${id}/favorite`),
  setRating: (id: string, rating: number) => api.post(`/photos/${id}/rating`, { rating }),
  search: (q: string, limit = 50) => api.get<{ data: import('@/types').Photo[] }>('/photos/search', { params: { q, limit } }),
  getStats: (libraryId?: string) => api.get<{ data: Record<string, unknown> }>('/photos/stats', { params: { library_id: libraryId } }),
  scan: (libraryId: string, path: string) => api.post<{ count: number }>('/admin/photos/scan', { library_id: libraryId, path }),
}

// ==================== V2: 联邦架构 ====================
export const federationApi = {
  listNodes: () => api.get<{ data: import('@/types').ServerNode[] }>('/admin/federation/nodes'),
  registerNode: (data: { name: string; url: string; api_key: string; role: string }) =>
    api.post<{ data: import('@/types').ServerNode }>('/admin/federation/nodes', data),
  removeNode: (id: string) => api.delete(`/admin/federation/nodes/${id}`),
  syncNode: (id: string, type = 'full') => api.post<{ data: import('@/types').SyncTask }>(`/admin/federation/nodes/${id}/sync`, null, { params: { type } }),
  getStats: () => api.get<{ data: import('@/types').FederationStats }>('/admin/federation/stats'),
  getSyncTasks: (nodeId?: string) => api.get<{ data: import('@/types').SyncTask[] }>('/admin/federation/sync-tasks', { params: { node_id: nodeId } }),
  searchShared: (q: string, page = 1, size = 20) =>
    api.get<{ data: import('@/types').SharedMedia[]; total: number }>('/federation/search', { params: { q, page, size } }),
  getSharedStream: (id: string) => api.get<{ stream_url: string }>(`/federation/stream/${id}`),
}

// ==================== V2: ABR 自适应码率 ====================
export const abrApi = {
  getStatus: () => api.get<{ data: import('@/types').ABRStatus }>('/admin/abr/status'),
  getGPUInfo: () => api.get<{ data: import('@/types').GPUInfo }>('/admin/abr/gpu'),
  cleanCache: (mediaId?: string) => api.delete('/admin/abr/cache', { params: { media_id: mediaId } }),
}
