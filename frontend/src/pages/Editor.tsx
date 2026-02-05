import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Viewer360 from '../components/Viewer360';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Save, ArrowLeft, Share2, Trash2, Loader2, X, Image as ImageIcon, Edit2, Check, Upload } from 'lucide-react';
import axios from 'axios';
import { toast } from "sonner";
import { cn } from '@/lib/utils';

export default function Editor() {
    const { id } = useParams();
    const [project, setProject] = useState<any>(null);
    const [currentSceneID, setCurrentSceneID] = useState<string | null>(null);
    const [hotspots, setHotspots] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [activeType, setActiveType] = useState<'info' | 'scene'>('scene');
    const [showSceneSelector, setShowSceneSelector] = useState(false);
    const [showInfoEditor, setShowInfoEditor] = useState(false);
    const [pendingHotspot, setPendingHotspot] = useState<{ yaw: number, pitch: number } | null>(null);
    const [editingHotspot, setEditingHotspot] = useState<any>(null);
    const [isRenamingScene, setIsRenamingScene] = useState(false);
    const [newSceneName, setNewSceneName] = useState('');
    const [uploadingMedia, setUploadingMedia] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

    const fetchProject = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/api/projects/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const fetchedProject = res.data;
            setProject(fetchedProject);

            // If no scene selected, pick the first one
            if (!currentSceneID && fetchedProject.scenes?.length > 0) {
                setCurrentSceneID(fetchedProject.scenes[0].id);
                setHotspots(fetchedProject.scenes[0].hotspots || []);
            } else if (!currentSceneID && fetchedProject.hotspots?.length > 0) {
                // Fallback for legacy project-level hotspots
                setHotspots(fetchedProject.hotspots);
            } else if (currentSceneID) {
                // Refresh hotspots for current scene
                const currentScene = fetchedProject.scenes?.find((s: any) => s.id === currentSceneID);
                setHotspots(currentScene?.hotspots || []);
            }
        } catch (err) {
            console.error('Failed to fetch project', err);
            toast.error("Failed to load project.");
        }
    };

    useEffect(() => {
        fetchProject();
    }, [id]);

    const handleAddHotspot = (yaw: number, pitch: number) => {
        if (activeType === 'scene') {
            setPendingHotspot({ yaw, pitch });
            setShowSceneSelector(true);
        } else {
            setEditingHotspot({
                yaw,
                pitch,
                type: 'info',
                title: '',
                description: '',
                image_url: '',
                video_url: '',
                target: 'info',
                tempId: Date.now()
            });
            setShowInfoEditor(true);
        }
    };

    const handleSelectScene = (scene: any) => {
        if (!pendingHotspot) return;
        const newHotspot = {
            yaw: pendingHotspot.yaw,
            pitch: pendingHotspot.pitch,
            type: 'scene',
            target: `scene:${scene.id}`,
            target_scene_id: scene.id
        };

        if (editingHotspot) {
            // Update existing
            const index = hotspots.findIndex(h => h.id === editingHotspot.id || h.tempId === editingHotspot.tempId);
            if (index > -1) {
                const newHotspots = [...hotspots];
                newHotspots[index] = { ...editingHotspot, ...newHotspot };
                setHotspots(newHotspots);
            }
        } else {
            setHotspots([...hotspots, newHotspot]);
        }

        setShowSceneSelector(false);
        setPendingHotspot(null);
        setEditingHotspot(null);
    };

    const handleSaveInfoHotspot = () => {
        if (!editingHotspot) return;

        // Ensure additional_images is stringified if it's an array
        const finalHotspot = { ...editingHotspot };
        if (Array.isArray(finalHotspot.image_urls)) {
            finalHotspot.additional_images = JSON.stringify(finalHotspot.image_urls.filter((url: string) => url.trim() !== ''));
            delete finalHotspot.image_urls;
        }

        const existingIndex = hotspots.findIndex(h =>
            (h.id && h.id === finalHotspot.id) ||
            (h.tempId && h.tempId === finalHotspot.tempId)
        );

        if (existingIndex > -1) {
            const newHotspots = [...hotspots];
            newHotspots[existingIndex] = finalHotspot;
            setHotspots(newHotspots);
        } else {
            setHotspots([...hotspots, finalHotspot]);
        }

        setShowInfoEditor(false);
        setEditingHotspot(null);
    };

    const handleUpdateSceneName = async () => {
        if (!currentSceneID || !newSceneName) return;
        const token = localStorage.getItem('token');
        try {
            await axios.put(`${API_URL}/api/projects/scenes/${currentSceneID}`, { name: newSceneName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Scene name updated!");
            setIsRenamingScene(false);
            fetchProject();
        } catch (err) {
            toast.error("Failed to rename scene.");
        }
    };

    const handleMediaUpload = async (files: FileList | File[]): Promise<string[]> => {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        Array.from(files).forEach(file => formData.append('files[]', file));

        setUploadingMedia(true);
        try {
            const res = await axios.post(`${API_URL}/api/projects/media`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            return res.data.urls.map((url: string) => `${API_URL}/${url}`);
        } catch (err) {
            toast.error("Upload failed.");
            return [];
        } finally {
            setUploadingMedia(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const token = localStorage.getItem('token');
        try {
            const endpoint = currentSceneID
                ? `${API_URL}/api/projects/scenes/${currentSceneID}/hotspots`
                : `${API_URL}/api/projects/${id}/hotspots`;

            await axios.post(endpoint, hotspots, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Hotspots saved successfully!");
            fetchProject();
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to save hotspots.");
        } finally {
            setSaving(false);
        }
    };

    const currentScene = project?.scenes?.find((s: any) => s.id === currentSceneID) || project?.scenes?.[0];
    const panoUrl = currentScene
        ? `${API_URL}/${currentScene.pano_path.replace(/^\.\//, '')}/cubemap`
        : '';

    if (!project) return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 shadow-xl shadow-blue-500/20"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading Workspace...</span>
        </div>
    );

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden">
            {/* Top Overlay */}
            <div className="absolute top-0 left-0 right-0 p-6 z-10 flex justify-between items-start pointer-events-none">
                <div className="pointer-events-auto flex gap-3">
                    <Button
                        variant="secondary"
                        size="sm"
                        className="bg-white/90 backdrop-blur-md rounded-xl text-slate-900 border-0 h-10 px-4 font-black uppercase text-[10px] tracking-widest shadow-xl hover:scale-105 transition-all"
                        onClick={() => window.location.href = '/projects'}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Exit
                    </Button>
                </div>

                <Card className="pointer-events-auto bg-black/40 border-white/10 backdrop-blur-xl text-white p-5 rounded-[2rem] w-80 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="text-sm font-black tracking-tight uppercase">{project.name}</h2>
                        </div>
                        <div className="flex items-center gap-2 group">
                            {isRenamingScene ? (
                                <div className="flex items-center gap-1 w-full">
                                    <input
                                        autoFocus
                                        className="bg-white/10 border-0 rounded px-2 py-0.5 text-[10px] text-white flex-1 focus:ring-1 focus:ring-blue-500"
                                        value={newSceneName}
                                        onChange={(e) => setNewSceneName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateSceneName()}
                                    />
                                    <button onClick={handleUpdateSceneName} className="text-blue-400 hover:text-blue-300">
                                        <Check className="h-3 w-3" />
                                    </button>
                                    <button onClick={() => setIsRenamingScene(false)} className="text-white/40 hover:text-white/60">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest truncate">Editor • {currentScene?.name || 'Untitled Scene'}</p>
                                    <button
                                        onClick={() => {
                                            setNewSceneName(currentScene?.name || '');
                                            setIsRenamingScene(true);
                                        }}
                                        className="opacity-20 group-hover:opacity-100 text-white hover:text-blue-400 transition-all ml-auto"
                                    >
                                        <Edit2 className="h-3 w-3" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h3 className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Scene Selection</h3>
                            <div className="flex flex-wrap gap-1.5 capitalize">
                                {project.scenes?.map((scene: any) => (
                                    <button
                                        key={scene.id}
                                        onClick={() => {
                                            setCurrentSceneID(scene.id);
                                            setHotspots(scene.hotspots || []);
                                        }}
                                        className={cn(
                                            "text-[9px] font-bold px-3 py-1.5 rounded-lg border transition-all",
                                            currentSceneID === scene.id
                                                ? "bg-blue-500 border-blue-400 text-white"
                                                : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                                        )}
                                    >
                                        {scene.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Authoring Mode</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "h-12 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 transition-all",
                                        activeType === 'scene' ? "bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/20" : "bg-white/5 border-white/10 text-white/40"
                                    )}
                                    onClick={() => setActiveType('scene')}
                                >
                                    Floor Spot
                                </Button>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "h-12 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 transition-all",
                                        activeType === 'info' ? "bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-500/20" : "bg-white/5 border-white/10 text-white/40"
                                    )}
                                    onClick={() => setActiveType('info')}
                                >
                                    Info Tag
                                </Button>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Live Hotspots ({hotspots.length})</h3>
                            <div className="max-h-[120px] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                {hotspots.map((hs, i) => (
                                    <div key={i} className="group relative text-[9px] bg-white/5 border border-white/5 p-2 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors">
                                        <div
                                            className="flex flex-col cursor-pointer flex-1"
                                            onClick={() => {
                                                if (hs.type === 'info') {
                                                    const images = hs.additional_images ? JSON.parse(hs.additional_images) : [];
                                                    setEditingHotspot({ ...hs, image_urls: images });
                                                    setShowInfoEditor(true);
                                                } else {
                                                    setPendingHotspot({ yaw: hs.yaw, pitch: hs.pitch });
                                                    setEditingHotspot(hs);
                                                    setShowSceneSelector(true);
                                                }
                                            }}
                                        >
                                            <span className="font-black text-white/80">{hs.type === 'scene' ? 'Portal' : 'Info'}: {hs.title || hs.target || 'Untitled'}</span>
                                            <span className="opacity-40 font-mono tracking-tighter">Y:{hs.yaw.toFixed(0)} P:{hs.pitch.toFixed(0)}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-white/20 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => setHotspots(hotspots.filter((_, idx) => idx !== i))}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                                {hotspots.length === 0 && (
                                    <div className="text-center py-4 border border-dashed border-white/10 rounded-xl">
                                        <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest leading-relaxed px-4">Click inside the sphere to place a pivot point</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2">
                            <Button
                                className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl h-11 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save
                            </Button>
                            <Button
                                variant="outline"
                                className="bg-transparent border-white/10 text-white hover:bg-white/5 rounded-xl h-11 font-black text-[10px] uppercase tracking-widest"
                                onClick={() => {
                                    const url = `${window.location.origin}/viewer/${id}`;
                                    navigator.clipboard.writeText(url);
                                    toast.success("Viewer URL copied to clipboard!");
                                }}
                            >
                                <Share2 className="mr-2 h-4 w-4" /> Share
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="w-full h-full">
                <Viewer360
                    panoUrl={panoUrl}
                    hotspots={hotspots}
                    onAddHotspot={handleAddHotspot}
                    onNavigate={(targetID) => {
                        setCurrentSceneID(targetID);
                        const scene = project.scenes?.find((s: any) => s.id === targetID);
                        setHotspots(scene?.hotspots || []);
                    }}
                    onEditHotspot={(hs) => {
                        if (hs.type === 'info') {
                            const images = hs.additional_images ? JSON.parse(hs.additional_images) : [];
                            setEditingHotspot({ ...hs, image_urls: images });
                            setShowInfoEditor(true);
                        } else {
                            // Link/Scene hotspot
                            setPendingHotspot({ yaw: hs.yaw, pitch: hs.pitch });
                            setEditingHotspot(hs); // Mark which one we are editing
                            setShowSceneSelector(true);
                        }
                    }}
                />
            </div>

            {/* Scene Selection Modal */}
            {showSceneSelector && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <Card className="w-full max-w-2xl bg-white/90 backdrop-blur-3xl rounded-[2.5rem] border-white/50 overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">Select Target Scene</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pick a panorama to link this Floor Spot to.</p>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowSceneSelector(false)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="p-8 max-h-[60vh] overflow-y-auto">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {project.scenes?.filter((s: any) => s.id !== currentSceneID).map((scene: any) => (
                                    <button
                                        key={scene.id}
                                        onClick={() => handleSelectScene(scene)}
                                        className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all shadow-md bg-slate-100"
                                    >
                                        <img
                                            src={`${API_URL}/${scene.pano_path}/thumbnail.jpg`}
                                            alt={scene.name}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-60 pointer-events-none" />
                                        <div className="absolute bottom-3 left-3 right-3 text-left">
                                            <p className="text-[10px] font-black text-white uppercase tracking-wider line-clamp-1">{scene.name}</p>
                                        </div>
                                    </button>
                                ))}
                                {(!project.scenes || project.scenes.length <= 1) && (
                                    <div className="col-span-full py-20 text-center flex flex-col items-center gap-3">
                                        <ImageIcon className="h-10 w-10 text-slate-200" />
                                        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No other scenes available to link.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                            <Button
                                variant="ghost"
                                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                                onClick={() => setShowSceneSelector(false)}
                            >
                                Cancel Placement
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Info Editor Modal */}
            {showInfoEditor && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <Card className="w-full max-w-xl bg-white/90 backdrop-blur-3xl rounded-[2.5rem] border-white/50 overflow-hidden shadow-2xl animate-in zoom-in-95 p-8">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">Info Hotspot Settings</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure multimedia content for this marker.</p>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { setShowInfoEditor(false); setEditingHotspot(null); }}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Title</label>
                                <input
                                    className="w-full h-12 rounded-2xl bg-slate-100 border-0 px-4 text-xs font-bold focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                                    placeholder="Enter Title..."
                                    value={editingHotspot?.title || ''}
                                    onChange={(e) => setEditingHotspot({ ...editingHotspot, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description</label>
                                <textarea
                                    className="w-full h-32 rounded-2xl bg-slate-100 border-0 p-4 text-xs font-medium focus:ring-2 focus:ring-blue-500 transition-all resize-none shadow-inner"
                                    placeholder="Tell more about this spot..."
                                    value={editingHotspot?.description || ''}
                                    onChange={(e) => setEditingHotspot({ ...editingHotspot, description: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">YouTube URL</label>
                                    <input
                                        className="w-full h-12 rounded-2xl bg-slate-100 border-0 px-4 text-[10px] font-mono focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                                        placeholder="https://youtube.com/..."
                                        value={editingHotspot?.video_url || ''}
                                        onChange={(e) => setEditingHotspot({ ...editingHotspot, video_url: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hotspot Media</label>
                                    </div>

                                    {/* Unified Multi-Upload Zone */}
                                    <div className="relative group h-40 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 transition-all hover:bg-blue-50/30 hover:border-blue-300 overflow-hidden">
                                        {uploadingMedia ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Processing Media...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="h-12 w-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                                                    <Upload className="h-6 w-6" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xs font-black text-slate-600 uppercase tracking-tight">Click to Upload Images</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Select one or many files</p>
                                                </div>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            multiple
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            accept="image/*"
                                            onChange={async (e) => {
                                                const files = e.target.files;
                                                if (files && files.length > 0) {
                                                    const urls = await handleMediaUpload(files);
                                                    if (urls.length > 0) {
                                                        let main = editingHotspot.image_url;
                                                        let additional = [...(editingHotspot.image_urls || [])];

                                                        urls.forEach((url) => {
                                                            if (!main) {
                                                                main = url;
                                                            } else {
                                                                additional.push(url);
                                                            }
                                                        });

                                                        setEditingHotspot({ ...editingHotspot, image_url: main, image_urls: additional });
                                                        toast.success(`Added ${urls.length} images`);
                                                    }
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Preview Gallery */}
                                    {(editingHotspot?.image_url || (editingHotspot?.image_urls || []).length > 0) && (
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-300 ml-1">Gallery Preview ({1 + (editingHotspot?.image_urls?.length || 0)})</label>
                                            <div className="grid grid-cols-4 gap-3">
                                                {/* Main Image Preview */}
                                                {editingHotspot?.image_url && (
                                                    <div className="relative aspect-square rounded-2xl bg-white border-2 border-blue-500 overflow-hidden group">
                                                        <img src={editingHotspot.image_url} className="w-full h-full object-cover" />
                                                        <span className="absolute top-1.5 left-1.5 bg-blue-500 text-[7px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">Cover</span>
                                                        <button
                                                            onClick={() => setEditingHotspot({ ...editingHotspot, image_url: '' })}
                                                            className="absolute inset-0 bg-rose-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Additional Previews */}
                                                {(editingHotspot?.image_urls || []).map((url: string, idx: number) => (
                                                    <div key={idx} className="relative aspect-square rounded-2xl bg-white border border-slate-100 overflow-hidden group">
                                                        <img src={url} className="w-full h-full object-cover" />
                                                        <button
                                                            onClick={() => {
                                                                const newImages = editingHotspot.image_urls.filter((_: any, i: number) => i !== idx);
                                                                setEditingHotspot({ ...editingHotspot, image_urls: newImages });
                                                            }}
                                                            className="absolute inset-0 bg-rose-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-8">
                            <Button
                                className="flex-1 h-12 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all"
                                onClick={handleSaveInfoHotspot}
                            >
                                Confirm Details
                            </Button>
                            <Button
                                variant="ghost"
                                className="h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                                onClick={() => { setShowInfoEditor(false); setEditingHotspot(null); }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

// ImageUpload helper removed in favor of integrated grid for multi-upload experience
