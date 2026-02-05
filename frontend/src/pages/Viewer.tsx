import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import Viewer360 from '../components/Viewer360';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Maximize, Minimize, Share2, Info, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { cn } from '@/lib/utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const R2_PUBLIC_URL = 'https://pub-2c6a4a0072774a308e398234fc12ea61.r2.dev';

const getAssetUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    if (path.startsWith('media/') || path.includes('/cubemap') || path.includes('original.jpg') || path.includes('thumbnail.jpg')) {
        if (!path.startsWith('uploads/')) {
            return `${R2_PUBLIC_URL}/${path}`;
        }
    }
    return `${API_URL}/${path.replace(/^\.\//, '')}`;
};

// Helper for YouTube ID extraction
const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url?.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// Extracted Media Modal Component for hook safety and cleanliness
function InfoMediaModal({ hotspot, onClose }: { hotspot: any, onClose: () => void }) {
    const [imgIdx, setImgIdx] = useState(0);
    if (!hotspot) return null;

    const { title, description, image_url, video_url, additional_images } = hotspot;
    const additional = additional_images ? JSON.parse(additional_images) : [];
    const images = [image_url, ...additional].filter(Boolean);
    const ytId = getYoutubeId(video_url);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300 pointer-events-auto">
            <Card className="w-full max-w-2xl bg-white/90 backdrop-blur-3xl rounded-[2.5rem] border-white/50 overflow-hidden shadow-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-center p-8 border-b border-slate-100 bg-blue-50/30">
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">{title || "Information"}</h2>
                    <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-white transition-all shadow-sm" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                <div className="p-8 max-h-[70vh] overflow-y-auto space-y-6 scrollbar-thin">
                    {ytId && (
                        <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-lg bg-black">
                            <iframe
                                className="w-full h-full"
                                src={`https://www.youtube.com/embed/${ytId}`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                    )}

                    {images.length > 0 && (
                        <div className="relative group">
                            <div className="w-full aspect-[4/3] sm:aspect-video rounded-2xl overflow-hidden shadow-lg border border-slate-100 bg-slate-50 flex items-center justify-center">
                                <img
                                    src={getAssetUrl(images[imgIdx])}
                                    alt={title}
                                    className="w-full h-full object-cover animate-in fade-in duration-500"
                                    key={imgIdx}
                                />
                            </div>

                            {images.length > 1 && (
                                <>
                                    <div className="absolute inset-y-0 left-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm shadow-md"
                                            onClick={() => setImgIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="absolute inset-y-0 right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm shadow-md"
                                            onClick={() => setImgIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                                        {images.map((_, i) => (
                                            <div
                                                key={i}
                                                className={cn(
                                                    "h-1.5 rounded-full transition-all",
                                                    i === imgIdx ? "w-4 bg-blue-500" : "w-1.5 bg-white/60"
                                                )}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {description && (
                        <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100/50">
                            <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{description}</p>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
                    <Button
                        className="rounded-xl px-12 font-black uppercase text-[10px] tracking-widest bg-blue-500 hover:bg-blue-600 text-white h-11 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                        onClick={onClose}
                    >
                        Close
                    </Button>
                </div>
            </Card>
        </div>
    );
}

export default function Viewer() {
    const { id } = useParams();
    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentSceneID, setCurrentSceneID] = useState<string | null>(null);
    const [selectedHotspot, setSelectedHotspot] = useState<any>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showSceneList, setShowSceneList] = useState(false);

    useEffect(() => {
        const fetchProject = async () => {
            const token = localStorage.getItem('token');
            try {
                const endpoint = `${API_URL}/api/projects/${id}`;
                const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

                const res = await axios.get(endpoint, config);
                const projectData = res.data;
                const user = JSON.parse(localStorage.getItem('user') || '{}');

                document.title = `${projectData.name} | A360`;

                if (!projectData.is_active && !user.is_admin) {
                    setError("This tour is currently locked or inactive.");
                    return;
                }

                setProject(projectData);
                if (projectData.scenes && projectData.scenes.length > 0) {
                    setCurrentSceneID(projectData.scenes[0].id);
                }
            } catch (err: any) {
                console.error('Failed to fetch project', err);
                setError(err.response?.data?.error || 'Failed to load tour');
            } finally {
                setLoading(false);
            }
        };

        fetchProject();

        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, [id]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 shadow-xl shadow-blue-500/20"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Syncing Intelligence...</span>
        </div>
    );

    if (error || !project) return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-6">
            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-white shadow-xl shadow-blue-500/5 flex flex-col items-center animate-in zoom-in duration-500 max-w-sm w-full mx-4">
                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 mb-6">
                    <Info className="h-8 w-8 text-rose-500" />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-black text-slate-800 mb-2 tracking-tight uppercase">Access Restricted</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-relaxed px-4">
                        {error || 'The requested tour is currently inactive, locked, or protected by the A360 Governance layer.'}
                    </p>
                </div>
            </div>
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">A360 Workshop Platform</p>
        </div>
    );

    // Dynamic scene resolution
    const currentScene = project.scenes?.find((s: any) => s.id === currentSceneID) || project.scenes?.[0];
    const panoUrl = currentScene
        ? getAssetUrl(`${currentScene.pano_path}/cubemap`)
        : project.pano_path
            ? getAssetUrl(`${project.pano_path}/cubemap`)
            : '';

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Tour Link copied to clipboard!");
    };

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden">
            <InfoMediaModal
                hotspot={selectedHotspot}
                onClose={() => setSelectedHotspot(null)}
            />

            {/* Immersive Overlay */}
            <div className="absolute top-0 left-0 right-0 p-6 z-10 flex justify-between items-start pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <div className="bg-black/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                        <h1 className="text-white font-bold text-sm tracking-tight">{project.name}</h1>
                        <p className="text-white/50 text-[8px] uppercase font-bold tracking-widest">
                            {currentScene?.name || 'Main Exhibit'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 pointer-events-auto">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="bg-black/20 backdrop-blur-md border border-white/10 text-white rounded-xl h-10 w-10 hover:bg-white/90 hover:text-slate-900 hover:scale-105 transition-all shadow-xl"
                        onClick={toggleFullscreen}
                        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="bg-black/20 backdrop-blur-md border border-white/10 text-white rounded-xl h-10 w-10 hover:bg-white/90 hover:text-slate-900 hover:scale-105 transition-all shadow-xl"
                        onClick={handleShare}
                        title="Share Tour"
                    >
                        <Share2 className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Scene Dropdown Selector */}
            {project.scenes?.length > 1 && (
                <div className="absolute top-24 left-6 z-10 pointer-events-auto min-w-[160px]">
                    <div className="relative">
                        <Button
                            onClick={() => setShowSceneList(!showSceneList)}
                            className="w-full flex justify-between items-center bg-black/40 backdrop-blur-xl border border-white/10 text-white rounded-2xl px-4 h-11 hover:bg-black/60 transition-all font-bold text-[10px] uppercase tracking-widest"
                        >
                            <span className="truncate mr-2">{currentScene?.name || 'Select Scene'}</span>
                            <ChevronDown className={cn("h-4 w-4 transition-transform", showSceneList && "rotate-180")} />
                        </Button>

                        {showSceneList && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 py-2">
                                {project.scenes.map((scene: any) => (
                                    <button
                                        key={scene.id}
                                        onClick={() => {
                                            setCurrentSceneID(scene.id);
                                            setShowSceneList(false);
                                        }}
                                        className={cn(
                                            "w-full px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest transition-colors",
                                            currentSceneID === scene.id
                                                ? "bg-blue-500 text-white"
                                                : "text-white/60 hover:bg-white/10 hover:text-white"
                                        )}
                                    >
                                        {scene.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Hint Overlay */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white/50 text-[10px] uppercase font-bold tracking-[0.2em] pointer-events-none z-10">
                Drag to explore • Scroll to zoom
            </div>

            <div className="w-full h-full">
                <Viewer360
                    panoUrl={panoUrl}
                    hotspots={currentScene?.hotspots || project.Hotspots || []}
                    onNavigate={(targetID) => setCurrentSceneID(targetID)}
                    onInfoClick={(hs) => setSelectedHotspot(hs)}
                />
            </div>
        </div>
    );
}
