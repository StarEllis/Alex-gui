import React, { useEffect, useRef, useState } from 'react';
import {
    ArrowDown,
    ArrowLeft,
    ChevronDown,
    Edit3,
    RefreshCw,
    Search,
    Shuffle,
} from 'lucide-react';
import { WindowToggleMaximise } from '../../wailsjs/runtime/runtime';

type MenuType = 'scan' | 'sort' | null;

interface TopBarProps {
    currentLibraryName: string;
    mediaCount: number;
    viewLabel?: string;
    filterLabel?: string;
    searchValue: string;
    onSearch: (keyword: string) => void;
    searchDisabled?: boolean;
    onScanWithMode?: (mode: string) => void;
    onEditLibrary?: () => void;
    onRandomPlay?: () => void;
    onSortSelect?: (field: string) => void;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    onBackButtonClick?: () => void;
    onClearFilter?: () => void;
}

const sortOptions = [
    { field: 'created_at', label: '加入日期' },
    { field: 'release_date', label: '发行日期' },
    { field: 'video_codec', label: '视频编码' },
    { field: 'last_watched', label: '最近观看' },
];

const scanOptions = [
    { mode: 'overwrite', label: '\u5b8c\u6574\u626b\u63cf' },
    { mode: 'delete_update', label: '\u6e05\u7406\u5e76\u626b\u63cf' },
    { mode: 'incremental', label: '\u626b\u63cf' },
];

const getSortLabel = (field: string) => {
    switch (field) {
        case 'release_date':
            return '发行日期';
        case 'video_codec':
            return '视频编码';
        case 'last_watched':
            return '最近观看';
        case 'created_at':
        default:
            return '加入日期';
    }
};

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

