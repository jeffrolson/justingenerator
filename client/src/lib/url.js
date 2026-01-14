export const getImageUrl = (path, apiUrl) => {
    if (!path) return '';

    // If it's already a full URL (correctly formed)
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }

    // Fix common mangling (e.g. missing colon in protocol)
    if (path.startsWith('http//') || path.startsWith('https//')) {
        return path.replace('http//', 'http://').replace('https//', 'https://');
    }

    // Ensure apiUrl doesn't have a trailing slash
    const base = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;

    // Ensure path has exactly one leading slash
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    const finalUrl = `${base}${normalizedPath}`;

    // Final emergency fix for missing protocol colon
    return finalUrl.replace(/https\/\//g, 'https://').replace(/http\/\//g, 'http://');
};
