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
type SortField = 'created_at' | 'release_date' | 'video_codec' | 'last_watched';
type SortOrder = 'asc' | 'desc';
type FilterState = { type: string; value: string; label: string } | null;
type FilterReturnContext = {
    view: ViewName;
    media: any | null;
} | null;

const APP_TITLE = 'ALEX';

const VIEW_LABELS: Record<Exclude<ViewName, 'libs'>, string> = {
    settings: '设置',
    actor: '演员',
    genre: '类别',
    watched: '已看',
    favorite: '收藏',
};

const SCAN_MODE_LABELS: Record<string, string> = {
    overwrite: '覆盖刷新',
    delete_update: '删改刷新',
    incremental: '增量刷新',
};

const SEARCHABLE_VIEWS = new Set<ViewName>(['libs', 'watched', 'favorite']);

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
    const [view, setView] = useState<ViewName>('libs');
    const [libraries, setLibraries] = useState<any[]>([]);
    const [currentLib, setCurrentLib] = useState<any>(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [showLibModal, setShowLibModal] = useState(false);
    const [editingLib, setEditingLib] = useState<any>(null);
    const [selectedMedia, setSelectedMedia] = useState<any>(null);
    const [statusMsg, setStatusMsg] = useState('');
    const [mediaCount, setMediaCount] = useState(0);
    const [activeFilter, setActiveFilter] = useState<FilterState>(null);
    const [filterReturnContext, setFilterReturnContext] = useState<FilterReturnContext>(null);
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [gridScrollTop, setGridScrollTop] = useState(0);
    const scanStartedAtRef = useRef<number | null>(null);
    const resetTitleTimerRef = useRef<number | null>(null);

    const setAppTitle = (title: string) => {
        WindowSetTitle(title);
    };

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
            setStatusMsg(`扫描开始：${data?.library_name || ''}`);
            updateScanTitle(data, '扫描 ');
        });

        const unsubProgress = EventsOn("scan:progress", (data: any) => {
            setStatusMsg(`扫描中：${data?.message || ''} [${data?.current || 0}/${data?.total || 0}]`);
            updateScanTitle(data, '扫描 ');
        });

        const unsubComplete = EventsOn("scan:completed", (data: any) => {
            showStatus(`扫描完成：${data?.library_name || ''}`);
            updateScanTitle(data, '完成 ');
            scanStartedAtRef.current = null;
            scheduleTitleReset();
            loadLibraries();
        });

        const unsubFail = EventsOn("scan:failed", (data: any) => {
            showStatus(`扫描失败：${data?.message || '未知错误'}`);
            updateScanTitle(data, '失败 ');
            scanStartedAtRef.current = null;
            scheduleTitleReset();
        });

        return () => {
            unsubStart();
            unsubProgress();
            unsubComplete();
            unsubFail();
            if (resetTitleTimerRef.current) {
                window.clearTimeout(resetTitleTimerRef.current);
            }
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

    const handleLibCreated = () => {
        setShowLibModal(false);
        loadLibraries();
        showStatus('新建媒体库成功');
    };

    const handleLibSaved = () => {
        setEditingLib(null);
        loadLibraries();
        showStatus('媒体库已保存');
    };

    const handleLibDeleted = () => {
        setEditingLib(null);
        setCurrentLib(null);
        loadLibraries();
        showStatus('媒体库已删除');
    };

    const handleScanWithMode = async (mode: string) => {
        if (!currentLib) {
            return;
        }
        try {
            await ScanLibraryWithMode(currentLib.id, mode);
            showStatus(`${SCAN_MODE_LABELS[mode] || mode}已启动`);
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
        if (nextField === sortField) {
            setSortOrder((prev) => prev === 'desc' ? 'asc' : 'desc');
            return;
        }
        setSortField(nextField);
        setSortOrder('desc');
    };

    const currentLibraryName = currentLib?.name || '未选择媒体库';
    const baseCount = typeof currentLib?.media_count === 'number' ? currentLib.media_count : mediaCount;
    const headerCount = (view === 'libs' || view === 'watched' || view === 'favorite') ? mediaCount : baseCount;
    const searchEnabled = Boolean(currentLib && SEARCHABLE_VIEWS.has(view));
    const showLibraryActions = Boolean(currentLib && view === 'libs');
    const showListActions = Boolean(currentLib && SEARCHABLE_VIEWS.has(view));
    const viewLabel = view === 'libs' ? undefined : VIEW_LABELS[view as Exclude<ViewName, 'libs'>];
    const isDetailOpen = Boolean(selectedMedia);

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
                        fetchFn={GetActorStats}
                        onSelect={(value, label) => applyFilterFromView('actor', { type: 'actor', value, label })}
                    />
                );
            case 'genre':
                return (
                    <CategoryGrid
                        type="genre"
                        libraryId={currentLib.id}
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
                                viewLabel={viewLabel}
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
                                onBackButtonClick={view !== 'libs' ? handleNavigateHome : undefined}
                                onClearFilter={activeFilter ? clearFilter : undefined}
                            />
                        )}

                        <div className={`content-region ${isDetailOpen ? 'detail-mode' : ''}`}>
                            {isDetailOpen ? (
                                <MediaDetail
                                    media={selectedMedia}
                                    onClose={() => setSelectedMedia(null)}
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
        </div>
    );
}

export default App;
