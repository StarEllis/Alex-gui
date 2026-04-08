import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GetMediaList } from "../../wailsjs/go/main/App";
import MediaCard from './MediaCard';

interface MediaGridProps {
    libraryId: string;
    keyword: string;
    sortField: string;
    sortOrder: 'asc' | 'desc';
    layoutVersion?: number;
    filter?: { type: string; value: string; label: string } | null;
    onSelectMedia: (media: any) => void;
    onCountChange?: (count: number) => void;
    onQuickPlayStatus?: (message: string) => void;
    initialScrollTop?: number;
    onScrollPositionChange?: (scrollTop: number) => void;
}

const MediaGrid: React.FC<MediaGridProps> = ({
    libraryId,
    keyword,
    sortField,
    sortOrder,
    layoutVersion = 0,
    filter,
    onSelectMedia,
    onCountChange,
    onQuickPlayStatus,
    initialScrollTop = 0,
    onScrollPositionChange,
}) => {
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const latestScrollTopRef = useRef(0);
    const pendingRestoreRef = useRef<number | null>(initialScrollTop);
    const [layout, setLayout] = useState({ columns: 4, gap: 20, justify: 'start' });

    const updateLayout = () => {
        if (!containerRef.current) return;
        const containerWidth = containerRef.current.clientWidth - 48;
        const cardWidth = 178;
        const minGap = 18;
        const maxGap = 24;

        let cols = Math.floor((containerWidth + minGap) / (cardWidth + minGap));
        cols = Math.max(1, cols);

        const currentGap = cols > 1 ? (containerWidth - cols * cardWidth) / (cols - 1) : 0;
        const gap = Math.min(Math.max(currentGap, minGap), maxGap);

        setLayout({ columns: cols, gap, justify: cols > 1 ? 'space-between' : 'start' });
    };

    useEffect(() => {
        let frameId = 0;
        const scheduleLayoutUpdate = () => {
            window.cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(() => updateLayout());
        };

        const observer = new ResizeObserver(() => scheduleLayoutUpdate());
        if (containerRef.current) {
            observer.observe(containerRef.current);
            if (containerRef.current.parentElement) {
                observer.observe(containerRef.current.parentElement);
            }
        }

        window.addEventListener('resize', scheduleLayoutUpdate);
        scheduleLayoutUpdate();

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', scheduleLayoutUpdate);
            window.cancelAnimationFrame(frameId);
        };
    }, []);

    useLayoutEffect(() => {
        let frameId = 0;
        frameId = window.requestAnimationFrame(() => updateLayout());
        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [layoutVersion]);

    useEffect(() => {
        pendingRestoreRef.current = initialScrollTop;
        latestScrollTopRef.current = initialScrollTop;
    }, [initialScrollTop, libraryId, keyword, sortField, sortOrder, filter]);

    useLayoutEffect(() => {
        if (isLoading || mediaItems.length === 0 || pendingRestoreRef.current === null || !containerRef.current) {
            return;
        }

        const targetScrollTop = pendingRestoreRef.current;
        let frameId = 0;
        let nestedFrameId = 0;

        frameId = window.requestAnimationFrame(() => {
            nestedFrameId = window.requestAnimationFrame(() => {
                if (!containerRef.current) {
                    return;
                }
                containerRef.current.scrollTop = targetScrollTop;
                latestScrollTopRef.current = containerRef.current.scrollTop;
                onScrollPositionChange?.(latestScrollTopRef.current);
                pendingRestoreRef.current = null;
            });
        });

        return () => {
            window.cancelAnimationFrame(frameId);
            window.cancelAnimationFrame(nestedFrameId);
        };
    }, [isLoading, mediaItems.length, layout.columns, layout.gap, onScrollPositionChange]);

    useEffect(() => {
        setIsLoading(true);
        let active = true;
        const filterType = filter?.type || '';
        const filterValue = filter?.value || '';

        GetMediaList(libraryId, 1, 100, sortField, sortOrder, keyword, filterType, filterValue)
            .then((res: any) => {
                if (!active) return;
                setMediaItems(res.items || []);
                onCountChange?.(res.total || 0);
                setIsLoading(false);
            })
            .catch((err) => {
                console.error(err);
                if (active) setIsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [libraryId, keyword, sortField, sortOrder, filter, onCountChange]);

    useEffect(() => {
        return () => {
            onScrollPositionChange?.(latestScrollTopRef.current);
        };
    }, [onScrollPositionChange]);

    const handleSelectMedia = (media: any) => {
        onScrollPositionChange?.(latestScrollTopRef.current);
        onSelectMedia(media);
    };

    return (
        <div
            ref={containerRef}
            className="grid-container"
            onScroll={(event) => {
                latestScrollTopRef.current = event.currentTarget.scrollTop;
                onScrollPositionChange?.(latestScrollTopRef.current);
            }}
            style={{
                gridTemplateColumns: `repeat(${layout.columns}, 178px)`,
                columnGap: `${layout.gap}px`,
                justifyContent: layout.justify,
                rowGap: '24px',
            }}
        >
            {mediaItems.map((item) => (
                <MediaCard
                    key={item.id}
                    media={item}
                    onClick={() => handleSelectMedia(item)}
                    onQuickPlayStatus={onQuickPlayStatus}
                />
            ))}

            {!isLoading && mediaItems.length === 0 && (
                <div className="grid-feedback">
                    没有找到符合条件的媒体内容
                </div>
            )}

            {isLoading && mediaItems.length === 0 && (
                <div className="grid-feedback loading">
                    正在加载媒体内容...
                </div>
            )}
        </div>
    );
};

export default MediaGrid;
