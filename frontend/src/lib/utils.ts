import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://pub-2c6a4a0072774a308e398234fc12ea61.r2.dev';

console.log('--- A360 UTILS LOADED V7 ---');

export const getAssetUrl = (path: string) => {
    if (!path) return '';

    // If it's already an R2 URL, return it
    const lowerPath = path.toLowerCase();
    if (path.includes('r2.dev')) return path;

    // A360 AGGRESSIVE REDIRECTION (V7):
    // If the path contains 'uploads/' and looks like a pano/cubemap, force it to R2.
    // This bypasses any domain-match issues with API_URL.
    const isPano = lowerPath.includes('cubemap') ||
        lowerPath.includes('original.jpg') ||
        lowerPath.includes('thumbnail.jpg');

    // Check for 'uploads/' anywhere in the string
    const uploadsIdx = lowerPath.indexOf('uploads/');

    if (uploadsIdx !== -1 && isPano) {
        // Extract everything after 'uploads/'
        // Example: https://workshop.a360.co.th/uploads/abc/cubemap/posx.jpg -> abc/cubemap/posx.jpg
        const r2Path = path.substring(uploadsIdx + 8); // 'uploads/'.length is 8
        const finalUrl = `${R2_PUBLIC_URL}/${r2Path}`;
        console.log('[DEBUG-ASSET-V7] Redirecting Pano to R2:', { original: path, final: finalUrl });
        return finalUrl;
    }

    // Media assets
    const mediaIdx = lowerPath.indexOf('media/');
    if (mediaIdx !== -1) {
        const r2Path = path.substring(mediaIdx);
        const finalUrl = `${R2_PUBLIC_URL}/${r2Path}`;
        return finalUrl;
    }

    // Fallback: If it's already a full URL, trust it (unless it was an uploads path caught above)
    if (path.startsWith('http')) return path;

    // For relative paths, prepend API_URL
    const normalizedPath = path.replace(/^(\.\/|\/)+/, '');
    const finalUrl = `${API_URL}/${normalizedPath}`;
    console.log('[DEBUG-ASSET-V7] Defaulting to API:', finalUrl);
    return finalUrl;
};
