import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Plus, Clock, FileText, HardDrive, ShieldAlert, ArrowRight, Eye } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const R2_PUBLIC_URL = 'https://pub-2c6a4a0072774a308e398234fc12ea61.r2.dev';

const getAssetUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    if (path.startsWith('media/') || path.includes('/cubemap') || path.includes('original.jpg') || path.includes('thumbnail.jpg')) {
        // If it doesn't start with uploads/ and it's a known pattern, it's likely R2
        if (!path.startsWith('uploads/')) {
            return `${R2_PUBLIC_URL}/${path}`;
        }
    }
    return `${API_URL}/${path.replace(/^\.\//, '')}`;
};

export default function Dashboard() {
    const [projects, setProjects] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/login';
                return;
            }

            try {
                const projRes = await axios.get(`${API_URL}/api/projects`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setProjects(projRes.data || []);

                const userRes = await axios.get(`${API_URL}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUser(userRes.data);
                localStorage.setItem('user', JSON.stringify(userRes.data));
            } catch (err: any) {
                console.error('Failed to fetch dashboard data', err);
                if (err.response?.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const storageUsed = user?.storage_used || 0;
    const quota = user?.storage_quota || (500 * 1024 * 1024);
    const usagePercent = (storageUsed / quota) * 100;

    if (loading) return (
        <Layout>
            <div className="flex items-center justify-center h-[50vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 shadow-xl shadow-blue-500/20"></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Syncing Intelligence...</span>
                </div>
            </div>
        </Layout>
    );

    return (
        <Layout>
            <div className="space-y-10 pb-20">
                {/* Header Section */}
                <div className="flex justify-between items-center bg-white/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/50 shadow-xl shadow-blue-500/5 transition-all hover:shadow-2xl hover:shadow-blue-500/10 group">
                    <div>
                        <h2 className="text-4xl font-black tracking-tight text-slate-800 transition-transform group-hover:translate-x-1 duration-300">
                            Welcome, <span className="text-blue-500">{user?.email?.split('@')[0]}</span>
                        </h2>
                        <p className="text-slate-500 text-sm font-medium mt-1 uppercase tracking-widest opacity-60">You are currently accessing the A360 Workshop Environment.</p>
                    </div>
                    <Button
                        onClick={() => window.location.href = '/projects?upload=true'}
                        className="h-14 gap-3 shadow-2xl shadow-blue-500/30 font-black uppercase tracking-widest px-8 bg-blue-500 hover:bg-blue-600 text-white rounded-[1.5rem] transition-all hover:scale-[1.05] active:scale-95 border-b-4 border-blue-700 hover:border-blue-800"
                    >
                        <Plus className="h-5 w-5" /> New Project
                    </Button>
                </div>

                {/* Stats Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-white/80 border-white shadow-xl shadow-blue-500/5 rounded-[2.5rem] border-2 transition-transform hover:scale-[1.02] duration-300">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tours Used</CardTitle>
                            <div className="p-2 bg-blue-50 rounded-xl">
                                <FileText className="h-4 w-4 text-blue-500" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black text-slate-800">{projects.length} / <span className="text-blue-500">{user?.project_limit || 10}</span></div>
                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden mt-4 border border-white shadow-inner">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-1000",
                                        projects.length >= (user?.project_limit || 10) ? 'bg-rose-500' : 'bg-blue-500'
                                    )}
                                    style={{ width: `${Math.min(100, (projects.length / (user?.project_limit || 10)) * 100)}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="col-span-2 bg-white/80 border-white shadow-xl shadow-blue-500/5 rounded-[2.5rem] border-2 transition-transform hover:scale-[1.02] duration-300">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Physical Storage Occupancy</CardTitle>
                            <div className="p-2 bg-sky-50 rounded-xl">
                                <HardDrive className="h-4 w-4 text-sky-500" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-end justify-between mb-2">
                                <div className="text-3xl font-black text-slate-800">
                                    {(storageUsed / (1024 * 1024)).toFixed(1)} <span className="text-sky-500 text-lg uppercase">MB</span>
                                </div>
                                <Badge variant="outline" className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border-slate-100 uppercase tracking-widest hover:bg-slate-100">
                                    Limit: {(quota / (1024 * 1024)).toFixed(0)} MB
                                </Badge>
                            </div>
                            <div className="h-5 w-full bg-slate-100 rounded-full overflow-hidden mt-2 border border-white shadow-inner">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-1000",
                                        usagePercent > 90 ? 'bg-rose-500' : 'bg-sky-500'
                                    )}
                                    style={{ width: `${Math.min(100, usagePercent)}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {user?.is_admin ? (
                        <Link to="/admin" className="group">
                            <Card className="h-full bg-blue-600 border-blue-500 shadow-2xl shadow-blue-500/20 rounded-[2.5rem] border-2 transition-all hover:bg-blue-700 hover:-translate-y-1">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/60">Privileged Task</CardTitle>
                                    <div className="p-2 bg-white/10 rounded-xl">
                                        <ShieldAlert className="h-4 w-4 text-white" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-black text-white uppercase tracking-tight">Admin Console</div>
                                    <div className="flex items-center gap-2 mt-4 text-white/60 text-[10px] font-black uppercase tracking-[0.2em] group-hover:text-white transition-colors">
                                        Navigate Now <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ) : (
                        <Card className="bg-slate-50 border-slate-100 shadow-sm rounded-[2.5rem] border-2 opacity-60">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Account Tier</CardTitle>
                                <div className="p-2 bg-white rounded-xl">
                                    <ShieldAlert className="h-4 w-4 text-slate-300" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-slate-400 uppercase tracking-tight">Academic</div>
                                <Badge variant="outline" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4 border-slate-200">Active Standard Plan</Badge>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sub-header */}
                <div className="flex items-center gap-4 px-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Recent Initiatives</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                </div>

                {/* Projects Section */}
                {projects.length === 0 ? (
                    <div className="text-center py-24 bg-white/40 border-slate-200/50 border-2 border-dashed rounded-[3rem] backdrop-blur-sm group hover:bg-white/60 transition-colors">
                        <div className="mb-6 mx-auto w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center border-2 border-white shadow-sm transition-transform group-hover:scale-110 duration-500">
                            <FileText className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800">No tours detected in your vault</h3>
                        <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto mt-2">Initialize your first immersive project to populate your command center.</p>
                        <Button
                            className="mt-8 h-12 rounded-[1.2rem] gap-2 font-black uppercase tracking-widest px-8 bg-white border-2 border-slate-100 hover:border-blue-200 hover:text-blue-500 shadow-sm transition-all"
                            variant="outline"
                            onClick={() => window.location.href = '/projects?upload=true'}
                        >
                            <Plus className="h-4 w-4" /> Create First Tour
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {projects.slice(0, 6).map((project) => (
                            <Link key={project.id} to={`/viewer/${project.id}`} className="group relative">
                                <Card className="overflow-hidden border-2 border-white bg-white/70 backdrop-blur-lg rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group-hover:-translate-y-2">
                                    <div className="aspect-[16/10] bg-slate-100 relative overflow-hidden m-3 rounded-[2rem]">
                                        <img
                                            src={getAssetUrl(`${project.pano_path}/thumbnail.jpg`)}
                                            alt={project.name}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            onError={(e) => {
                                                (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1518005020411-38b8122f5ee6?auto=format&fit=crop&q=80&w=800';
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                                            <div className="flex items-center gap-2 text-white font-black uppercase tracking-widest text-[10px] translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                                Launch Immersive Viewer <Eye className="h-3 w-3 text-blue-400" />
                                            </div>
                                        </div>
                                    </div>
                                    <CardHeader className="p-6 pt-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-xl font-black text-slate-800 line-clamp-1 group-hover:text-blue-500 transition-colors uppercase tracking-tight">{project.name || 'Anonymous Tour'}</CardTitle>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        <Clock className="h-3 w-3 opacity-60" /> {new Date(project.created_at).toLocaleDateString()}
                                                    </span>
                                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                    <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 uppercase">1 Pano</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}

                {projects.length > 6 && (
                    <div className="flex justify-center mt-12">
                        <Button
                            variant="ghost"
                            className="h-12 rounded-2xl px-8 font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all border-2 border-transparent hover:border-blue-100"
                            onClick={() => window.location.href = '/projects'}
                        >
                            View All {projects.length} Projects <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        </Layout>
    );
}
