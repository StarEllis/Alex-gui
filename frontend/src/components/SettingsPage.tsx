import React, { useEffect, useState } from 'react';
import { GetDesktopSettings, SelectProgram, UpdateDesktopSettings } from "../../wailsjs/go/main/App";

interface SettingsPageProps {
    onClose: () => void;
}

const TEXT = {
    unknownError: '\u672a\u77e5\u9519\u8bef',
    loadFailed: '\u52a0\u8f7d\u8bbe\u7f6e\u5931\u8d25',
    saveSuccess: '\u8bbe\u7f6e\u5df2\u4fdd\u5b58',
    saveFailed: '\u4fdd\u5b58\u5931\u8d25',
    selectProgramFailed: '\u9009\u62e9\u7a0b\u5e8f\u5931\u8d25',
    loading: '\u52a0\u8f7d\u4e2d...',
    settings: '\u8bbe\u7f6e',
    general: '\u5e38\u89c4\u8bbe\u7f6e',
    scan: '\u626b\u63cf',
    about: '\u5173\u4e8e',
    back: '\u8fd4\u56de',
    startup: '\u5f00\u673a\u542f\u52a8',
    startupDesc: '\u542f\u52a8\u7cfb\u7edf\u540e\u81ea\u52a8\u8fd0\u884c ALEX\u3002',
    tray: '\u6700\u5c0f\u5316\u5230\u6258\u76d8',
    trayDesc: '\u5173\u95ed\u4e3b\u7a97\u53e3\u65f6\u4fdd\u7559\u5728\u7cfb\u7edf\u6258\u76d8\u4e2d\u3002',
    externalPlayer: '\u4f7f\u7528\u5916\u90e8\u64ad\u653e\u5668',
    externalPlayerDesc: '\u64ad\u653e\u89c6\u9891\u65f6\u4f18\u5148\u4f7f\u7528\u4f60\u6307\u5b9a\u7684\u672c\u5730\u64ad\u653e\u5668\u3002',
    externalPlayerName: '\u5916\u90e8\u64ad\u653e\u5668',
    externalPlayerHint: '\u672a\u9009\u62e9\u65f6\uff0c\u5c06\u4f7f\u7528\u7cfb\u7edf\u9ed8\u8ba4\u64ad\u653e\u5668\u6253\u5f00\u3002',
    chooseProgram: '\u9009\u62e9\u7a0b\u5e8f',
    clear: '\u6e05\u7a7a',
    save: '\u4fdd\u5b58',
    placeholderNote: '\u8fd9\u4e00\u9875\u6682\u65f6\u4fdd\u6301\u539f\u6837\uff0c\u4e0d\u5f71\u54cd\u672c\u6b21\u8bbe\u7f6e\u6536\u655b\u3002',
    scanSettings: '\u626b\u63cf\u8bbe\u7f6e',
    useEverything: '\u8c03\u7528 Everything',
    useEverythingDesc: '\u626b\u63cf\u7535\u5f71\u5e93\u65f6\u4f18\u5148\u8d70 Everything HTTP \u76d8\u70b9\u6587\u4ef6\u548c\u8ba1\u6570\uff0c\u65b0\u589e\u5237\u65b0\u3001\u5220\u6539\u5237\u65b0\u90fd\u4f1a\u66f4\u5feb\u3002',
    everythingAddr: 'Everything \u7f51\u5740',
    everythingAddrDesc: '\u586b Everything HTTP \u670d\u52a1\u5730\u5740\uff0c\u4f8b\u5982 http://127.0.0.1:8077\u3002',
    everythingAddrPlaceholder: 'http://127.0.0.1:8077',
    everythingTip: 'Everything \u73b0\u5728\u4f1a\u53c2\u4e0e\u626b\u63cf\u4e3b\u6d41\u7a0b\uff1b\u6b63\u5f0f\u5165\u5e93\u524d\u4ecd\u4f1a\u5bf9\u547d\u4e2d\u6587\u4ef6\u505a\u672c\u5730\u6821\u9a8c\uff0c\u907f\u514d\u7d22\u5f15\u5ef6\u8fdf\u8bef\u5224\u3002',
    videoThumbnail: '\u81ea\u52a8\u622a\u56fe\u8865\u56fe',
    videoThumbnailDesc: '\u53ea\u5bf9\u65e0 NFO \u4e14\u65f6\u957f\u8db3\u591f\u7684\u7535\u5f71\u89c6\u9891\u751f\u6210 poster\u3001fanart \u548c\u9884\u89c8\u56fe\u3002',
    thumbnailMinDuration: '\u6700\u77ed\u65f6\u957f\uff08\u5206\u949f\uff09',
    thumbnailMinDurationDesc: '\u53ea\u6709\u4e25\u683c\u5927\u4e8e\u8fd9\u4e2a\u65f6\u957f\u7684\u89c6\u9891\u624d\u4f1a\u89e6\u53d1\u81ea\u52a8\u622a\u56fe\u3002',
    thumbnailPreviewCount: '\u9884\u89c8\u56fe\u6570\u91cf',
    thumbnailPreviewCountDesc: '\u751f\u6210\u5230 extrafanart \u76ee\u5f55\u7684\u9884\u89c8\u56fe\u5f20\u6570\u3002',
    remoteAccess: '\u8fdc\u7a0b Jellyfin',
    remoteAccessDesc: 'Infuse \u53ef\u4ee5\u901a\u8fc7 Jellyfin sidecar \u8fde\u63a5\u8fd9\u4e2a\u5a92\u4f53\u5e93\u3002',
    remoteBindHost: '\u76d1\u542c\u5730\u5740',
    remoteBindHostDesc: '\u586b 0.0.0.0 \u53ef\u4ee5\u88ab\u5c40\u57df\u7f51\u8bbe\u5907\u8bbf\u95ee\uff0c127.0.0.1 \u5219\u53ea\u9650\u672c\u673a\u3002',
    remoteUsername: '\u8fdc\u7a0b\u7528\u6237\u540d',
    remoteUsernameDesc: 'Jellyfin sidecar \u4f7f\u7528\u8fd9\u7ec4\u767b\u5f55\u51ed\u636e\u3002',
    remotePassword: '\u8fdc\u7a0b\u5bc6\u7801',
    remotePasswordDesc: '\u5efa\u8bae\u4f7f\u7528\u4e00\u4e2a\u5355\u72ec\u7684 Infuse \u8fde\u63a5\u5bc6\u7801\u3002',
    jellyfinEnabled: '\u542f\u7528 Jellyfin Sidecar',
    jellyfinEnabledDesc: '\u63d0\u4f9b Infuse \u66f4\u719f\u6089\u7684\u5a92\u4f53\u5e93\u3001\u6d77\u62a5\u3001\u64ad\u653e\u548c\u8fdb\u5ea6\u63a5\u53e3\u3002',
    jellyfinPort: 'Jellyfin \u7aef\u53e3',
    jellyfinPortDesc: '\u9ed8\u8ba4 18096\u3002Infuse \u91cc\u53ef\u6309 Jellyfin \u670d\u52a1\u5668\u6dfb\u52a0\u3002',
    jellyfinServerName: '\u670d\u52a1\u540d\u79f0',
    jellyfinServerNameDesc: '\u5ba2\u6237\u7aef\u91cc\u663e\u793a\u7684\u670d\u52a1\u5668\u540d\u3002',
    jellyfinHint: 'Jellyfin \u5730\u5740',
    remoteLanHint: '\u5982\u679c\u76d1\u542c\u5730\u5740\u586b 0.0.0.0\uff0c\u4e0b\u9762\u7684 URL \u91cc\u8bf7\u628a 0.0.0.0 \u66ff\u6362\u6210\u8fd9\u53f0\u673a\u5668\u7684\u5c40\u57df\u7f51 IP\u3002',
} as const;

