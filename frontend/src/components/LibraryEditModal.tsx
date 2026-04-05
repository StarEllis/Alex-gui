import React, { useState, useEffect } from 'react';
import { UpdateLibrary, DeleteLibrary, SelectDirectory } from "../../wailsjs/go/main/App";

interface LibraryEditModalProps {
    library: any;
    onClose: () => void;
    onSaved: () => void;
    onDeleted: () => void;
}

const LibraryEditModal: React.FC<LibraryEditModalProps> = ({ library, onClose, onSaved, onDeleted }) => {
    const [name, setName] = useState(library.name || '');
    const [path, setPath] = useState(library.path || '');
    const [metadataMode, setMetadataMode] = useState(library.metadata_mode || 'online_preferred');
    const [libType, setLibType] = useState(library.type || 'movie');
    const [msg, setMsg] = useState('');

    const handleSelectDir = async () => {
        try {
            const dir = await SelectDirectory();
            if (dir) setPath(dir);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSave = async () => {
        if (!name) { setMsg("名称不能为空"); return; }
        try {
            await UpdateLibrary({
                ...library,
                name,
                path,
                metadata_mode: metadataMode,
                type: libType,
            });
            onSaved();
        } catch (e: any) {
            setMsg("保存失败: " + e);
        }
    };

    const handleDelete = async () => {
        if (!confirm("确定要删除此媒体库及其所有媒体记录？此操作不可撤销。")) return;
        try {
            await DeleteLibrary(library.id);
            onDeleted();
        } catch (e: any) {
            setMsg("删除失败: " + e);
        }
    };

    const handleReset = () => {
        setName(library.name || '');
        setPath(library.path || '');
        setMetadataMode(library.metadata_mode || 'online_preferred');
        setLibType(library.type || 'movie');
        setMsg('');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="edit-modal" onClick={e => e.stopPropagation()}>
                {/* 标题栏 */}
                <div className="edit-modal-header">
                    <span>编辑媒体库</span>
                    <button className="edit-modal-close" onClick={onClose}>✕</button>
                </div>

                {/* 基础字段区 */}
                <div className="edit-modal-body">
                    <div className="edit-section">
                        <div className="edit-row">
                            <label className="edit-label">媒体库名</label>
                            <input className="edit-input" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="edit-row">
                            <label className="edit-label">视图</label>
                            <select className="edit-select" value={libType} onChange={e => setLibType(e.target.value)}>
                                <option value="movie">电影</option>
                                <option value="tvshow">剧集</option>
                                <option value="mixed">混合</option>
                                <option value="other">其他</option>
                            </select>
                        </div>
                        <div className="edit-row">
                            <label className="edit-label">标题</label>
                            <select className="edit-select" value={metadataMode} onChange={e => setMetadataMode(e.target.value)}>
                                <option value="online_preferred">优先在线刮削</option>
                                <option value="local_preferred">优先本地 NFO</option>
                                <option value="local_only">仅本地 NFO</option>
                            </select>
                        </div>
                    </div>

                    {/* 文件夹路径区 */}
                    <div className="edit-section">
                        <div className="edit-section-header">
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>文件夹路径</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button className="edit-small-btn" onClick={handleSelectDir}>+文件夹</button>
                            </div>
                        </div>
                        <div className="edit-path-table">
                            <div className="edit-path-header">
                                <span style={{ width: 30, textAlign: 'center' }}>#</span>
                                <span style={{ flex: 1 }}>路径</span>
                                <span style={{ width: 60, textAlign: 'center' }}>操作</span>
                            </div>
                            {path && (
                                <div className="edit-path-row">
                                    <span style={{ width: 30, textAlign: 'center', color: 'var(--text-dim)' }}>1</span>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={path}>{path}</span>
                                    <span style={{ width: 60, textAlign: 'center' }}>
                                        <button className="edit-icon-btn" onClick={handleSelectDir} title="修改">✎</button>
                                    </span>
                                </div>
                            )}
                            {!path && (
                                <div className="edit-path-row" style={{ color: 'var(--text-dim)', justifyContent: 'center' }}>
                                    尚未添加路径
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 底部按钮 */}
                <div className="edit-modal-footer">
                    {msg && <span className="edit-msg">{msg}</span>}
                    <div style={{ flex: 1 }}></div>
                    <button className="edit-footer-btn edit-btn-danger" onClick={handleDelete}>删除</button>
                    <button className="edit-footer-btn edit-btn-default" onClick={handleReset}>重置</button>
                    <button className="edit-footer-btn edit-btn-primary" onClick={handleSave}>保存</button>
                </div>
            </div>
        </div>
    );
};

export default LibraryEditModal;
