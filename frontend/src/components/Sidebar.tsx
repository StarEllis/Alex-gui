import React from 'react';

interface SidebarProps {
    libraries: any[];
    currentLib: any;
    currentView: string;
    onSelectLib: (lib: any) => void;
    onOpenSettings: () => void;
    onSelectView: (view: 'libs' | 'directory' | 'actor' | 'genre' | 'series' | 'watched' | 'favorite') => void;
    onAddLib: () => void;
    onEditLib: (lib: any) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ libraries, currentLib, currentView, onSelectLib, onOpenSettings, onSelectView, onAddLib, onEditLib }) => {
    return (
        <div className="sidebar">
            {/* 顶部品牌与新建入口 */}
            <div className="sidebar-logo">
                <i>▶</i> ALEX
            </div>

            <div className={`sidebar-nav-item ${currentView === 'add' ? 'active' : ''}`} style={{ marginBottom: '10px', paddingLeft: '16px', fontWeight: 600 }} onClick={onAddLib}>
                <span>新建媒体库</span>
                <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.5 }}>🔒</span>
            </div>

            {/* 我的媒体分组 */}
            <div className="sidebar-section">
                <div className="sidebar-section-title">
                    <span>我的媒体</span>
                    <span style={{ fontSize: '10px' }}>▼</span>
                </div>
                {libraries.map(lib => (
                    <div
                        key={lib.id}
                        className={`sidebar-lib-item ${currentLib?.id === lib.id && currentView === 'libs' ? 'active' : ''}`}
                        onClick={() => onSelectLib(lib)}
                    >
                        <span style={{ marginRight: '6px', opacity: 0.6 }}>{'>'}</span>
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lib.name}</span>
                        <span className="sidebar-count">{lib.media_count?.toLocaleString() || 0}</span>
                        <span
                            className="sidebar-lib-edit"
                            onClick={(e) => { e.stopPropagation(); onEditLib(lib); }}
                            title="编辑"
                        >✎</span>
                    </div>
                ))}
            </div>

            {/* 信息统计分组 */}
            <div className="sidebar-section">
                <div className="sidebar-section-title">
                    <span>信息统计</span>
                    <span style={{ fontSize: '10px' }}>▼</span>
                </div>
                <div className={`sidebar-nav-item ${currentView === 'watched' ? 'active' : ''}`} onClick={() => onSelectView('watched')}>已看</div>
                <div className={`sidebar-nav-item ${currentView === 'favorite' ? 'active' : ''}`} onClick={() => onSelectView('favorite')}>收藏</div>
                <div className={`sidebar-nav-item ${currentView === 'directory' ? 'active' : ''}`} onClick={() => onSelectView('directory')}>目录</div>
                <div className={`sidebar-nav-item ${currentView === 'actor' ? 'active' : ''}`} onClick={() => onSelectView('actor')}>演员</div>
                <div className={`sidebar-nav-item ${currentView === 'genre' ? 'active' : ''}`} onClick={() => onSelectView('genre')}>类别</div>
                <div className={`sidebar-nav-item ${currentView === 'series' ? 'active' : ''}`} onClick={() => onSelectView('series')}>系列</div>
            </div>

            {/* 服务选项分组 */}
            <div className="sidebar-section">
                <div className="sidebar-section-title">
                    <span>服务选项</span>
                    <span style={{ fontSize: '10px' }}>▼</span>
                </div>
            </div>

            <div className="sidebar-spacer"></div>

            {/* 底部设置 */}
            <div className="sidebar-bottom">
                <div className={`sidebar-nav-item ${currentView === 'settings' ? 'active' : ''}`} style={{ background: currentView === 'settings' ? 'var(--accent)' : 'transparent', color: currentView === 'settings' ? '#fff' : 'var(--text-secondary)' }} onClick={onOpenSettings}>
                    设置
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