const cloneSettings = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const formatError = (error: unknown) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return TEXT.unknownError;
};

const getProgramName = (programPath: string) => {
    if (!programPath) {
        return '';
    }
    const normalized = programPath.replace(/\\/g, '/');
    return normalized.split('/').pop() || programPath;
};

const getThumbnailDurationMinutes = (seconds: unknown) => {
    const parsed = Number(seconds);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 20;
    }
    return Math.max(1, Math.round(parsed / 60));
};

const getThumbnailPreviewCount = (count: unknown) => {
    const parsed = Number(count);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 6;
    }
    return Math.max(1, Math.min(12, Math.round(parsed)));
};

const SettingsPage: React.FC<SettingsPageProps> = ({ onClose }) => {
    const [settings, setSettings] = useState<any>(null);
    const [savedSettings, setSavedSettings] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'scan' | 'remote' | 'about'>('general');
    const [msg, setMsg] = useState('');

    useEffect(() => {
        GetDesktopSettings()
            .then((res: any) => {
                if (!res) {
                    return;
                }
                const nextSettings = cloneSettings(res);
                setSettings(nextSettings);
                setSavedSettings(cloneSettings(nextSettings));
            })
            .catch((error) => {
                setMsg(`${TEXT.loadFailed}\uff1a${formatError(error)}`);
            });
    }, []);

    const hasChanges = !!settings && !!savedSettings && JSON.stringify(settings) !== JSON.stringify(savedSettings);

    const updateSettings = (patch: Record<string, unknown>) => {
        setSettings((prev: any) => (prev ? { ...prev, ...patch } : prev));
        setMsg('');
    };

    const handleSave = async () => {
        if (!settings) {
            return;
        }
        try {
            await UpdateDesktopSettings(settings);
            const nextSaved = cloneSettings(settings);
            setSavedSettings(nextSaved);
            setSettings(cloneSettings(nextSaved));
            setMsg(TEXT.saveSuccess);
            window.setTimeout(() => setMsg(''), 2500);
        } catch (error) {
            setMsg(`${TEXT.saveFailed}\uff1a${formatError(error)}`);
        }
    };

    const handleSelectProgram = async () => {
        try {
            const programPath = await SelectProgram();
            if (!programPath) {
                return;
            }
            updateSettings({ player_path: programPath });
        } catch (error) {
            setMsg(`${TEXT.selectProgramFailed}\uff1a${formatError(error)}`);
        }
    };

    const handleClearProgram = () => {
        updateSettings({ player_path: '' });
    };

    if (!settings) {
        return <div style={{ padding: '20px', color: 'var(--text-dim)' }}>{TEXT.loading}</div>;
    }

    const renderGeneral = () => (
        <div className="settings-section">
            <div className="settings-section-title">{TEXT.general}</div>

            <div className="settings-card">
                <label className="settings-toggle-row">
                    <div className="settings-toggle-copy">
                        <div className="settings-label">{TEXT.startup}</div>
                        <div className="settings-description">{TEXT.startupDesc}</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={!!settings.start_with_os}
                        onChange={(e) => updateSettings({ start_with_os: e.target.checked })}
                    />
                </label>

                <label className="settings-toggle-row">
                    <div className="settings-toggle-copy">
                        <div className="settings-label">{TEXT.tray}</div>
                        <div className="settings-description">{TEXT.trayDesc}</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={!!settings.min_to_tray}
                        onChange={(e) => updateSettings({ min_to_tray: e.target.checked })}
                    />
                </label>

                <label className="settings-toggle-row">
                    <div className="settings-toggle-copy">
                        <div className="settings-label">{TEXT.externalPlayer}</div>
                        <div className="settings-description">{TEXT.externalPlayerDesc}</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={!!settings.use_external_player}
                        onChange={(e) => updateSettings({ use_external_player: e.target.checked })}
                    />
                </label>

                <div className={`settings-program-block ${settings.use_external_player ? '' : 'is-disabled'}`}>
                    <div className="settings-toggle-copy">
                        <div className="settings-label">{TEXT.externalPlayerName}</div>
                        <div className="settings-description">{TEXT.externalPlayerHint}</div>
                    </div>

                    <div className="settings-program-controls">
                        <input
                            className="settings-input settings-program-input"
                            type="text"
                            value={getProgramName(settings.player_path || '')}
                            placeholder={TEXT.externalPlayerHint}
                            title={settings.player_path || ''}
                            readOnly
                            disabled={!settings.use_external_player}
                        />

                        <div className="settings-inline-actions">
                            <button
                                className="settings-btn settings-btn-primary"
                                type="button"
                                onClick={handleSelectProgram}
                                disabled={!settings.use_external_player}
                            >
                                {TEXT.chooseProgram}
                            </button>
                            <button
                                className="settings-btn"
                                type="button"
                                onClick={handleClearProgram}
                                disabled={!settings.use_external_player || !settings.player_path}
                            >
                                {TEXT.clear}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="settings-footer">
                <button
                    className="settings-btn settings-btn-primary"
                    type="button"
                    onClick={handleSave}
                    disabled={!hasChanges}
                >
                    {TEXT.save}
                </button>
                {msg && <span className="settings-feedback">{msg}</span>}
            </div>
        </div>
    );

    const renderScan = () => (
        <div className="settings-section">
            <div className="settings-section-title">{TEXT.scanSettings}</div>

            <div className="settings-card">
                <label className="settings-toggle-row">
                    <div className="settings-toggle-copy">
                        <div className="settings-label">{TEXT.useEverything}</div>
                        <div className="settings-description">{TEXT.useEverythingDesc}</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={!!settings.use_everything}
                        onChange={(e) => updateSettings({ use_everything: e.target.checked })}
                    />
                </label>

                <div className={`settings-program-block ${settings.use_everything ? '' : 'is-disabled'}`}>
                    <div className="settings-toggle-copy">
                        <div className="settings-label">{TEXT.everythingAddr}</div>
                        <div className="settings-description">{TEXT.everythingAddrDesc}</div>
                    </div>

                    <div className="settings-program-controls">
                        <input
                            className="settings-input settings-program-input"
                            type="text"
                            value={settings.everything_addr || ''}
                            placeholder={TEXT.everythingAddrPlaceholder}
                            onChange={(e) => updateSettings({ everything_addr: e.target.value })}
                            disabled={!settings.use_everything}
                        />
                    </div>
                </div>

                <div className="settings-description">{TEXT.everythingTip}</div>

                <label className="settings-toggle-row">
                    <div className="settings-toggle-copy">
                        <div className="settings-label">{TEXT.videoThumbnail}</div>
                        <div className="settings-description">{TEXT.videoThumbnailDesc}</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={!!settings.enable_video_thumbnail}
                        onChange={(e) => updateSettings({ enable_video_thumbnail: e.target.checked })}
                    />
                </label>

                <div className={`settings-program-block ${settings.enable_video_thumbnail ? '' : 'is-disabled'}`}>
                    <div className="settings-toggle-copy">
                        <div className="settings-label">{TEXT.thumbnailMinDuration}</div>
                        <div className="settings-description">{TEXT.thumbnailMinDurationDesc}</div>
                    </div>

                    <div className="settings-program-controls">
                        <input
                            className="settings-input settings-program-input"
                            type="number"
                            min={1}
                            step={1}
                            value={getThumbnailDurationMinutes(settings.thumbnail_min_duration_seconds)}
                            onChange={(e) => updateSettings({
                                thumbnail_min_duration_seconds: Math.max(1, Number(e.target.value) || 0) * 60,
                            })}
                            disabled={!settings.enable_video_thumbnail}
                        />
                    </div>
                </div>

                <div className={`settings-program-block ${settings.enable_video_thumbnail ? '' : 'is-disabled'}`}>
                    <div className="settings-toggle-copy">
                        <div className="settings-label">{TEXT.thumbnailPreviewCount}</div>
                        <div className="settings-description">{TEXT.thumbnailPreviewCountDesc}</div>
                    </div>

                    <div className="settings-program-controls">
                        <input
                            className="settings-input settings-program-input"
                            type="number"
                            min={1}
                            max={12}
                            step={1}
                            value={getThumbnailPreviewCount(settings.thumbnail_preview_count)}
                            onChange={(e) => updateSettings({
                                thumbnail_preview_count: Math.max(1, Math.min(12, Number(e.target.value) || 0)),
                            })}
                            disabled={!settings.enable_video_thumbnail}
                        />
                    </div>
                </div>
            </div>

            <div className="settings-footer">
                <button
                    className="settings-btn settings-btn-primary"
                    type="button"
                    onClick={handleSave}
                    disabled={!hasChanges}
                >
                    {TEXT.save}
                </button>
                {msg && <span className="settings-feedback">{msg}</span>}
            </div>
        </div>
    );
    const renderRemote = () => {
        const bindHost = settings.remote_bind_host || '0.0.0.0';
        const jellyfinPort = Number(settings.jellyfin_port) > 0 ? Number(settings.jellyfin_port) : 18096;
        const jellyfinURL = `http://${bindHost}:${jellyfinPort}`;

        return (
            <div className="settings-section">
                <div className="settings-section-title">{TEXT.remoteAccess}</div>

                <div className="settings-card">
                    <div className="settings-description">{TEXT.remoteAccessDesc}</div>

                    <div className="settings-program-block">
                        <div className="settings-toggle-copy">
                            <div className="settings-label">{TEXT.remoteBindHost}</div>
                            <div className="settings-description">{TEXT.remoteBindHostDesc}</div>
                        </div>

                        <div className="settings-program-controls">
                            <input
                                className="settings-input settings-program-input"
                                type="text"
                                value={settings.remote_bind_host || ''}
                                placeholder="0.0.0.0"
                                onChange={(e) => updateSettings({ remote_bind_host: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="settings-program-block">
                        <div className="settings-toggle-copy">
                            <div className="settings-label">{TEXT.remoteUsername}</div>
                            <div className="settings-description">{TEXT.remoteUsernameDesc}</div>
                        </div>

                        <div className="settings-program-controls">
                            <input
                                className="settings-input settings-program-input"
                                type="text"
                                value={settings.remote_username || ''}
                                onChange={(e) => updateSettings({ remote_username: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="settings-program-block">
                        <div className="settings-toggle-copy">
                            <div className="settings-label">{TEXT.remotePassword}</div>
                            <div className="settings-description">{TEXT.remotePasswordDesc}</div>
                        </div>

                        <div className="settings-program-controls">
                            <input
                                className="settings-input settings-program-input"
                                type="password"
                                value={settings.remote_password || ''}
                                onChange={(e) => updateSettings({ remote_password: e.target.value })}
                            />
                        </div>
                    </div>

                    <label className="settings-toggle-row">
                        <div className="settings-toggle-copy">
                            <div className="settings-label">{TEXT.jellyfinEnabled}</div>
                            <div className="settings-description">{TEXT.jellyfinEnabledDesc}</div>
                        </div>
                        <input
                            type="checkbox"
                            checked={!!settings.jellyfin_enabled}
                            onChange={(e) => updateSettings({ jellyfin_enabled: e.target.checked })}
                        />
                    </label>

                    <div className={`settings-program-block ${settings.jellyfin_enabled ? '' : 'is-disabled'}`}>
                        <div className="settings-toggle-copy">
                            <div className="settings-label">{TEXT.jellyfinPort}</div>
                            <div className="settings-description">{TEXT.jellyfinPortDesc}</div>
                        </div>

                        <div className="settings-program-controls">
                            <input
                                className="settings-input settings-program-input"
                                type="number"
                                min={1}
                                max={65535}
                                step={1}
                                value={jellyfinPort}
                                onChange={(e) => updateSettings({ jellyfin_port: Math.max(1, Number(e.target.value) || 0) })}
                                disabled={!settings.jellyfin_enabled}
                            />
                        </div>
                    </div>

                    <div className={`settings-program-block ${settings.jellyfin_enabled ? '' : 'is-disabled'}`}>
                        <div className="settings-toggle-copy">
                            <div className="settings-label">{TEXT.jellyfinServerName}</div>
                            <div className="settings-description">{TEXT.jellyfinServerNameDesc}</div>
                        </div>

                        <div className="settings-program-controls">
                            <input
                                className="settings-input settings-program-input"
                                type="text"
                                value={settings.jellyfin_server_name || ''}
                                onChange={(e) => updateSettings({ jellyfin_server_name: e.target.value })}
                                disabled={!settings.jellyfin_enabled}
                            />
                        </div>
                    </div>

                    <div className="settings-description">{`${TEXT.jellyfinHint}：${jellyfinURL}`}</div>
                    <div className="settings-description">{TEXT.remoteLanHint}</div>
                </div>

                <div className="settings-footer">
                    <button
                        className="settings-btn settings-btn-primary"
                        type="button"
                        onClick={handleSave}
                        disabled={!hasChanges}
                    >
                        {TEXT.save}
                    </button>
                    {msg && <span className="settings-feedback">{msg}</span>}
                </div>
            </div>
        );
    };
    const renderPlaceholder = (title: string) => (
        <div className="settings-section">
            <div className="settings-section-title">{title}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>{TEXT.placeholderNote}</div>
        </div>
    );

    return (
        <div className="settings-container">
            <div className="settings-sidebar">
                <div className="settings-sidebar-header">{TEXT.settings}</div>
                <div className={`settings-nav-item ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>{TEXT.general}</div>
                <div className={`settings-nav-item ${activeTab === 'scan' ? 'active' : ''}`} onClick={() => setActiveTab('scan')}>{TEXT.scan}</div>
                <div className={`settings-nav-item ${activeTab === 'remote' ? 'active' : ''}`} onClick={() => setActiveTab('remote')}>{TEXT.remoteAccess}</div>
                <div className={`settings-nav-item ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>{TEXT.about}</div>
                <div className="sidebar-spacer"></div>
                <div className="settings-return-btn" onClick={onClose}>{TEXT.back}</div>
            </div>

            <div className="settings-main">
                {activeTab === 'general' && renderGeneral()}
                {activeTab === 'scan' && renderScan()}
                {activeTab === 'remote' && renderRemote()}
                {activeTab === 'about' && renderPlaceholder(TEXT.about)}
            </div>
        </div>
    );
};

export default SettingsPage;
