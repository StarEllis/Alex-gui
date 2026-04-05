import React, { useEffect, useState } from 'react';
import { PlayWithExternalPlayer, OpenMediaFolder, ToggleFavorite, ToggleWatched, GetMediaDetail } from "../../wailsjs/go/main/App";

interface MediaDetailProps {
    media: any;
    onClose: () => void;
}

const MediaDetail: React.FC<MediaDetailProps> = ({ media, onClose }) => {
    const [detail, setDetail] = useState(media);

    useEffect(() => {
        GetMediaDetail(media.id).then(setDetail).catch(console.error);
    }, [media.id]);

    const handlePlay = () => PlayWithExternalPlayer(detail.id);
    const handleOpenDir = () => OpenMediaFolder(detail.id);
    
    const [msg, setMsg] = useState('');
    const showMsg = (m: string) => { setMsg(m); setTimeout(()=>setMsg(''), 3000); };

    const handleFav = async () => {
        try {
            await ToggleFavorite(detail.id);
            showMsg("收藏状态已切换");
        } catch (e) {
            console.error(e);
        }
    };
    
    const handleWatched = async () => {
        try {
            await ToggleWatched(detail.id);
            showMsg("观看状态已切换");
        } catch (e) {
            console.error(e);
        }
    };

    const posterUrl = detail.poster_path ? `/local/${detail.poster_path}` : '';
    const backdropUrl = detail.backdrop_path ? `/local/${detail.backdrop_path}` : '';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ width: '600px', display: 'flex', gap: '20px', backgroundImage: backdropUrl ? `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(${backdropUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} onClick={e => e.stopPropagation()}>
                <div style={{ flex: 1 }}>
                    {posterUrl ? <img src={posterUrl} style={{ width: '100%', borderRadius: '4px' }} alt="poster" /> : <div style={{ width: '100%', aspectRatio: '2/3', background: '#333', borderRadius: '4px' }}></div>}
                </div>
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h2 style={{ margin: 0, color: 'var(--text-main)' }}>{detail.title}</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {detail.year} • {detail.resolution} • {detail.video_codec}
                    </p>
                    <p style={{ fontSize: '14px', lineHeight: '1.5' }}>
                        {detail.overview || "暂无简介"}
                    </p>
                    
                    <div style={{ marginTop: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button className="btn" onClick={handlePlay}>▶ 播放</button>
                        <button className="btn" style={{ background: '#555' }} onClick={handleOpenDir}>打开目录</button>
                        <button className="btn" style={{ background: '#555' }} onClick={handleFav}>⭐ 收藏</button>
                        <button className="btn" style={{ background: '#555' }} onClick={handleWatched}>眼 观看标记</button>
                        <button className="btn" style={{ background: 'transparent', border: '1px solid #555' }} onClick={onClose}>关闭</button>
                    </div>
                    {msg && <div style={{marginTop:'10px', color:'var(--text-main)'}}>{msg}</div>}
                </div>
            </div>
        </div>
    );
};

export default MediaDetail;
