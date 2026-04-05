import React, { useState, useRef, useEffect } from 'react';

interface TopBarProps {
    libName: string;
    mediaCount: number;
    onSearch: (keyword: string) => void;
    onScan: () => void;
    onScanWithMode: (mode: string) => void;
}

const TopBar: React.FC<TopBarProps> = ({ libName, mediaCount, onSearch, onScan, onScanWithMode }) => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        if (showMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMenu]);

    const handleMenuClick = (mode: string) => {
        setShowMenu(false);
        onScanWithMode(mode);
    };

    return (
        <div className="topbar">
            {/* 左侧：汉堡菜单与名称 */}
            <span className="topbar-hamburger">☰</span>
            <span className="topbar-lib-name">{libName || "媒体库"}</span>
            <span className="topbar-count">{mediaCount || 0}个项目</span>

            {/* 中间：胶囊按钮组 */}
            <button className="topbar-btn">
                <span className="topbar-btn-icon">▶</span> 全部播放
            </button>
            <button className="topbar-btn">
                <span className="topbar-btn-icon">⇄</span> 随机播放
            </button>

            <button className="topbar-btn">
                <span className="topbar-btn-icon">↕</span> 按加入日期排序
            </button>
            
            <button className="topbar-btn" onClick={onScan} title="刷新/扫描">
                <span className="topbar-btn-icon">↻</span>
            </button>

            {/* 更多菜单按钮 */}
            <div style={{ position: 'relative' }} ref={menuRef}>
                <button className="topbar-btn" onClick={() => setShowMenu(!showMenu)} title="更多">···</button>
                {showMenu && (
                    <div className="dropdown-menu">
                        <div className="dropdown-item" onClick={() => handleMenuClick('overwrite')}>覆盖刷新</div>
                        <div className="dropdown-item" onClick={() => handleMenuClick('delete_update')}>删改刷新</div>
                        <div className="dropdown-item" onClick={() => handleMenuClick('incremental')}>新增刷新</div>
                    </div>
                )}
            </div>

            {/* 右侧：搜索框 */}
            <div className="topbar-search-container">
                <input
                    type="text"
                    className="topbar-search"
                    placeholder="搜索..."
                    onChange={e => onSearch(e.target.value)}
                />
            </div>
        </div>
    );
};

export default TopBar;
