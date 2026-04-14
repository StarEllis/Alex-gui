export const formatError = (error: unknown) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return '未知错误';
};

export const toLocalAssetUrl = (path: string) => `/local/${encodeURIComponent(path)}`;
