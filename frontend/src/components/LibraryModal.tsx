import React, { useState } from 'react';
import { CreateLibrary, SelectDirectory } from "../../wailsjs/go/main/App";

interface LibraryModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const LibraryModal: React.FC<LibraryModalProps> = ({ onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [path, setPath] = useState('');
    const [metadataMode, setMetadataMode] = useState('online_preferred');

    const handleSelectDir = async () => {
        try {
            const dir = await SelectDirectory();
            if (dir) setPath(dir);
        } catch (e) {
            console.error(e);
        }
    };

    const [msg, setMsg] = useState('');

    const handleSave = async () => {
        if (!name || !path) {
            setMsg("名称和路径不能为空");
            return;
        }
        try {
            await CreateLibrary({
                name,
                path,
                metadata_mode: metadataMode,
                type: 'movie', // Default for now
            } as any);
            onSuccess();
        } catch (e: any) {
            setMsg("创建失败: " + e);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3 style={{ marginTop: 0 }}>新建媒体库</h3>
                
                <div className="form-group">
                    <label>库名称</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} />
                </div>
                
                <div className="form-group">
                    <label>文件夹路径</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input type="text" value={path} readOnly style={{ flex: 1 }} onClick={handleSelectDir} placeholder="点击选择..." />
                        <button className="btn" onClick={handleSelectDir}>选择</button>
                    </div>
                </div>
                
                <div className="form-group">
                    <label>刮削策略</label>
                    <select value={metadataMode} onChange={e => setMetadataMode(e.target.value)}>
                        <option value="online_preferred">优先在线刮削</option>
                        <option value="local_preferred">优先读取本地 NFO</option>
                        <option value="local_only">仅读取本地 NFO</option>
                    </select>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', alignItems: 'center' }}>
                    {msg && <div style={{color:'var(--text-main)', marginRight:'auto'}}>{msg}</div>}
                    <button className="btn" style={{ background: 'transparent', border: '1px solid #555' }} onClick={onClose}>取消</button>
                    <button className="btn" onClick={handleSave}>保存</button>
                </div>
            </div>
        </div>
    );
};

export default LibraryModal;
