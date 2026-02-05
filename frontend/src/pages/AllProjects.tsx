import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';

import {
    Image as ImageIcon,
    Globe,
    ShieldCheck,
    Search,
    Eye
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function AllProjects() {
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await axios.get(`${API_URL}/api/projects`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects(res.data || []);
        } catch (err) {
            console.error('Failed to fetch projects', err);
            toast.error('Failed to fetch platform projects');
        } finally {
            setLoading(false);
        }
    };



    const filteredProjects = projects.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.magic_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Layout>
            <div className="space-y-10 pb-20">
                {/* Administrative Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/50 shadow-xl shadow-blue-500/5 group gap-6">
                    <div>
                        <h2 className="text-4xl font-black tracking-tight text-slate-800 flex items-center gap-4">
                            <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20">
                                <ShieldCheck className="h-8 w-8 text-white" />
                            </div>
                            Global <span className="text-blue-500">Archives</span>
                        </h2>
                        <p className="text-slate-500 text-sm font-medium mt-1 uppercase tracking-widest opacity-60">
                            Monitoring {projects.length} public institutional tours across the ecosystem.
                        </p>
                    </div>

                    <div className="relative w-full md:w-[400px] group/search">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within/search:text-blue-500 transition-colors" />
                        <input
                            placeholder="Search by tour name, creator, or code..."
                            className="w-full bg-white/80 border-2 border-white rounded-[1.5rem] pl-12 pr-4 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-100/50 shadow-sm transition-all placeholder:text-slate-300 placeholder:font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-6">
                        <div className="relative">
                            <div className="h-16 w-16 rounded-full border-4 border-slate-100 border-t-blue-500 animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Globe className="h-6 w-6 text-blue-500/50" />
                            </div>
                        </div>
                        <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Retrieving Digital Heritage...</p>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="text-center py-32 bg-white/40 border-slate-200/50 border-2 border-dashed rounded-[3rem] backdrop-blur-sm">
                        <div className="bg-slate-50 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm border-2 border-white">
                            <ImageIcon className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800">No projects match your query</h3>
                        <p className="text-slate-500 font-medium max-w-sm mx-auto mt-2">
                            {searchTerm ? "Adjust your search parameters to find the specific tour." : "The global archive is currently empty."}
                        </p>
                        {searchTerm && (
                            <Button variant="ghost" className="mt-6 font-black uppercase tracking-widest text-[10px] text-blue-500" onClick={() => setSearchTerm('')}>
                                Clear Search Filter
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                        {filteredProjects.map((project) => (
                            <Card key={project.id} className="overflow-hidden bg-white/70 backdrop-blur-lg border-white border-2 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 rounded-[2rem] group relative flex flex-col h-full">
                                <div className="aspect-[16/10] bg-slate-100 relative overflow-hidden m-2.5 rounded-xl">
                                    <img
                                        src={`${API_URL}/${project.pano_path.replace(/^\.\//, '')}/thumbnail.jpg`}
                                        alt={project.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1518005020411-38b8122f5ee6?auto=format&fit=crop&q=80&w=800';
                                        }}
                                    />

                                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="h-9 rounded-xl font-black uppercase tracking-widest text-[9px] px-4 bg-white hover:bg-white/90 text-slate-900 transition-all hover:scale-105 active:scale-95"
                                            onClick={() => window.open(`/view/${project.id}`, '_blank')}
                                        >
                                            <Eye className="h-3.5 w-3.5 mr-2" /> Launch
                                        </Button>
                                    </div>
                                </div>

                                <CardHeader className="p-4 pt-0 space-y-2 flex-1">
                                    <div className="flex flex-col gap-1">
                                        <CardTitle className="text-sm font-black text-slate-800 truncate group-hover:text-blue-500 transition-colors uppercase tracking-tight">
                                            {project.name || 'Anonymous Project'}
                                        </CardTitle>
                                        <div className="flex items-center gap-1.5 opacity-40">
                                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-full">
                                                Created by {project.user?.email || 'System'} • {project.scenes?.length || 0} Panos
                                            </span>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-slate-50 mt-auto flex flex-col items-center">
                                        <div className="text-lg font-black text-blue-500 tracking-[0.6em] font-mono pl-[0.6em] uppercase">
                                            {project.magic_code || '----'}
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}
