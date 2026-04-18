const LIBRARIES_STORAGE_KEY = 'alex.desktop.cache.libraries.v1';
const CURRENT_LIBRARY_STORAGE_KEY = 'alex.desktop.cache.currentLibraryId.v1';
const MEDIA_LIST_STORAGE_KEY = 'alex.desktop.cache.mediaList.v1';

const MEDIA_LIST_CACHE_VERSION = 1;
const MEDIA_LIST_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_MEDIA_LIST_ENTRIES = 10;

type MediaListCacheEntry = {
    items: any[];
    total: number;
};

type PersistedMediaListCacheEntry = MediaListCacheEntry & {
    updatedAt: number;
};

type PersistedMediaListCacheStore = {
    version: number;
    order: string[];
    entries: Record<string, PersistedMediaListCacheEntry>;
};

type InitialLibraryState = {
    libraries: any[];
    currentLibrary: any | null;
};

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readStorageValue = (key: string) => {
    if (!canUseStorage()) {
        return null;
    }

    try {
        return window.localStorage.getItem(key);
    } catch (_error) {
        return null;
    }
};

const writeStorageValue = (key: string, value: string) => {
    if (!canUseStorage()) {
        return false;
    }

    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch (_error) {
        return false;
    }
};

const removeStorageValue = (key: string) => {
    if (!canUseStorage()) {
        return;
    }

    try {
        window.localStorage.removeItem(key);
    } catch (_error) {
        // ignore storage cleanup failures
    }
};

const readStorageJSON = <T,>(key: string): T | null => {
    const raw = readStorageValue(key);
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as T;
    } catch (_error) {
        return null;
    }
};

const pickCachedMediaFields = (item: any) => ({
    id: typeof item?.id === 'string' ? item.id : '',
    title: typeof item?.title === 'string' ? item.title : '',
    year: typeof item?.year === 'number' ? item.year : 0,
    poster_path: typeof item?.poster_path === 'string' ? item.poster_path : '',
    backdrop_path: typeof item?.backdrop_path === 'string' ? item.backdrop_path : '',
    file_path: typeof item?.file_path === 'string' ? item.file_path : '',
    is_favorite: Boolean(item?.is_favorite),
    is_watched: Boolean(item?.is_watched),
});

const normalizeCachedMediaItems = (items: unknown) => {
    if (!Array.isArray(items)) {
        return [];
    }

    return items
        .map((item) => pickCachedMediaFields(item))
        .filter((item) => item.id);
};

const normalizeMediaListCacheStore = (
    store: PersistedMediaListCacheStore | null,
): PersistedMediaListCacheStore => {
    const now = Date.now();
    const normalizedEntries: Record<string, PersistedMediaListCacheEntry> = {};
    const rawEntries = store?.entries || {};

    Object.entries(rawEntries).forEach(([key, entry]) => {
        if (!entry || typeof entry !== 'object') {
            return;
        }

        const updatedAt = typeof entry.updatedAt === 'number' ? entry.updatedAt : 0;
        if (!updatedAt || now-updatedAt > MEDIA_LIST_CACHE_TTL_MS) {
            return;
        }

        normalizedEntries[key] = {
            items: normalizeCachedMediaItems(entry.items),
            total: typeof entry.total === 'number' ? entry.total : 0,
            updatedAt,
        };
    });

    const normalizedOrder = Array.isArray(store?.order)
        ? store!.order.filter((key) => Boolean(normalizedEntries[key]))
        : [];

    Object.keys(normalizedEntries).forEach((key) => {
        if (!normalizedOrder.includes(key)) {
            normalizedOrder.push(key);
        }
    });

    const limitedOrder = normalizedOrder.slice(0, MAX_MEDIA_LIST_ENTRIES);
    const limitedEntries: Record<string, PersistedMediaListCacheEntry> = {};
    limitedOrder.forEach((key) => {
        limitedEntries[key] = normalizedEntries[key];
    });

    return {
        version: MEDIA_LIST_CACHE_VERSION,
        order: limitedOrder,
        entries: limitedEntries,
    };
};

const writeMediaListCacheStore = (store: PersistedMediaListCacheStore) => {
    if (Object.keys(store.entries).length === 0) {
        removeStorageValue(MEDIA_LIST_STORAGE_KEY);
        return;
    }

    writeStorageValue(MEDIA_LIST_STORAGE_KEY, JSON.stringify(store));
};

const readMediaListCacheStore = () => {
    const rawStore = readStorageJSON<PersistedMediaListCacheStore>(MEDIA_LIST_STORAGE_KEY);
    const normalizedStore = normalizeMediaListCacheStore(rawStore);

    const shouldRewrite =
        !rawStore ||
        rawStore.version !== normalizedStore.version ||
        JSON.stringify(rawStore.order || []) !== JSON.stringify(normalizedStore.order) ||
        Object.keys(rawStore.entries || {}).length !== Object.keys(normalizedStore.entries).length;

    if (shouldRewrite) {
        writeMediaListCacheStore(normalizedStore);
    }

    return normalizedStore;
};

export const loadInitialLibraryState = (): InitialLibraryState => {
    const libraries = readStorageJSON<any[]>(LIBRARIES_STORAGE_KEY);
    const normalizedLibraries = Array.isArray(libraries) ? libraries : [];
    const currentLibraryID = readStorageValue(CURRENT_LIBRARY_STORAGE_KEY) || '';
    const currentLibrary = normalizedLibraries.find((library) => library?.id === currentLibraryID) || normalizedLibraries[0] || null;

    return {
        libraries: normalizedLibraries,
        currentLibrary,
    };
};

export const persistLibraries = (libraries: any[]) => {
    if (!Array.isArray(libraries) || libraries.length === 0) {
        removeStorageValue(LIBRARIES_STORAGE_KEY);
        return;
    }

    writeStorageValue(LIBRARIES_STORAGE_KEY, JSON.stringify(libraries));
};

export const persistCurrentLibraryID = (libraryID: string) => {
    const normalizedLibraryID = typeof libraryID === 'string' ? libraryID.trim() : '';
    if (!normalizedLibraryID) {
        removeStorageValue(CURRENT_LIBRARY_STORAGE_KEY);
        return;
    }

    writeStorageValue(CURRENT_LIBRARY_STORAGE_KEY, normalizedLibraryID);
};

export const loadPersistedMediaListCache = (cacheKey: string): MediaListCacheEntry | null => {
    if (!cacheKey) {
        return null;
    }

    const store = readMediaListCacheStore();
    const entry = store.entries[cacheKey];
    if (!entry) {
        return null;
    }

    return {
        items: entry.items,
        total: entry.total,
    };
};

export const persistMediaListCache = (cacheKey: string, entry: MediaListCacheEntry) => {
    if (!cacheKey) {
        return;
    }

    const store = readMediaListCacheStore();
    const nextOrder = [cacheKey, ...store.order.filter((key) => key !== cacheKey)].slice(0, MAX_MEDIA_LIST_ENTRIES);
    const nextEntries: Record<string, PersistedMediaListCacheEntry> = {};

    nextOrder.forEach((key) => {
        if (key === cacheKey) {
            nextEntries[key] = {
                items: normalizeCachedMediaItems(entry.items),
                total: typeof entry.total === 'number' ? entry.total : 0,
                updatedAt: Date.now(),
            };
            return;
        }

        if (store.entries[key]) {
            nextEntries[key] = store.entries[key];
        }
    });

    writeMediaListCacheStore({
        version: MEDIA_LIST_CACHE_VERSION,
        order: nextOrder,
        entries: nextEntries,
    });
};
