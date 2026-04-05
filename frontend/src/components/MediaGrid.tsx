import React, { useEffect, useState } from 'react';
import { GetMediaList } from "../../wailsjs/go/main/App";
import MediaCard from './MediaCard';

interface MediaGridProps {
    libraryId: string;
    keyword: string;
    filter?: { type: string; value: string; label: string } | null;
    onSelectMedia: (media: any) => void;
    onCountChange?: (count: number) => void;
}

const MediaGrid: React.FC<MediaGridProps> = ({ libraryId, keyword, filter, onSelectMedia, onCountChange }) => {
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        let active = true;
        const filterType = filter?.type || "";
        const filterValue = filter?.value || "";

        GetMediaList(libraryId, 1, 100, "created_at", "desc", keyword, filterType, filterValue)
            .then((res: any) => {
                if (active) {
                    setMediaItems(res.items || []);
                    if (onCountChange) onCountChange(res.total || 0);
                    setIsLoading(false);
                }
            })
            .catch(err => {
                console.error(err);
                if (active) setIsLoading(false);
            });
        return () => { active = false; };
    }, [libraryId, keyword, filter]);

    return (
        <div className="grid-container">
            {mediaItems.map(item => (
                <MediaCard key={item.id} media={item} onClick={() => onSelectMedia(item)} />
            ))}
            {!isLoading && mediaItems.length === 0 && (
                <div style={{ color: 'var(--text-dim)', padding: '40px', gridColumn: '1 / -1', textAlign: 'center', fontSize: '14px' }}>
                    没有找到符合条件的媒体文件
                </div>
            )}
            {isLoading && mediaItems.length === 0 && (
                <div style={{ color: 'var(--accent)', padding: '40px', gridColumn: '1 / -1', textAlign: 'center', fontSize: '14px' }}>
                    正在加载媒体库...
                </div>
            )}
        </div>
    );
};

export default MediaGrid;
