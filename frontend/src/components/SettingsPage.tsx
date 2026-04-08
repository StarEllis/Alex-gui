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
    embySettings: 'Emby \u8bbe\u7f6e',
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

const SettingsPage: React.FC<SettingsPageProps> = ({ onClose }) => {
    const [settings, setSettings] = useState<any>(null);
    const [savedSettings, setSavedSettings] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'scan' | 'emby' | 'about'>('general');
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
                <div className={`settings-nav-item ${activeTab === 'emby' ? 'active' : ''}`} onClick={() => setActiveTab('emby')}>Emby</div>
                <div className={`settings-nav-item ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>{TEXT.about}</div>
                <div className="sidebar-spacer"></div>
                <div className="settings-return-btn" onClick={onClose}>{TEXT.back}</div>
            </div>

            <div className="settings-main">
                {activeTab === 'general' && renderGeneral()}
                {activeTab === 'scan' && renderPlaceholder(TEXT.scanSettings)}
                {activeTab === 'emby' && renderPlaceholder(TEXT.embySettings)}
                {activeTab === 'about' && renderPlaceholder(TEXT.about)}
            </div>
        </div>
    );
};

export default SettingsPage;
