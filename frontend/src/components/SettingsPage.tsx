import React, { useState, useEffect } from 'react';
import { GetDesktopSettings, UpdateDesktopSettings, RestartApp } from "../../wailsjs/go/main/App";

interface SettingsPageProps {
    onClose: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onClose }) => {
    const [settings, setSettings] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'appearance' | 'playback' | 'shortcut' | 'scan' | 'emby' | 'about'>('appearance');
    const [msg, setMsg] = useState('');

    useEffect(() => {
        GetDesktopSettings().then((res: any) => {
            if (res) setSettings(res);
        }).catch(console.error);
    }, []);

    const handleSave = async () => {
        try {
            await UpdateDesktopSettings(settings);
            setMsg("设置已保存！部分设置可能需要重启生效。");
            setTimeout(() => setMsg(''), 3000);
        } catch (e: any) {
            setMsg("保存失败: " + e);
        }
    };

    const handleRestart = () => {
        if (window.confirm("确定要重启软件吗？")) {
            RestartApp();
        }
    };

    if (!settings) return <div style={{ padding: '20px', color: 'var(--text-dim)' }}>加载中...</div>;

    const renderAppearance = () => (
        <>
            <div className="settings-section">
                <div className="settings-section-title">外观设置</div>
                <div className="settings-row">
                    <div className="settings-label">程序皮肤颜色</div>
                    <div className="settings-control">
                        <select className="settings-select" value={settings.theme} onChange={e => setSettings({...settings, theme: e.target.value})}>
                            <option value="dark">黑色 (Dark)</option>
                            <option value="light">白色 (Light)</option>
                            <option value="blue">深蓝 (Navy)</option>
                        </select>
                    </div>
                </div>
                <div className="settings-row">
                    <div className="settings-label">封面圆角度 (px)</div>
                    <div className="settings-control">
                        <input className="settings-input" type="number" value={settings.poster_radius} onChange={e => setSettings({...settings, poster_radius: parseInt(e.target.value) || 0})} />
                    </div>
                </div>
                <div className="settings-checkbox-group">
                    <label className="settings-checkbox-row">
                        <input type="checkbox" checked={settings.show_subtitle_tag} onChange={e => setSettings({...settings, show_subtitle_tag: e.target.checked})} />
                        <span className="settings-checkbox-label">显示字幕标签</span>
                    </label>
                    <label className="settings-checkbox-row">
                        <input type="checkbox" checked={settings.show_resolution_tag} onChange={e => setSettings({...settings, show_resolution_tag: e.target.checked})} />
                        <span className="settings-checkbox-label">显示分辨率标签</span>
                    </label>
                </div>
            </div>

            <div className="settings-section">
                <div className="settings-section-title">播放设置</div>
                <label className="settings-checkbox-row" style={{marginBottom: '15px'}}>
                    <input type="checkbox" checked={settings.use_external_player} onChange={e => setSettings({...settings, use_external_player: e.target.checked})} />
                    <span className="settings-checkbox-label">调用本地播放器 (External Player)</span>
                </label>
                <div className="settings-row">
                    <div className="settings-label">本地播放器路径</div>
                    <div className="settings-control">
                        <input className="settings-input" type="text" value={settings.player_path} onChange={e => setSettings({...settings, player_path: e.target.value})} />
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <div className="settings-section-title">快捷 / 软件设置</div>
                <div className="settings-checkbox-group">
                    <label className="settings-checkbox-row">
                        <input type="checkbox" checked={settings.min_to_tray} onChange={e => setSettings({...settings, min_to_tray: e.target.checked})} />
                        <span className="settings-checkbox-label">最小化到托盘</span>
                    </label>
                    <label className="settings-checkbox-row">
                        <input type="checkbox" checked={settings.start_with_os} onChange={e => setSettings({...settings, start_with_os: e.target.checked})} />
                        <span className="settings-checkbox-label">开机自动启动</span>
                    </label>
                </div>
                <div style={{marginTop: '20px'}}>
                    <button className="settings-btn-outline" onClick={handleRestart} style={{borderColor: '#d32f2f', color: '#f44336'}}>软件重启</button>
                </div>
            </div>
        </>
    );

    const renderScan = () => (
        <div className="settings-section">
            <div className="settings-section-title">扫描页（证据式实现）</div>
            
            <div className="settings-sub-header">媒体库刷新逻辑</div>
            <div className="settings-checkbox-group">
                <label className="settings-checkbox-row">
                    <input type="checkbox" checked={settings.skip_no_nfo} onChange={e => setSettings({...settings, skip_no_nfo: e.target.checked})} />
                    <span className="settings-checkbox-label">无 NFO 时跳过</span>
                </label>
                <label className="settings-checkbox-row">
                    <input type="checkbox" checked={settings.get_resolution} onChange={e => setSettings({...settings, get_resolution: e.target.checked})} />
                    <span className="settings-checkbox-label">获取分辨率</span>
                </label>
                <label className="settings-checkbox-row">
                    <input type="checkbox" checked={settings.use_everything} onChange={e => setSettings({...settings, use_everything: e.target.checked})} />
                    <span className="settings-checkbox-label">调用 Everything 扫描</span>
                </label>
            </div>
            
            <div className="settings-row" style={{marginTop: '15px'}}>
                <div className="settings-label">Everything 地址</div>
                <div className="settings-control">
                    <input className="settings-input" type="text" value={settings.everything_addr} onChange={e => setSettings({...settings, everything_addr: e.target.value})} />
                </div>
            </div>

            <div className="settings-sub-header">路径与挂载管理（UI+模拟数据）</div>
            <div className="settings-action-row">
                <button className="settings-btn-outline" onClick={() => console.log('Mock Add')}>手动添加</button>
                <button className="settings-btn-outline" onClick={() => console.log('Mock Add Dir')}>添加目录</button>
                <button className="settings-btn-outline">获取挂载</button>
                <button className="settings-btn-outline">清空</button>
            </div>

            <div className="settings-table-container">
                <div className="settings-table-wrapper">
                    <table className="settings-table">
                        <thead><tr><th>序号</th><th>附加路径</th><th>操作</th></tr></thead>
                        <tbody>
                            <tr><td>1</td><td>C:\Media\Extra</td><td>[删除]</td></tr>
                            <tr><td>2</td><td>D:\Movies\Unscanned</td><td>[删除]</td></tr>
                        </tbody>
                    </table>
                </div>
                <div className="settings-table-wrapper">
                    <table className="settings-table">
                        <thead><tr><th>序号</th><th>视频主路径 (已接管)</th></tr></thead>
                        <tbody>
                            <tr><td>1</td><td>D:\ALEX_Media\Movies</td></tr>
                            <tr><td>2</td><td>E:\TV_Library</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderEmby = () => (
        <div className="settings-section">
            <div className="settings-section-title">Emby 连接中心</div>
            <label className="settings-checkbox-row" style={{marginBottom: '20px'}}>
                <input type="checkbox" checked={settings.emby_enabled} onChange={e => setSettings({...settings, emby_enabled: e.target.checked})} />
                <span className="settings-checkbox-label">启用 Emby 状态同步</span>
            </label>
            <div className="settings-row">
                <div className="settings-label">User Name</div>
                <div className="settings-control"><input className="settings-input" type="text" value={settings.emby_user || ''} onChange={e => setSettings({...settings, emby_user: e.target.value})} /></div>
            </div>
            <div className="settings-row">
                <div className="settings-label">Server URL</div>
                <div className="settings-control"><input className="settings-input" type="text" value={settings.emby_url || ''} onChange={e => setSettings({...settings, emby_url: e.target.value})} /></div>
            </div>
            <div className="settings-row">
                <div className="settings-label">API Key</div>
                <div className="settings-control"><input className="settings-input" type="password" value={settings.emby_api_key || ''} onChange={e => setSettings({...settings, emby_api_key: e.target.value})} /></div>
            </div>
            <div className="settings-footer">
                <button className="settings-btn-outline" onClick={() => alert('Emby 验证逻辑暂未绑定后端')}>测试连接</button>
            </div>
        </div>
    );

    const renderAbout = () => (
        <div className="settings-section">
            <div className="settings-section-title">关于 ALEX 设置中心</div>
            <div className="settings-version-label">BUILD 20240405-FIX</div>
            <div className="settings-about-box">
                <p><strong>ALEX Media Manager</strong></p>
                <p>当前的 3 个子视图（扫描/Emby/关于）已在 JSX 中完整定义。</p>
                <div style={{marginTop: '20px', fontSize: '11px', color: 'var(--text-dim)'}}>
                    警告：此版本包含为了 UI 复刻而引入的模拟表格数据。
                </div>
            </div>
        </div>
    );

    return (
        <div className="settings-container">
            <div className="settings-sidebar">
                <div className="settings-sidebar-header">设置</div>
                <div className={`settings-nav-item ${activeTab === 'appearance' ? 'active' : ''}`} onClick={() => setActiveTab('appearance')}>常规设置</div>
                <div className={`settings-nav-item ${activeTab === 'scan' ? 'active' : ''}`} onClick={() => setActiveTab('scan')}>库扫描</div>
                <div className={`settings-nav-item ${activeTab === 'emby' ? 'active' : ''}`} onClick={() => setActiveTab('emby')}>Emby 连接</div>
                <div className={`settings-nav-item ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>关于软件</div>
                <div className="sidebar-spacer"></div>
                <div className="settings-nav-item" onClick={onClose}>← 返回主页面</div>
            </div>

            <div className="settings-main">
                {activeTab === 'appearance' && renderAppearance()}
                {activeTab === 'scan' && renderScan()}
                {activeTab === 'emby' && renderEmby()}
                {activeTab === 'about' && renderAbout()}

                {activeTab !== 'about' && (
                    <div className="settings-footer">
                        <button className="settings-btn" onClick={handleSave}>保存当前设置</button>
                        {msg && <div style={{ fontSize: '12px', color: 'var(--accent)' }}>{msg}</div>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPage;
