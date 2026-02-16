import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://pub-2c6a4a0072774a308e398234fc12ea61.r2.dev';

console.log('--- A360 UTILS LOADED V5 ---');

export const getAssetUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    // Normalize path: Remove all leading ./ or /
    const normalizedPath = path.replace(/^(\.\/|\/)+/, '');
    const lowerPath = normalizedPath.toLowerCase();

    // A360 Pattern: Pano assets (Originals/Thumbnails/Cubemaps)
    // always live in R2. They might have 'uploads/' prefix or not.
    // We catch anything in 'uploads/' that isn't explicitly 'media/'
    const isPano = lowerPath.includes('cubemap') ||
        lowerPath.includes('original.jpg') ||
        lowerPath.includes('thumbnail.jpg') ||
        (lowerPath.startsWith('uploads/') && !lowerPath.startsWith('uploads/media/'));

    console.log('[DEBUG-ASSET]', { path, normalizedPath, isPano, R2_URL: R2_PUBLIC_URL });

    if (isPano) {
        // Strip 'uploads/' if present (regardless of leading slash which was just normalized)
        const r2Path = normalizedPath.replace(/^uploads\//, '');
        const finalUrl = `${R2_PUBLIC_URL}/${r2Path}`;
        console.log('[DEBUG-ASSET] Redirecting to R2:', finalUrl);
        return finalUrl;
    }

    // Hotspot media assets
    if (lowerPath.startsWith('media/') || lowerPath.startsWith('uploads/media/')) {
        const mediaPath = normalizedPath.replace(/^uploads\//, '');
        return `${R2_PUBLIC_URL}/${mediaPath}`;
    }

    // Default to API server
    const finalUrl = `${API_URL}/${normalizedPath}`;
    console.log('[DEBUG-ASSET] Defaulting to API:', finalUrl);
    return finalUrl;
};
