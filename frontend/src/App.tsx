import { useEffect, useRef, useState } from 'react';
import './App.css';
import './library-refine.css';
import {
    GetActorStats,
    GetDesktopSettings,
    GetGenreStats,
    GetLibraries,
    PlayRandomLibraryMedia,
    ScanLibraryWithMode,
} from "../wailsjs/go/main/App";
import { EventsOn, WindowSetDarkTheme, WindowSetTitle } from "../wailsjs/runtime/runtime";
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import MediaGrid from './components/MediaGrid';
import CategoryGrid from './components/CategoryGrid';
import SettingsPage from './components/SettingsPage';
import LibraryModal from './components/LibraryModal';
import LibraryEditModal from './components/LibraryEditModal';
import MediaDetail from './components/MediaDetail';

type ViewName = 'libs' | 'settings' | 'actor' | 'genre' | 'watched' | 'favorite';
type SortOrder = 'asc' | 'desc';
type SortField = 'created_at' | 'release_date' | 'video_codec' | 'last_watched' | 'favorite_at' | 'rating';
type SortViewName = 'libs' | 'watched' | 'favorite';
type SortConfig = { field: SortField; order: SortOrder };
type SortOption = { field: SortField; label: string };
type FilterState = { type: string; value: string; label: string } | null;
type FilterReturnContext = {
    view: ViewName;
    media: any | null;
} | null;
type ScanProgressState = {
    libraryId: string;
    libraryName: string;
    mode: string;
    phase: string;
    current: number;
    total: number;
    message: string;
};

const APP_TITLE = 'ALEX';

const VIEW_LABELS: Record<Exclude<ViewName, 'libs'>, string> = {
    settings: '设置',
    actor: '演员',
    genre: '类别',
    watched: '已看',
    favorite: '收藏',
};

const SEARCHABLE_VIEWS = new Set<ViewName>(['libs', 'watched', 'favorite']);

const LIBRARY_SORT_OPTIONS: SortOption[] = [
    { field: 'created_at', label: '加入日期' },
    { field: 'release_date', label: '发行日期' },
    { field: 'video_codec', label: '视频编码' },
    { field: 'last_watched', label: '观看时间' },
];

const WATCHED_SORT_OPTIONS: SortOption[] = [
    { field: 'last_watched', label: '观看时间' },
    { field: 'created_at', label: '加入日期' },
    { field: 'rating', label: '评分' },
];

const FAVORITE_SORT_OPTIONS: SortOption[] = [
    { field: 'favorite_at', label: '收藏时间' },
    { field: 'created_at', label: '加入日期' },
    { field: 'rating', label: '评分' },
];

const DEFAULT_SORTS: Record<SortViewName, SortConfig> = {
    libs: { field: 'created_at', order: 'desc' },
    watched: { field: 'last_watched', order: 'desc' },
    favorite: { field: 'favorite_at', order: 'desc' },
};

const formatError = (error: unknown) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return '未知错误';
};

