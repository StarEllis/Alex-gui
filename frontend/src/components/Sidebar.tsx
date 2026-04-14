import React, { useEffect, useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Copy,
    Eye,
    FolderPlus,
    Heart,
    Minus,
    Pencil,
    Settings,
    Shapes,
    Square,
    UserRound,
    X,
} from 'lucide-react';
import { Quit, WindowIsMaximised, WindowMinimise, WindowToggleMaximise } from '../../wailsjs/runtime/runtime';
import logoImage from '../assets/images/logo-universal.png';
import { formatLibraryPathLabel, getLibraryConfig } from '../utils/library';

interface SidebarProps {
    appName: string;
    libraries: any[];
    currentLib: any;
    currentView: string;
    onSelectLib: (lib: any) => void;
    onOpenSettings: () => void;
    onSelectView: (view: 'libs' | 'actor' | 'genre' | 'watched' | 'favorite') => void;
    onAddLib: () => void;
    onEditLib: (lib: any) => void;
}

const navItems = [
    { key: 'watched', label: '已看', icon: Eye },
    { key: 'favorite', label: '收藏', icon: Heart },
    { key: 'actor', label: '演员', icon: UserRound },
    { key: 'genre', label: '类别', icon: Shapes },
] as const;

const shouldIgnoreHeaderDoubleClick = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return Boolean(
        target.closest(
            '.no-drag, button, input, select, textarea, a, [role="button"], [data-no-window-toggle="true"]',
        ),
    );
};

const Sidebar: React.FC<SidebarProps> = ({
    appName,
    libraries,
    currentLib,
    currentView,
    onSelectLib,
    onOpenSettings,
    onSelectView,
    onAddLib,
    onEditLib,
}) => {
    const [expandedLibId, setExpandedLibId] = useState<string | null>(null);
    const [isLibrariesCollapsed, setIsLibrariesCollapsed] = useState(false);
    const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
    const [isMaximised, setIsMaximised] = useState(false);

    useEffect(() => {
        const syncWindowState = () => {
            WindowIsMaximised().then(setIsMaximised).catch(() => undefined);
        };

        syncWindowState();
        window.addEventListener('resize', syncWindowState);

        return () => {
            window.removeEventListener('resize', syncWindowState);
        };
    }, []);

    const toggleLibraryFolders = (libraryId: string) => {
        setExpandedLibId((prev) => (prev === libraryId ? null : libraryId));
    };

    const toggleLibrariesSection = () => {
        setIsLibrariesCollapsed((prev) => !prev);
    };

    const toggleStatsSection = () => {
        setIsStatsCollapsed((prev) => !prev);
    };

    const handleWindowToggle = () => {
        WindowToggleMaximise();
        window.setTimeout(() => {
            WindowIsMaximised().then(setIsMaximised).catch(() => undefined);
        }, 80);
    };

    const handleHeaderDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (shouldIgnoreHeaderDoubleClick(event.target)) {
            return;
        }

        handleWindowToggle();
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header" onDoubleClick={handleHeaderDoubleClick}>
                <div className="sidebar-window-controls">
                    <button type="button" className="sidebar-window-btn close" onClick={Quit} aria-label="关闭">
                        <X size={13} />
                    </button>
                    <button type="button" className="sidebar-window-btn" onClick={WindowMinimise} aria-label="最小化">
                        <Minus size={13} />
                    </button>
                    <button type="button" className="sidebar-window-btn" onClick={handleWindowToggle} aria-label="最大化">
                        {isMaximised ? <Copy size={12} /> : <Square size={12} />}
                    </button>
                </div>

                <div className="sidebar-brand">
                    <div className="sidebar-brand-mark" aria-hidden="true">
                        <img className="sidebar-brand-mark-image" src={logoImage} alt="" />
                    </div>
                    <div className="sidebar-brand-copy">
                        <span className="sidebar-brand-name">{appName}</span>
                        <span className="sidebar-brand-subtitle">媒体库</span>
                    </div>
                </div>
            </div>

            <div className="sidebar-main">
                <div className="sidebar-group">
                    <div className="sidebar-group-title">
                        <span>我的媒体</span>
                        <div className="sidebar-group-actions">
                            <button
                                type="button"
                                className="sidebar-group-add"
                                onClick={onAddLib}
                                aria-label="新建媒体库"
                                title="新建媒体库"
                            >
                                <FolderPlus size={13} strokeWidth={2} />
                            </button>
                            <button
                                type="button"
                                className={`sidebar-group-toggle ${isLibrariesCollapsed ? 'collapsed' : ''}`}
                                onClick={toggleLibrariesSection}
                                aria-label={isLibrariesCollapsed ? '展开媒体列表' : '收起媒体列表'}
                                aria-expanded={!isLibrariesCollapsed}
                            >
                                <ChevronDown size={13} />
                            </button>
                        </div>
                    </div>

                    {!isLibrariesCollapsed && (
                        <div className="sidebar-library-list">
                            {libraries.map((lib) => {
                                const isExpanded = expandedLibId === lib.id;
                                const isActive = currentLib?.id === lib.id;
                                const { folderPaths } = getLibraryConfig(lib);

                                return (
                                    <div key={lib.id} className={`sidebar-library-item ${isExpanded ? 'expanded' : ''}`}>
                                        <div className={`sidebar-library-row ${isActive ? 'active' : ''}`}>
                                            <button
                                                type="button"
                                                className={`sidebar-library-toggle ${isExpanded ? 'expanded' : ''}`}
                                                onClick={() => toggleLibraryFolders(lib.id)}
                                                aria-label={isExpanded ? '收起媒体库目录' : '展开媒体库目录'}
                                            >
                                                <ChevronRight size={13} />
                                            </button>

                                            <button type="button" className="sidebar-library-main" onClick={() => onSelectLib(lib)}>
                                                <span className="sidebar-library-name" title={lib.name}>
                                                    {lib.name}
                                                </span>
                                                <span className="sidebar-library-count">
                                                    {(lib.media_count || 0).toLocaleString()}
                                                </span>
                                            </button>

                                            <button
                                                type="button"
                                                className="sidebar-library-edit"
                                                title="编辑媒体库"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onEditLib(lib);
                                                }}
                                            >
                                                <Pencil size={13} />
                                            </button>
                                        </div>

                                        {isExpanded && (
                                            <div className="sidebar-library-paths">
                                                {folderPaths.length > 0 ? (
                                                    folderPaths.map((path) => (
                                                        <div key={path} className="sidebar-library-path" title={path}>
                                                            {formatLibraryPathLabel(path, folderPaths)}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="sidebar-library-path empty">未配置文件夹</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="sidebar-group">
                    <div className="sidebar-group-title">
                        <span>信息统计</span>
                        <button
                            type="button"
                            className={`sidebar-group-toggle ${isStatsCollapsed ? 'collapsed' : ''}`}
                            onClick={toggleStatsSection}
                            aria-label={isStatsCollapsed ? '展开信息统计' : '收起信息统计'}
                            aria-expanded={!isStatsCollapsed}
                        >
                            <ChevronDown size={13} />
                        </button>
                    </div>

                    {!isStatsCollapsed && (
                        <div className="sidebar-nav-list">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = currentView === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                                        onClick={() => onSelectView(item.key)}
                                    >
                                        <Icon size={16} strokeWidth={1.85} />
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="sidebar-footer">
                <button
                    type="button"
                    className={`sidebar-nav-item sidebar-settings-item ${currentView === 'settings' ? 'active' : ''}`}
                    onClick={onOpenSettings}
                >
                    <Settings size={16} strokeWidth={1.85} />
                    <span>设置</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
