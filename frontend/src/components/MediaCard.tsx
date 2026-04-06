import React from 'react';

interface MediaCardProps {
    media: any;
    onClick: () => void;
}

/**
 * 首页卡片强制尺寸：
 * 宽：178px
 * 高：海报区域 255px
 */
const MediaCard: React.FC<MediaCardProps> = ({ media, onClick }) => {
    const coverUrl = media.poster_path
        ? `/local/${media.poster_path}`
        : media.backdrop_path
            ? `/local/${media.backdrop_path}`
            : '';

    return (
        <div className="media-card" onClick={onClick}>
            <div className="media-poster-wrapper" style={{ width: '100%', aspectRatio: '178 / 255', position: 'relative', overflow: 'hidden', borderRadius: '4px', background: '#1a1a25' }}>
                {coverUrl ? (
                    <img 
                        src={coverUrl} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        alt={media.title} 
                        loading="lazy" 
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/178x255?text=No+Poster';
                        }} 
                    />
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '12px' }}>
                        No Image
                    </div>
                )}
                {/* 模拟标签 - 之后可根据逻辑动态显示 */}
                <div style={{ position: 'absolute', top: '8px', left: '8px', padding: '2px 6px', background: 'rgba(74, 158, 255, 0.8)', color: '#fff', borderRadius: '4px', fontSize: '10px' }}>字幕</div>
                <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 6px', background: 'rgba(211, 47, 47, 0.8)', color: '#fff', borderRadius: '4px', fontSize: '10px' }}>破解</div>
            </div>
            
            <div className="media-info" style={{ marginTop: '10px' }}>
                <div 
                    className="media-title" 
                    title={media.title} 
                    style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}
                >
                    {media.title || "未知标题"}
                </div>
                <div 
                    className="media-year" 
                    style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}
                >
                    {media.year || "未知日期"}
                </div>
            </div>
        </div>
    );
};

export default MediaCard;