function App() {
    const [layoutVersion, setLayoutVersion] = useState(0);
    const [contentRefreshVersion, setContentRefreshVersion] = useState(0);
    const [view, setView] = useState<ViewName>('libs');
    const [libraries, setLibraries] = useState<any[]>([]);
    const [currentLib, setCurrentLib] = useState<any>(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [showLibModal, setShowLibModal] = useState(false);
    const [editingLib, setEditingLib] = useState<any>(null);
    const [selectedMedia, setSelectedMedia] = useState<any>(null);
    const [statusMsg, setStatusMsg] = useState('');
    const [scanProgress, setScanProgress] = useState<ScanProgressState | null>(null);
    const [mediaCount, setMediaCount] = useState(0);
    const [activeFilter, setActiveFilter] = useState<FilterState>(null);
    const [filterReturnContext, setFilterReturnContext] = useState<FilterReturnContext>(null);
    const [sortStateByView, setSortStateByView] = useState<Record<SortViewName, SortConfig>>(DEFAULT_SORTS);
    const [gridScrollTop, setGridScrollTop] = useState(0);
    const scanStartedAtRef = useRef<number | null>(null);
    const scanModeRef = useRef<string>('');
    const resetTitleTimerRef = useRef<number | null>(null);
    const metadataRefreshTimerRef = useRef<number | null>(null);
    const currentLibRef = useRef<any>(null);

    const setAppTitle = (title: string) => {
        WindowSetTitle(title);
    };

    const currentSortView: SortViewName = view === 'watched' || view === 'favorite' ? view : 'libs';
    const { field: sortField, order: sortOrder } = sortStateByView[currentSortView];
    const currentSortOptions = currentSortView === 'watched'
        ? WATCHED_SORT_OPTIONS
        : currentSortView === 'favorite'
            ? FAVORITE_SORT_OPTIONS
            : LIBRARY_SORT_OPTIONS;

    const scheduleTitleReset = (delay = 3500) => {
        if (resetTitleTimerRef.current) {
            window.clearTimeout(resetTitleTimerRef.current);
        }
        resetTitleTimerRef.current = window.setTimeout(() => {
            setAppTitle(APP_TITLE);
            resetTitleTimerRef.current = null;
        }, delay);
    };

    const updateScanTitle = (data: any, fallbackPrefix: string) => {
        const current = typeof data?.current === 'number' ? data.current : 0;
        const total = typeof data?.total === 'number' ? data.total : 0;
        const elapsedSeconds = scanStartedAtRef.current
            ? Math.max(0, Math.floor((Date.now() - scanStartedAtRef.current) / 1000))
            : 0;
        const ratioText = total > 0 ? `${current}/${total}` : `${current}`;
        const message = typeof data?.message === 'string' ? data.message.trim() : '';
        const suffix = elapsedSeconds > 0 ? `，耗时 ${elapsedSeconds}s` : '';
        const detail = message ? ` ${message}` : '';
        setAppTitle(`${APP_TITLE} - ${fallbackPrefix}${ratioText}${detail}${suffix}`);
    };

    const showStatus = (msg: string) => {
        setStatusMsg(msg);
        window.setTimeout(() => setStatusMsg(''), 5000);
    };

    const clearScanProgress = () => {
        setScanProgress(null);
    };

    const startScanForLibrary = async (libraryId: string, mode: string) => {
        scanModeRef.current = mode;
        await ScanLibraryWithMode(libraryId, mode);
    };

    const loadLibraries = async () => {
        try {
            const libs = await GetLibraries();
            const nextLibraries = libs || [];
            setLibraries(nextLibraries);
            setCurrentLib((prev: any) => {
                if (nextLibraries.length === 0) {
                    return null;
                }
                if (!prev) {
                    return nextLibraries[0];
                }
                return nextLibraries.find((lib: any) => lib.id === prev.id) || nextLibraries[0];
            });
            setEditingLib((prev: any) => {
                if (!prev) {
                    return prev;
                }
                return nextLibraries.find((lib: any) => lib.id === prev.id) || null;
            });
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        currentLibRef.current = currentLib;
    }, [currentLib]);

    useEffect(() => {
        let frameId = 0;
        const handleResize = () => {
            window.cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(() => {
                setLayoutVersion((prev) => prev + 1);
            });
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.cancelAnimationFrame(frameId);
        };
    }, []);

    useEffect(() => {
        setAppTitle(APP_TITLE);
        WindowSetDarkTheme();
        loadLibraries();

        GetDesktopSettings().then((settings: any) => {
            if (settings?.theme) {
                document.body.className = settings.theme;
            }
        });

        const unsubStart = EventsOn("scan:started", (data: any) => {
            scanStartedAtRef.current = Date.now();
            setScanProgress({
                libraryId: typeof data?.library_id === 'string' ? data.library_id : '',
                libraryName: typeof data?.library_name === 'string' ? data.library_name : '',
                mode: typeof data?.mode === 'string' ? data.mode : (scanModeRef.current || ''),
                phase: typeof data?.phase === 'string' ? data.phase : 'started',
                current: typeof data?.current === 'number'
                    ? data.current
                    : (typeof data?.new_found === 'number' ? data.new_found : 0),
                total: typeof data?.total === 'number' ? data.total : 0,
                message: typeof data?.message === 'string' ? data.message : '',
            });
            updateScanTitle(data, '扫描 ');
        });

        const unsubProgress = EventsOn("scan:progress", (data: any) => {
            setScanProgress((prev) => ({
                libraryId: typeof data?.library_id === 'string' ? data.library_id : (prev?.libraryId || ''),
                libraryName: typeof data?.library_name === 'string' ? data.library_name : (prev?.libraryName || ''),
                mode: typeof data?.mode === 'string' ? data.mode : (prev?.mode || scanModeRef.current || ''),
                phase: typeof data?.phase === 'string' ? data.phase : (prev?.phase || 'progress'),
                current: typeof data?.current === 'number'
                    ? data.current
                    : (typeof data?.new_found === 'number' ? data.new_found : (prev?.current || 0)),
                total: typeof data?.total === 'number' ? data.total : (prev?.total || 0),
                message: typeof data?.message === 'string' ? data.message : (prev?.message || ''),
            }));
            updateScanTitle(data, '扫描 ');
        });

        const unsubComplete = EventsOn("scan:completed", (data: any) => {
            showStatus(`扫描完成：${data?.library_name || ''}`);
            updateScanTitle(data, '完成 ');
            scanStartedAtRef.current = null;
            scanModeRef.current = '';
            scheduleTitleReset();
            clearScanProgress();
            loadLibraries();
            setContentRefreshVersion((prev) => prev + 1);
        });

        const unsubMetadata = EventsOn("media:metadata-updated", (data: any) => {
            const activeLibraryId = currentLibRef.current?.id;
            const eventLibraryId = typeof data?.library_id === 'string' ? data.library_id : '';
            if (activeLibraryId && eventLibraryId && activeLibraryId !== eventLibraryId) {
                return;
            }

            if (metadataRefreshTimerRef.current !== null) {
                window.clearTimeout(metadataRefreshTimerRef.current);
            }
            metadataRefreshTimerRef.current = window.setTimeout(() => {
                setContentRefreshVersion((prev) => prev + 1);
                metadataRefreshTimerRef.current = null;
            }, 250);
        });

        const unsubFail = EventsOn("scan:failed", (data: any) => {
            showStatus(`扫描失败：${data?.message || '未知错误'}`);
            updateScanTitle(data, '失败 ');
            scanStartedAtRef.current = null;
            scanModeRef.current = '';
            scheduleTitleReset();
            clearScanProgress();
        });

        return () => {
            unsubStart();
            unsubProgress();
            unsubComplete();
            unsubMetadata();
            unsubFail();
            if (resetTitleTimerRef.current) {
                window.clearTimeout(resetTitleTimerRef.current);
            }
            if (metadataRefreshTimerRef.current !== null) {
                window.clearTimeout(metadataRefreshTimerRef.current);
            }
            scanModeRef.current = '';
            setAppTitle(APP_TITLE);
        };
    }, []);

    const clearFilter = () => {
        setActiveFilter(null);
        setSearchKeyword('');
        if (filterReturnContext) {
            setView(filterReturnContext.view);
            setSelectedMedia(filterReturnContext.media);
        } else {
            setView('libs');
            setSelectedMedia(null);
        }
        setFilterReturnContext(null);
    };

    const applyFilter = (filter: { type: string; value: string; label: string }, returnContext?: FilterReturnContext) => {
        setActiveFilter(filter);
        setSearchKeyword(filter.label);
        setFilterReturnContext(returnContext || null);
        setSelectedMedia(null);
        setView('libs');
    };

    const applyFilterFromView = (sourceView: ViewName, filter: { type: string; value: string; label: string }) => {
        applyFilter(filter, { view: sourceView, media: null });
    };

    const applyFilterFromDetail = (filter: { type: string; value: string; label: string }) => {
        applyFilter(filter, {
            view,
            media: selectedMedia,
        });
    };

    const resetWorkspaceState = () => {
        setSelectedMedia(null);
        setGridScrollTop(0);
        setActiveFilter(null);
        setFilterReturnContext(null);
        setSearchKeyword('');
    };

    const handleSelectLibrary = (lib: any) => {
        setCurrentLib(lib);
        setView('libs');
        resetWorkspaceState();
    };

    const handleOpenSettings = () => {
        resetWorkspaceState();
        setView('settings');
    };

    const handleSelectView = (nextView: ViewName) => {
        resetWorkspaceState();
        setView(nextView);
    };

    const handleNavigateHome = () => {
        resetWorkspaceState();
        setView('libs');
    };

    const handleLibCreated = async (createdLib: any) => {
        setShowLibModal(false);
        resetWorkspaceState();
        setView('libs');
        if (createdLib) {
            setCurrentLib(createdLib);
        }
        loadLibraries();

        if (createdLib?.id) {
            try {
                await startScanForLibrary(createdLib.id, 'incremental');
            } catch (error) {
                showStatus(`新建媒体库成功，但自动扫描失败：${formatError(error)}`);
            }
            return;
        }

        showStatus('\u65b0\u5efa\u5a92\u4f53\u5e93\u6210\u529f');
    };
    const handleLibSaved = () => {
        setEditingLib(null);
        loadLibraries();
        showStatus('\u5a92\u4f53\u5e93\u5df2\u4fdd\u5b58');
    };

    const handleLibDeleted = () => {
        setEditingLib(null);
        setCurrentLib(null);
        loadLibraries();
        showStatus('\u5a92\u4f53\u5e93\u5df2\u5220\u9664');
    };

    const handleScanWithMode = async (mode: string) => {
        if (!currentLib) {
            return;
        }
        try {
            await startScanForLibrary(currentLib.id, mode);
        } catch (error) {
            showStatus(`扫描启动失败：${formatError(error)}`);
        }
    };
    const handleRandomPlay = async () => {
        if (!currentLib) {
            return;
        }
        try {
            const filename = await PlayRandomLibraryMedia(currentLib.id);
            showStatus(`随机播放：${filename}`);
        } catch (error) {
            showStatus(`随机播放失败：${formatError(error)}`);
        }
    };

    const handleSortSelect = (field: string) => {
        const nextField = field as SortField;
        setSortStateByView((prev) => {
            const currentSort = prev[currentSortView];
            if (nextField === currentSort.field) {
                return {
                    ...prev,
                    [currentSortView]: {
                        field: currentSort.field,
                        order: currentSort.order === 'desc' ? 'asc' : 'desc',
                    },
                };
            }

            return {
                ...prev,
                [currentSortView]: {
                    field: nextField,
                    order: 'desc',
                },
            };
        });
    };

    const currentLibraryName = currentLib?.name || '未选择媒体库';
    const baseCount = typeof currentLib?.media_count === 'number' ? currentLib.media_count : mediaCount;
    const headerCount = (view === 'libs' || view === 'watched' || view === 'favorite') ? mediaCount : baseCount;
    const searchEnabled = Boolean(currentLib && SEARCHABLE_VIEWS.has(view));
    const showLibraryActions = Boolean(currentLib && view === 'libs');
    const showListActions = Boolean(currentLib && SEARCHABLE_VIEWS.has(view));
    const isDetailOpen = Boolean(selectedMedia);
    const showScanProgressPanel = Boolean(scanProgress && !statusMsg);
    const scanProgressText = scanProgress
        ? `\u6b63\u5728\u626b\u63cf: ${scanProgress.current}/${scanProgress.total > 0 ? scanProgress.total : '...'}`
        : '';

    const renderWorkspaceContent = () => {
        if (!currentLib && view !== 'settings') {
            return (
                <div className="workspace-empty-state">
                    <div className="workspace-empty-state-inner">
                        <span className="workspace-empty-eyebrow">媒体库</span>
                        <h2>还没有可用的媒体库</h2>
                        <p>先创建一个媒体库，然后即可开始扫描、搜索和浏览你的内容。</p>
                        <button type="button" className="workspace-empty-action" onClick={() => setShowLibModal(true)}>
                            新建媒体库
                        </button>
                    </div>
                </div>
            );
        }

        switch (view) {
            case 'watched':
                return (
                    <MediaGrid
                        libraryId={currentLib.id}
                        keyword={searchKeyword}
                        sortField={sortField}
                        sortOrder={sortOrder}
                        layoutVersion={layoutVersion}
                        refreshVersion={contentRefreshVersion}
                        filter={{ type: 'watched', value: 'true', label: '已看' }}
                        onSelectMedia={setSelectedMedia}
                        onCountChange={setMediaCount}
                        onQuickPlayStatus={showStatus}
                        initialScrollTop={gridScrollTop}
                        onScrollPositionChange={setGridScrollTop}
                    />
                );
            case 'favorite':
                return (
                    <MediaGrid
                        libraryId={currentLib.id}
                        keyword={searchKeyword}
                        sortField={sortField}
                        sortOrder={sortOrder}
                        layoutVersion={layoutVersion}
                        refreshVersion={contentRefreshVersion}
                        filter={{ type: 'favorite', value: 'true', label: '收藏' }}
                        onSelectMedia={setSelectedMedia}
                        onCountChange={setMediaCount}
                        onQuickPlayStatus={showStatus}
                        initialScrollTop={gridScrollTop}
                        onScrollPositionChange={setGridScrollTop}
                    />
                );
            case 'actor':
                return (
                    <CategoryGrid
                        type="actor"
                        libraryId={currentLib.id}
                        refreshVersion={contentRefreshVersion}
                        fetchFn={GetActorStats}
                        onSelect={(value, label) => applyFilterFromView('actor', { type: 'actor', value, label })}
                    />
                );
            case 'genre':
                return (
                    <CategoryGrid
                        type="genre"
                        libraryId={currentLib.id}
                        refreshVersion={contentRefreshVersion}
                        fetchFn={GetGenreStats}
                        onSelect={(value, label) => applyFilterFromView('genre', { type: 'genre', value, label })}
                    />
                );
            case 'settings':
                return <SettingsPage onClose={handleNavigateHome} />;
            case 'libs':
            default:
                return (
                    <MediaGrid
                        libraryId={currentLib.id}
                        keyword={searchKeyword}
                        sortField={sortField}
                        sortOrder={sortOrder}
                        layoutVersion={layoutVersion}
                        refreshVersion={contentRefreshVersion}
                        filter={activeFilter}
                        onSelectMedia={setSelectedMedia}
                        onCountChange={setMediaCount}
                        onQuickPlayStatus={showStatus}
                        initialScrollTop={gridScrollTop}
                        onScrollPositionChange={setGridScrollTop}
                    />
                );
        }
    };

    return (
        <div className="app-container">
            <div className="window-shell">
                <div className="workspace-shell">
                    <Sidebar
                        appName={APP_TITLE}
                        libraries={libraries}
                        currentLib={currentLib}
                        currentView={view}
                        onSelectLib={handleSelectLibrary}
                        onOpenSettings={handleOpenSettings}
                        onSelectView={handleSelectView}
                        onAddLib={() => setShowLibModal(true)}
                        onEditLib={(lib: any) => setEditingLib(lib)}
                    />

                    <div className="main-content">
                        {!isDetailOpen && (
                            <TopBar
                                currentLibraryName={currentLibraryName}
                                mediaCount={headerCount || 0}
                                filterLabel={activeFilter?.label}
                                searchValue={searchKeyword}
                                onSearch={setSearchKeyword}
                                searchDisabled={!searchEnabled}
                                onScanWithMode={showLibraryActions ? handleScanWithMode : undefined}
                                onEditLibrary={showLibraryActions && currentLib ? () => setEditingLib(currentLib) : undefined}
                                onRandomPlay={showListActions ? handleRandomPlay : undefined}
                                onSortSelect={showListActions ? handleSortSelect : undefined}
                                sortField={sortField}
                                sortOrder={sortOrder}
                                sortOptions={showListActions ? currentSortOptions : undefined}
                                onBackButtonClick={view !== 'libs' ? handleNavigateHome : undefined}
                                onClearFilter={activeFilter ? clearFilter : undefined}
                            />
                        )}

                        <div className={`content-region ${isDetailOpen ? 'detail-mode' : ''}`}>
                            {isDetailOpen ? (
                                <MediaDetail
                                    media={selectedMedia}
                                    onClose={() => setSelectedMedia(null)}
                                    onSelectMedia={setSelectedMedia}
                                    onSelectFilter={applyFilterFromDetail}
                                />
                            ) : (
                                renderWorkspaceContent()
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showLibModal && (
                <LibraryModal onClose={() => setShowLibModal(false)} onSuccess={handleLibCreated} />
            )}

            {editingLib && (
                <LibraryEditModal
                    library={editingLib}
                    onClose={() => setEditingLib(null)}
                    onSaved={handleLibSaved}
                    onDeleted={handleLibDeleted}
                />
            )}

            {statusMsg && (
                <div className="status-toast">{statusMsg}</div>
            )}

            {showScanProgressPanel && scanProgress && (
                <div className="scan-progress-panel">
                    <div className="scan-progress-title">{scanProgressText}</div>
                    {scanProgress.message && (
                        <div className="scan-progress-message">{scanProgress.message}</div>
                    )}
                </div>
            )}
        </div>
    );
}

export default App;