const TopBar: React.FC<TopBarProps> = ({
    currentLibraryName,
    mediaCount,
    viewLabel,
    filterLabel,
    searchValue,
    onSearch,
    searchDisabled = false,
    onScanWithMode,
    onEditLibrary,
    onRandomPlay,
    onSortSelect,
    sortField = 'created_at',
    sortOrder = 'desc',
    onBackButtonClick,
    onClearFilter,
}) => {
    const [openMenu, setOpenMenu] = useState<MenuType>(null);
    const [confirmScanMode, setConfirmScanMode] = useState<'overwrite' | null>(null);
    const menuRootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!menuRootRef.current?.contains(event.target as Node)) {
                setOpenMenu(null);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpenMenu(null);
                setConfirmScanMode(null);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const handleScanModeClick = (mode: string) => {
        setOpenMenu(null);
        if (mode === 'overwrite') {
            setConfirmScanMode('overwrite');
            return;
        }
        onScanWithMode?.(mode);
    };

    const handleHeaderDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (shouldIgnoreHeaderDoubleClick(event.target)) {
            return;
        }

        WindowToggleMaximise();
    };

    const countLabel = `${mediaCount.toLocaleString()} 个项目`;
    const headerHint = filterLabel || viewLabel || '';

    return (
        <>
            <div className="topbar" ref={menuRootRef} onDoubleClick={handleHeaderDoubleClick}>
                <div className="workspace-header-main">
                    <div className="workspace-header-heading">
                        <div className="workspace-header-title-row">
                            <span className="workspace-library-current" title={currentLibraryName}>
                                {currentLibraryName}
                            </span>
                            <span className="workspace-library-count">{countLabel}</span>
                        </div>
                        {headerHint && <div className="workspace-header-subtitle">{headerHint}</div>}
                    </div>

                    <div className="workspace-header-search no-drag">
                        <div className="workspace-search-group">
                            <label className={`workspace-search-shell ${searchDisabled ? 'disabled' : ''}`}>
                                <span className="workspace-search-icon-wrap">
                                    <Search size={15} strokeWidth={2} className="workspace-search-icon" />
                                </span>
                                <input
                                    type="text"
                                    className="workspace-search"
                                    placeholder="搜索媒体、演员、标签"
                                    value={searchValue}
                                    onChange={(event) => onSearch(event.target.value)}
                                    disabled={searchDisabled}
                                />
                            </label>
                        </div>
                    </div>

                    <div className="workspace-header-actions no-drag">
                            {onClearFilter && (
                                <button type="button" className="workspace-action-btn subtle" onClick={onClearFilter}>
                                    清除筛选
                                </button>
                            )}

                            {onBackButtonClick && (
                                <button type="button" className="workspace-action-btn subtle" onClick={onBackButtonClick}>
                                    <ArrowLeft size={14} />
                                    <span>返回主页</span>
                                </button>
                            )}

                            {onRandomPlay && (
                                <button type="button" className="workspace-action-btn" onClick={onRandomPlay}>
                                    <Shuffle size={15} />
                                    <span>随机玩玩</span>
                                </button>
                            )}

                            {onSortSelect && (
                                <div className={`workspace-menu-shell ${openMenu === 'sort' ? 'open' : ''}`}>
                                    <button
                                        type="button"
                                        className="workspace-action-btn"
                                        onClick={() => setOpenMenu((prev) => (prev === 'sort' ? null : 'sort'))}
                                    >
                                        <ArrowDown size={15} />
                                        <span>按{getSortLabel(sortField)}排序</span>
                                    </button>

                                    {openMenu === 'sort' && (
                                        <div className="workspace-dropdown-menu">
                                            {sortOptions.map((option) => {
                                                const isActive = sortField === option.field;
                                                return (
                                                    <button
                                                        key={option.field}
                                                        type="button"
                                                        className={`workspace-dropdown-item ${isActive ? 'active' : ''}`}
                                                        onClick={() => {
                                                            onSortSelect(option.field);
                                                            setOpenMenu(null);
                                                        }}
                                                    >
                                                        <span>{option.label}</span>
                                                        {isActive && (
                                                            <span className="workspace-dropdown-meta">
                                                                {sortOrder === 'desc' ? '降序' : '升序'}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {onScanWithMode && (
                                <div className={`workspace-menu-shell ${openMenu === 'scan' ? 'open' : ''}`}>
                                    <button
                                        type="button"
                                        className="workspace-action-btn compact"
                                        onClick={() => setOpenMenu((prev) => (prev === 'scan' ? null : 'scan'))}
                                    >
                                        <RefreshCw size={15} />
                                        <span>刷新</span>
                                        <ChevronDown size={13} />
                                    </button>

                                    {openMenu === 'scan' && (
                                        <div className="workspace-dropdown-menu">
                                            {scanOptions.map((option) => (
                                                <button
                                                    key={option.mode}
                                                    type="button"
                                                    className="workspace-dropdown-item"
                                                    onClick={() => handleScanModeClick(option.mode)}
                                                >
                                                    <span>{option.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {onEditLibrary && (
                                <button type="button" className="workspace-icon-btn" onClick={onEditLibrary} title="编辑当前媒体库">
                                    <Edit3 size={15} />
                                </button>
                            )}
                    </div>
                </div>
            </div>

            {confirmScanMode === 'overwrite' && (
                <div className="modal-overlay" onClick={() => setConfirmScanMode(null)}>
                    <div className="confirm-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="confirm-modal-header">
                            <span>提示</span>
                            <button type="button" className="confirm-modal-close" onClick={() => setConfirmScanMode(null)}>
                                ×
                            </button>
                        </div>

                        <div className="confirm-modal-body">
                            <div className="confirm-modal-icon">!</div>
                            <div className="confirm-modal-text">
                                你确定要覆盖刷新吗？这会清空当前媒体库并重新扫描。
                            </div>
                        </div>

                        <div className="confirm-modal-actions">
                            <button type="button" className="confirm-modal-btn ghost" onClick={() => setConfirmScanMode(null)}>
                                取消
                            </button>
                            <button
                                type="button"
                                className="confirm-modal-btn primary"
                                onClick={() => {
                                    onScanWithMode?.('overwrite');
                                    setConfirmScanMode(null);
                                }}
                            >
                                确定
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TopBar;
