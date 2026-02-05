import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useLocation, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Plus,
    Upload,
    Loader2,
    Image as ImageIcon,
    Trash2,
    ExternalLink,
    CheckCircle2,
    X,
    Info,
    Clock,
    Link as LinkIcon,
    Globe,
    Lock,
    Settings,
    Eye,
    EyeOff,
    Play
} from 'lucide-react';
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

const MAX_RESOLUTION_W = 8000;
const MAX_RESOLUTION_H = 4000;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

interface PendingFile {
    file: File;
    name: string;
    size: string;
    resolution: string;
    status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
    isPublic: boolean;
    error?: string;
}

export default function Projects() {
    const location = useLocation();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [tourName, setTourName] = useState('');
    const [isTourPublic, setIsTourPublic] = useState(false);
    const [error, setError] = useState<string | null>(null);
    console.log(error); // Suppress unused error warning for build
    const fileInputRef = useRef<HTMLInputElement>(null);

    const savedUser = localStorage.getItem('user');
    const user = savedUser ? JSON.parse(savedUser) : null;

    useEffect(() => {
        fetchProjects();

        // Instant check based on mount
        const t = setTimeout(() => fetchProjects(), 500);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        // Check for ?upload=true
        const params = new URLSearchParams(location.search);
        if (params.get('upload') === 'true') {
            handleOpenUpload();
            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [location]);

    // Polling for processing status
    useEffect(() => {
        const hasProcessing = projects.some(p => p.status === 'processing');
        if (!hasProcessing) return;

        const interval = setInterval(() => {
            fetchProjects();
        }, 3000);

        return () => clearInterval(interval);
    }, [projects]);

    const handleOpenUpload = () => {
        if (!user?.is_admin && projects.length >= (user?.project_limit || 10)) {
            toast.error(`Project limit reached (${projects.length}/${user?.project_limit || 10}). Please contact admin.`);
            return;
        }
        setShowUploadModal(true);
    };

    const refreshProfile = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await axios.get(`${API_URL}/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            localStorage.setItem('user', JSON.stringify(res.data));
            window.dispatchEvent(new Event('profileUpdated'));
        } catch (err) {
            console.error("Failed to refresh profile", err);
        }
    };

    const fetchProjects = async (retryCount = 0) => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const res = await axios.get(`${API_URL}/api/projects`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects(res.data || []);
            setLoading(false);
            setError(null);
        } catch (err: any) {
            console.error('Failed to fetch projects', err);

            // Network retry logic (up to 3 times)
            if (retryCount < 3 && (!err.response || err.response.status >= 500)) {
                setTimeout(() => fetchProjects(retryCount + 1), 2000);
            } else {
                setError(err.response?.data?.error || "Connection error. Please check if server is running.");
                setLoading(false);
            }

            if (err.response?.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getResolution = (file: File): Promise<{ w: number, h: number, str: string }> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    resolve({
                        w: img.width,
                        h: img.height,
                        str: `${img.width} x ${img.height}`
                    });
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newPending: PendingFile[] = [];
        const duplicates: string[] = [];

        for (const file of files) {
            // 1. Strict File Type Check
            if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') {
                toast.error(`Skipped ${file.name}: Only JPG format allowed`);
                continue;
            }

            // 2. Strict Size Check (20MB)
            if (file.size > MAX_FILE_SIZE) {
                toast.error(`Skipped ${file.name}: Exceeds 20MB limit`);
                continue;
            }

            // Strict duplicate filename check
            if (pendingFiles.some(pf => pf.file.name === file.name) || newPending.some(pf => pf.file.name === file.name)) {
                duplicates.push(file.name);
                continue;
            }

            const res = await getResolution(file);

            // 3. Strict Resolution Check (8000x4000)
            if (res.w > MAX_RESOLUTION_W || res.h > MAX_RESOLUTION_H) {
                toast.error(`Skipped ${file.name}: Resolution ${res.str} exceeds limit (${MAX_RESOLUTION_W}x${MAX_RESOLUTION_H})`);
                continue;
            }

            newPending.push({
                file,
                name: tourName || file.name.split('.')[0],
                size: formatBytes(file.size),
                resolution: res.str,
                status: 'pending',
                isPublic: isTourPublic
            });
        }

        if (duplicates.length > 0) {
            toast.error(`Skipped ${duplicates.length} duplicate file(s): ${duplicates.join(', ')}`);
        }

        setPendingFiles([...pendingFiles, ...newPending]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemovePending = (index: number) => {
        setPendingFiles(pendingFiles.filter((_, i) => i !== index));
    };

    const handleNameChange = (newName: string) => {
        setTourName(newName);
    };

    const resetUploadForm = () => {
        setPendingFiles([]);
        setTourName('');
        setIsTourPublic(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleCloseModal = () => {
        if (pendingFiles.some(f => f.status === 'uploading')) {
            if (confirm('Upload in progress. Cancel?')) {
                setShowUploadModal(false);
                resetUploadForm();
            }
        } else {
            setShowUploadModal(false);
            resetUploadForm();
        }
    };

    const uploadAll = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const toUpload = pendingFiles.filter(f => f.status !== 'done');
        if (toUpload.length === 0) return;

        // Set all to uploading
        setPendingFiles(prev => prev.map(f => f.status === 'done' ? f : { ...f, status: 'uploading' }));

        const formData = new FormData();
        // Use independent tourName if set, otherwise fallback to the first file's name
        formData.append('name', tourName || toUpload[0].name);
        formData.append('is_public', isTourPublic ? 'true' : 'false');

        toUpload.forEach(f => {
            formData.append('panos[]', f.file);
        });

        try {
            await axios.post(`${API_URL}/api/projects/upload`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            // Success: Mark all as done
            setPendingFiles(prev => prev.map(f => ({ ...f, status: 'done' })));

            fetchProjects();
            refreshProfile();

            setTimeout(() => {
                setShowUploadModal(false);
                resetUploadForm();
            }, 1500);

            toast.success(`Success! Created multi-scene tour with ${toUpload.length} panoramas.`);
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || 'Upload error';
            setPendingFiles(prev => prev.map(f => f.status === 'done' ? f : { ...f, status: 'error', error: errorMsg }));
            toast.error(`Upload failed: ${errorMsg}`);
        }
    };


    const toggleGlobalPublic = () => {
        setIsTourPublic(prev => !prev);
    };


    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this tour?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/projects/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Tour deleted');
            fetchProjects();
            refreshProfile();
        } catch (err) {
            toast.error('Delete failed');
        }
    };

    const handleUpdateProject = async () => {
        if (!editingProject) return;
        const token = localStorage.getItem('token');
        try {
            await axios.put(`${API_URL}/api/projects/${editingProject.id}`, {
                name: editingProject.name,
                is_public: editingProject.is_public,
                is_active: editingProject.is_active
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Tour updated');
            setShowEditModal(false);
            fetchProjects();
        } catch (err) {
            toast.error('Update failed');
        }
    };

    return (
        <Layout>
            <div className="space-y-6">

                {error && (
                    <div className="bg-rose-50 border-2 border-rose-100 p-6 rounded-[2rem] flex items-center justify-between animate-in slide-in-from-top-4 duration-500 shadow-xl shadow-rose-500/5">
                        <div className="flex items-center gap-4 text-rose-600">
                            <div className="p-3 bg-rose-100 rounded-2xl">
                                <Info className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="font-black uppercase tracking-widest text-xs">System Alert</p>
                                <p className="text-sm font-medium opacity-80">{error}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setError(null)} className="h-10 w-10 text-rose-300 hover:text-rose-600 hover:bg-rose-100 rounded-xl">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                )}

                {/* Header Section Removed for Cleanliness */}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-muted-foreground animate-pulse font-medium">Synchronizing tours...</p>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-32 bg-white/40 backdrop-blur-xl rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-xl shadow-blue-500/5 transition-all hover:bg-white/60 group">
                        <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-md border border-slate-100 group-hover:scale-110 transition-transform duration-500">
                            <ImageIcon className="h-10 w-10 text-blue-500/40" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Workspace Empty</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-10 text-sm font-medium leading-relaxed">
                            Upload your equirectangular panoramas to begin building interactive 360° virtual tours for your workshop projects.
                        </p>
                        <Button
                            onClick={handleOpenUpload}
                            className="h-14 gap-3 shadow-2xl shadow-blue-500/20 font-black uppercase tracking-widest px-10 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl transition-all hover:scale-105 active:scale-95"
                            disabled={user && !user.is_admin && new Date().getTime() > new Date(user.expires_at).getTime()}
                        >
                            <Plus className="h-5 w-5" /> Start First Virtual Tour
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {projects.map((project) => (
                            <Card key={project.id} className={cn(
                                "overflow-hidden bg-white/70 backdrop-blur-xl border-white border-2 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 rounded-[2.5rem] group relative flex flex-col h-full",
                                !project.is_active && "grayscale opacity-80"
                            )}>
                                <div className="aspect-[16/10] relative overflow-hidden bg-slate-100 m-3 rounded-2xl">
                                    <img
                                        key={`${project.id}-${project.status}`}
                                        src={getAssetUrl(`${project.pano_path}/thumbnail.jpg`)}
                                        alt={project.name}
                                        className={cn(
                                            "w-full h-full object-cover transition-transform duration-700 group-hover:scale-110",
                                            project.status === 'processing' && "opacity-40 blur-sm brightness-50"
                                        )}
                                    />

                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px] z-20">
                                        <Link to={`/editor/${project.id}`} className={cn(project.status !== 'ready' && "pointer-events-none")}>
                                            <Button
                                                size="sm"
                                                className="h-8 gap-2 font-bold uppercase tracking-wider text-[9px] px-3 shadow-lg"
                                                disabled={project.status !== 'ready'}
                                            >
                                                <Plus className="h-3 w-3" /> Edit Tour
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="h-8 font-bold uppercase tracking-wider text-[9px] px-4"
                                            onClick={() => window.open(project.is_public && project.magic_code ? `/magic/${project.magic_code}` : `/viewer/${project.id}`, '_blank')}
                                            disabled={project.status !== 'ready' || !project.is_active}
                                        >
                                            <ExternalLink className="h-3 w-3" /> Play
                                        </Button>
                                    </div>

                                    {/* Processing Overlay */}
                                    {project.status === 'processing' && (
                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="h-6 w-6 animate-spin text-white/70" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/70 animate-pulse">Processing</span>
                                        </div>
                                    )}

                                    {/* Error Overlay */}
                                    {project.status === 'error' && (
                                        <div className="absolute inset-0 bg-destructive/20 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-2">
                                            <Info className="h-6 w-6 text-destructive" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-destructive animate-pulse">Slicing Failed</span>
                                        </div>
                                    )}
                                    <div className="absolute top-5 left-5 flex flex-col gap-1 items-start z-30">
                                        <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[10px] font-normal text-white/90 uppercase tracking-widest border border-white/10 flex items-center gap-1.5 shadow-xl">
                                            <Eye className="h-3 w-3 text-blue-400" /> {project.views || 0}
                                        </div>
                                    </div>
                                    <div className="absolute top-5 right-5 flex flex-col gap-1 items-end z-30">
                                        {!project.is_active ? (
                                            <div className="px-3 py-1 bg-red-500/80 backdrop-blur-md rounded-full text-[10px] font-black text-white uppercase tracking-widest border border-red-400/20 flex items-center gap-1.5 shadow-xl">
                                                Locked
                                            </div>
                                        ) : project.is_public ? (
                                            <div className="px-3 py-1 bg-blue-600/80 backdrop-blur-md rounded-full text-[10px] font-normal text-white uppercase tracking-[0.1em] border border-blue-400/30 flex items-center gap-1.5 shadow-xl">
                                                <Globe className="h-3 w-3" />
                                                <span>PUBLIC</span>
                                            </div>
                                        ) : (
                                            <div className="px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] font-normal text-white/50 uppercase tracking-widest border border-white/10 flex items-center gap-1.5 shadow-xl">
                                                <Lock className="h-3 w-3" /> PRIVATE
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <CardHeader className="p-5">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg font-black text-slate-800 line-clamp-1">
                                            {project.name}
                                        </CardTitle>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-white/40 hover:text-white hover:bg-white/10 rounded-xl"
                                                onClick={() => window.open(`/view/${project.id}`, '_blank')}
                                            >
                                                <Play className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50/50"
                                                onClick={() => {
                                                    setEditingProject({ ...project });
                                                    setShowEditModal(true);
                                                }}
                                                disabled={project.status !== 'ready'}
                                            >
                                                <Settings className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <CardDescription className="text-[10px] font-bold text-slate-400 flex items-center justify-between mt-3 uppercase tracking-wider">
                                        <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5 opacity-60" /> {new Date(project.created_at).toLocaleDateString()}</span>
                                        <span className="text-blue-500/60 font-black uppercase tracking-tighter">{project.scenes?.length || 0} Panoramas</span>
                                    </CardDescription>
                                </CardHeader>

                                {/* Enlarged Magic Code Footer */}
                                {project.magic_code && (
                                    <div className="mt-auto px-5 pb-5 pt-0">
                                        <div className="bg-slate-50/50 rounded-[1.5rem] p-3 border border-slate-100/50 flex items-center justify-between group/magic hover:bg-blue-50/50 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-0.5">Access Code</span>
                                                <div className="text-2xl font-black font-mono text-slate-800 tracking-[0.2em] flex items-center gap-2">
                                                    {project.magic_code}
                                                </div>
                                            </div>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="h-10 px-4 rounded-xl bg-white border border-slate-100 shadow-sm text-blue-600 font-black uppercase tracking-widest text-[9px] hover:bg-blue-600 hover:text-white transition-all group-hover/magic:scale-105 active:scale-95"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const url = `${window.location.origin}/view/${project.id}`;
                                                    navigator.clipboard.writeText(url);
                                                    toast.success("Tour Link copied!");
                                                }}
                                            >
                                                <LinkIcon className="h-3 w-3 mr-2" /> Copy URL
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        ))}

                        {/* Available Slot skeletons */}
                        {user && user.project_limit > projects.length && Array.from({ length: user.project_limit - projects.length }).map((_, idx) => (
                            <div
                                key={`skeleton-${idx}`}
                                onClick={() => {
                                    if (user && !user.is_admin && new Date().getTime() > new Date(user.expires_at).getTime()) {
                                        toast.error("Creative Phase expired. Contact A360 Workshop Team for extensions.");
                                        return;
                                    }
                                    handleOpenUpload();
                                }}
                                className={cn(
                                    "group relative overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white hover:border-blue-300 transition-all min-h-[350px]",
                                    (user && !user.is_admin && new Date().getTime() > new Date(user.expires_at).getTime()) && "opacity-50 cursor-not-allowed grayscale"
                                )}
                            >
                                <div className="w-16 h-16 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-blue-500 group-hover:border-blue-100 group-hover:scale-110 transition-all shadow-sm">
                                    <Plus className="h-8 w-8" />
                                </div>
                                <div className="text-center">
                                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">Available Slot</h4>
                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mt-1">Tour Slot {projects.length + idx + 1} of {user.project_limit}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Upload Modal Refined */}
            {
                showUploadModal && (
                    <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <Card className="w-full max-w-2xl shadow-2xl border-white/50 bg-white/90 backdrop-blur-3xl overflow-hidden rounded-[2.5rem] border-2 animate-in zoom-in-95 duration-300">
                            <CardHeader className="flex flex-row items-center justify-between border-b border-white/50 bg-blue-50/50 p-8">
                                <div>
                                    <CardTitle className="text-2xl font-bold">Upload Center</CardTitle>
                                    <CardDescription>Batch process equirectangular panoramas into cubemaps.</CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" onClick={handleCloseModal}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </CardHeader>

                            <CardContent className="space-y-8 p-6">
                                {/* Step 1: Main Naming - NOW AT TOP */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                                        <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">1</div>
                                        Setup Tour Name
                                    </div>
                                    <div className="bg-primary/5 p-6 rounded-2xl border-2 border-primary/10 shadow-sm space-y-4">
                                        <div className="flex items-end gap-4">
                                            <div className="flex-1 space-y-2">
                                                <Label className="text-[10px] uppercase text-primary font-black tracking-widest pl-1">Primary Tour Name</Label>
                                                <input
                                                    className="h-14 w-full bg-background border-2 border-primary/20 rounded-xl px-4 text-lg font-bold text-foreground placeholder:text-muted-foreground/30 focus:border-primary focus:ring-0 transition-all outline-none shadow-md"
                                                    value={tourName}
                                                    placeholder="e.g. Living Room Tour..."
                                                    onChange={e => handleNameChange(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2 pb-1">
                                                <Label className="text-[9px] uppercase tracking-widest font-black opacity-40 pr-1 block text-right">Tour Access</Label>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn(
                                                        "h-12 px-6 text-[10px] font-black uppercase rounded-xl border-2 shadow-sm transition-all animate-in zoom-in-95 duration-200",
                                                        isTourPublic ? "text-blue-500 bg-blue-500/10 border-blue-500/30" : "text-muted-foreground bg-muted/80 border-border"
                                                    )}
                                                    onClick={toggleGlobalPublic}
                                                >
                                                    {isTourPublic ? <Globe className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                                                    {isTourPublic ? "Public" : "Private"}
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-medium italic opacity-70 flex items-center gap-1.5 pl-1">
                                            <Info className="h-3 w-3" /> All panoramas in this batch will inherit the name and access setting above.
                                        </p>
                                    </div>
                                </div>

                                {/* Step 2: Selection */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                                        <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">2</div>
                                        Manage Panoramas
                                    </div>
                                    <div
                                        className={cn(
                                            "border-2 border-dashed border-primary/30 rounded-2xl p-6 hover:bg-primary/5 transition-all text-center group cursor-pointer bg-accent/5 backdrop-blur-sm",
                                            pendingFiles.length > 0 ? "p-4 py-8" : "p-12"
                                        )}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            multiple
                                            accept="image/jpeg"
                                            onChange={handleFileSelect}
                                        />
                                        <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform border border-primary/20 shadow-inner">
                                            <Upload className="h-6 w-6 text-primary" />
                                        </div>
                                        <h4 className="font-bold text-base text-foreground tracking-tight">
                                            {pendingFiles.length > 0 ? "Add More Panoramas" : "Click or Drag Panoramas"}
                                        </h4>
                                        {pendingFiles.length === 0 && (
                                            <p className="text-[11px] text-muted-foreground mt-2 px-6 leading-relaxed">Limit 20MB per file. Max resolution 8000x4000. JPG only.</p>
                                        )}
                                    </div>

                                    {/* Minimal Queue List */}
                                    {pendingFiles.length > 0 && (
                                        <div className="max-h-[250px] overflow-auto space-y-2 pt-2">
                                            {pendingFiles.map((pf, idx) => (
                                                <div key={idx} className="bg-card/50 border border-border p-3 rounded-xl flex items-center gap-4 group animate-in fade-in duration-300">
                                                    <div className="h-10 w-10 bg-primary/5 rounded-lg flex items-center justify-center shrink-0 border border-primary/10">
                                                        {pf.status === 'done' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : pf.status === 'uploading' ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <ImageIcon className="h-5 w-5 text-primary/30" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[11px] font-bold truncate opacity-70 flex items-center gap-2">
                                                            {pf.file.name}
                                                            <div className="flex gap-1">
                                                                <span className="text-[9px] font-medium px-1.5 py-0.5 bg-muted rounded uppercase text-muted-foreground tracking-tighter">{pf.size}</span>
                                                                <span className="text-[9px] font-medium px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded uppercase tracking-tighter">{pf.resolution}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {pf.status === 'pending' && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40 hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={() => handleRemovePending(idx)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>

                            <CardFooter className="gap-3 bg-blue-50/30 p-8 rounded-b-[2.5rem] border-t border-white/50">
                                <Button
                                    variant="outline"
                                    className="flex-1 h-12 rounded-2xl font-bold uppercase tracking-widest text-[10px] border-slate-200 hover:bg-white transition-all"
                                    onClick={handleCloseModal}
                                    disabled={pendingFiles.some(f => f.status === 'uploading')}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 h-12 gap-2 shadow-xl shadow-blue-500/20 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-blue-500 hover:bg-blue-600 text-white transition-all hover:scale-[1.02] active:scale-95"
                                    onClick={uploadAll}
                                    disabled={pendingFiles.length === 0 || pendingFiles.every(f => f.status === 'done' || f.status === 'uploading')}
                                >
                                    {pendingFiles.some(f => f.status === 'uploading') ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Batch Processing...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="h-4 w-4" />
                                            Process {pendingFiles.length} Pano{pendingFiles.length > 1 ? 's' : ''}
                                        </>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                )
            }

            {/* Tour Edit Modal */}
            {
                showEditModal && editingProject && (
                    <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <Card className="w-full max-w-md shadow-2xl border-white/50 bg-white/90 backdrop-blur-3xl overflow-hidden rounded-[2.5rem] border-2 animate-in zoom-in-95 duration-300">
                            <CardHeader className="flex flex-row items-center justify-between border-b border-white/50 bg-blue-50/50 p-8">
                                <div>
                                    <CardTitle className="text-2xl font-black text-slate-800">Tour Settings</CardTitle>
                                    <CardDescription className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-1">Configure visibility and access.</CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" className="rounded-full hover:bg-white" onClick={() => setShowEditModal(false)}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </CardHeader>

                            <CardContent className="space-y-8 p-8">
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <Label className="text-[10px] uppercase text-blue-500 font-black tracking-widest pl-1">Primary Tour Name</Label>
                                        <input
                                            className="h-14 w-full bg-background border-2 border-slate-200 rounded-2xl px-6 font-bold text-slate-800 outline-none focus:border-blue-500 transition-all shadow-sm"
                                            value={editingProject.name}
                                            onChange={e => setEditingProject({ ...editingProject, name: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-3">
                                            <Label className="text-[10px] uppercase text-blue-500 font-black tracking-widest pl-1 block">Visibility</Label>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full h-14 gap-2 font-black uppercase text-[10px] border-2 rounded-2xl transition-all shadow-sm",
                                                    editingProject.is_public ? "bg-emerald-50 text-emerald-600 border-emerald-500/20 shadow-emerald-500/5" : "bg-slate-50 border-slate-200 text-slate-400"
                                                )}
                                                onClick={() => setEditingProject({ ...editingProject, is_public: !editingProject.is_public })}
                                            >
                                                {editingProject.is_public ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                                {editingProject.is_public ? "Public" : "Private"}
                                            </Button>
                                        </div>
                                        <div className="space-y-3">
                                            <Label className="text-[10px] uppercase text-blue-500 font-black tracking-widest pl-1 block">Access State</Label>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full h-14 gap-2 font-black uppercase text-[10px] border-2 rounded-2xl transition-all shadow-sm",
                                                    editingProject.is_active ? "bg-blue-50 text-blue-600 border-blue-500/20 shadow-blue-500/5" : "bg-rose-50 border-rose-500/20 text-rose-500"
                                                )}
                                                onClick={() => setEditingProject({ ...editingProject, is_active: !editingProject.is_active })}
                                            >
                                                {editingProject.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                                {editingProject.is_active ? "Active" : "Locked"}
                                            </Button>
                                        </div>
                                    </div>

                                </div>
                            </CardContent>

                            <CardFooter className="flex items-center justify-between gap-3 bg-blue-50/30 p-8 border-t border-white/50 rounded-b-[2.5rem]">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-12 px-5 font-black uppercase tracking-widest text-[9px] gap-2 rounded-2xl shadow-xl shadow-rose-500/10 hover:scale-[1.02] transition-all"
                                    onClick={() => {
                                        handleDelete(editingProject.id);
                                        setShowEditModal(false);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" /> Delete Tour
                                </Button>
                                <div className="flex gap-3">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="bg-white text-slate-900 border-0 h-10 px-6 font-black uppercase text-[10px] tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all w-full"
                                        onClick={() => window.open(`/view/${editingProject.id}`, '_blank')}
                                    >
                                        <Play className="mr-2 h-4 w-4" /> Launch Tour
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="h-12 px-8 text-[10px] uppercase font-black tracking-widest rounded-2xl bg-blue-500 hover:bg-blue-600 text-white shadow-xl shadow-blue-500/20 hover:scale-[1.02] transition-all"
                                        onClick={handleUpdateProject}
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    </div>
                )
            }
        </Layout >
    );
}
