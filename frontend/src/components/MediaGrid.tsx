import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GetMediaList } from "../../wailsjs/go/main/App";
import MediaCard from './MediaCard';
import { loadPersistedMediaListCache, persistMediaListCache } from '../utils/persistentCache';

interface MediaGridProps {
    libraryId: string;
    keyword: string;
    sortField: string;
    sortOrder: 'asc' | 'desc';
    layoutVersion?: number;
    refreshVersion?: number;
    filter?: { type: string; value: string; label: string } | null;
    onSelectMedia: (media: any) => void;
    onCountChange?: (count: number) => void;
    onQuickPlayStatus?: (message: string) => void;
    initialScrollTop?: number;
    onScrollPositionChange?: (scrollTop: number) => void;
}

interface MediaListCacheEntry {
    items: any[];
    total: number;
}

const mediaListCache = new Map<string, MediaListCacheEntry>();

const getCachedMediaListEntry = (cacheKey: string) => {
    const memoryEntry = mediaListCache.get(cacheKey);
    if (memoryEntry) {
        return memoryEntry;
    }

    const persistedEntry = loadPersistedMediaListCache(cacheKey);
    if (persistedEntry) {
        mediaListCache.set(cacheKey, persistedEntry);
        return persistedEntry;
    }

    return null;
};

const getMediaListCacheKey = (
    libraryId: string,
    keyword: string,
    sortField: string,
    sortOrder: 'asc' | 'desc',
    filterType: string,
    filterValue: string,
) => JSON.stringify([libraryId, keyword, sortField, sortOrder, filterType, filterValue]);

const MediaGrid: React.FC<MediaGridProps> = ({
    libraryId,
    keyword,
    sortField,
    sortOrder,
    layoutVersion = 0,
    refreshVersion = 0,
    filter,
    onSelectMedia,
    onCountChange,
    onQuickPlayStatus,
    initialScrollTop = 0,
    onScrollPositionChange,
}) => {
    const filterType = filter?.type || '';
    const filterValue = filter?.value || '';
    const cacheKey = getMediaListCacheKey(libraryId, keyword, sortField, sortOrder, filterType, filterValue);
    const initialCache = getCachedMediaListEntry(cacheKey);
    const [mediaItems, setMediaItems] = useState<any[]>(() => initialCache?.items || []);
    const [isLoading, setIsLoading] = useState(() => !initialCache);
    const containerRef = useRef<HTMLDivElement>(null);
    const latestScrollTopRef = useRef(0);
    const pendingRestoreRef = useRef<number | null>(initialScrollTop);
    const requestTokenRef = useRef(0);
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
    }, [initialScrollTop, libraryId, keyword, sortField, sortOrder, filterType, filterValue]);

    useLayoutEffect(() => {
        if (isLoading || pendingRestoreRef.current === null || !containerRef.current) {
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

                const maxScrollTop = Math.max(containerRef.current.scrollHeight - containerRef.current.clientHeight, 0);
                const restoredScrollTop = Math.min(targetScrollTop, maxScrollTop);
                containerRef.current.scrollTop = restoredScrollTop;
                latestScrollTopRef.current = restoredScrollTop;
                pendingRestoreRef.current = null;
                onScrollPositionChange?.(restoredScrollTop);
            });
        });

        return () => {
            window.cancelAnimationFrame(frameId);
            window.cancelAnimationFrame(nestedFrameId);
        };
    }, [isLoading, layout.columns, layout.gap, mediaItems.length, onScrollPositionChange]);

    useEffect(() => {
        const cachedEntry = getCachedMediaListEntry(cacheKey);
        const requestToken = requestTokenRef.current + 1;
        requestTokenRef.current = requestToken;

        if (cachedEntry) {
            setMediaItems(cachedEntry.items);
            onCountChange?.(cachedEntry.total);
            setIsLoading(false);
        } else {
            setMediaItems([]);
            setIsLoading(true);
        }

        void GetMediaList(libraryId, 1, 0, sortField, sortOrder, keyword, filterType, filterValue)
            .then((res: any) => {
                if (requestTokenRef.current !== requestToken) {
                    return;
                }

                const nextItems = Array.isArray(res?.items) ? res.items : [];
                const nextTotal = Number(res?.total || 0);
                mediaListCache.set(cacheKey, {
                    items: nextItems,
                    total: nextTotal,
                });
                persistMediaListCache(cacheKey, {
                    items: nextItems,
                    total: nextTotal,
                });
                setMediaItems(nextItems);
                onCountChange?.(nextTotal);
                setIsLoading(false);
            })
            .catch((err) => {
                console.error(err);
                if (requestTokenRef.current === requestToken && !cachedEntry) {
                    setIsLoading(false);
                }
            });

        return () => {
            requestTokenRef.current += 1;
        };
    }, [cacheKey, filterType, filterValue, keyword, libraryId, onCountChange, refreshVersion, sortField, sortOrder]);

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
                const nextScrollTop = event.currentTarget.scrollTop;
                latestScrollTopRef.current = nextScrollTop;
                onScrollPositionChange?.(nextScrollTop);
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
                    {'\u6ca1\u6709\u627e\u5230\u7b26\u5408\u6761\u4ef6\u7684\u5a92\u4f53\u5185\u5bb9'}
                </div>
            )}

            {isLoading && mediaItems.length === 0 && (
                <div className="grid-feedback loading">
                    {'\u6b63\u5728\u52a0\u8f7d\u5a92\u4f53\u5185\u5bb9...'}
                </div>
            )}
        </div>
    );
};

export default MediaGrid;
