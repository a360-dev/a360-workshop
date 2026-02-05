import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import {
    Box,
    Settings,
    LogOut,
    Menu,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    const [user, setUser] = useState<any>(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });
    const isAdmin = !!user?.is_admin;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;
            try {
                const res = await axios.get(`${API_URL}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUser(res.data);
                localStorage.setItem('user', JSON.stringify(res.data));
            } catch (err) {
                console.error("Layout failed to refresh user", err);
            }
        };

        const handleProfileUpdate = () => {
            const saved = localStorage.getItem('user');
            if (saved) setUser(JSON.parse(saved));
        };

        fetchUser();
        window.addEventListener('profileUpdated', handleProfileUpdate);
        return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
    }, [location.pathname]);

    const navItems = isAdmin
        ? [
            { id: 'admin', icon: Settings, label: 'Admin Console', href: '/admin' },
            { id: 'all-projects', icon: Box, label: 'Global Tours', href: '/all-projects' }
        ]
        : [
            { id: 'projects', icon: Box, label: 'Personal Projects', href: '/projects' }
        ];

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    return (
        <div className="min-h-screen bg-[#F0F9FF] relative flex flex-col md:flex-row overflow-hidden font-sans">
            {/* CSS Bokeh / Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200/30 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-sky-200/20 rounded-full blur-[150px]" />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-white rounded-full blur-[100px] opacity-60" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
            </div>

            {isAdmin ? (
                <>
                    {/* Admin Sidebar */}
                    {sidebarOpen && (
                        <div
                            className="fixed inset-0 bg-black/50 z-40 md:hidden"
                            onClick={() => setSidebarOpen(false)}
                        />
                    )}

                    <aside
                        className={cn(
                            "fixed inset-y-0 left-0 z-50 w-64 bg-white/80 backdrop-blur-2xl border-r border-white/50 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 shadow-xl shadow-blue-500/5 flex flex-col",
                            sidebarOpen ? "translate-x-0" : "-translate-x-full"
                        )}
                    >
                        <div className="p-6 border-b border-white/50 flex justify-between items-center bg-blue-50/50">
                            <h1 className="text-2xl font-black tracking-tighter text-slate-800">
                                A360 <span className="text-blue-500">WORKSHOP</span>
                            </h1>
                            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(false)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        <nav className="p-4 space-y-2 flex-1">
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.href;
                                return (
                                    <Link key={item.id} to={item.href}>
                                        <Button
                                            variant={isActive ? "secondary" : "ghost"}
                                            className={cn(
                                                "w-full justify-start gap-3 rounded-2xl h-11 font-bold transition-all",
                                                isActive ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600 hover:text-white" : "text-slate-500 hover:bg-blue-50 hover:text-blue-500"
                                            )}
                                        >
                                            <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-blue-400")} />
                                            {item.label}
                                        </Button>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="p-4">
                            <Button
                                variant="outline"
                                className="w-full justify-start gap-3 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 rounded-2xl border-transparent"
                                onClick={handleLogout}
                            >
                                <LogOut className="h-5 w-5" />
                                Sign Out
                            </Button>
                            <div className="mt-4 px-2 text-[10px] text-muted-foreground/50 font-mono text-center">
                                v1.2.6-ws-pro
                            </div>
                        </div>
                    </aside>

                    <div className="flex-1 flex flex-col min-h-screen relative z-10 overflow-hidden">
                        <header className="md:hidden h-16 border-b border-white/50 flex items-center px-4 bg-white/80 backdrop-blur-xl shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                                <Menu className="h-6 w-6 text-slate-600" />
                            </Button>
                            <span className="ml-4 font-black text-slate-800 uppercase tracking-widest text-[11px]">Virtual Tours</span>
                        </header>
                        <main className="flex-1 p-6 md:p-8 overflow-auto">
                            {children}
                        </main>
                    </div>
                </>
            ) : (
                <>
                    {/* User Top Bar Layout */}
                    <div className="flex-1 flex flex-col min-h-screen relative z-10 overflow-hidden">
                        <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
                            <div className="max-w-7xl mx-auto bg-white/80 backdrop-blur-3xl border border-white/50 rounded-[2rem] shadow-xl shadow-blue-500/5 flex items-center justify-between px-8 h-16 transition-all border-b-4 border-blue-500/10">
                                <div className="flex items-center gap-6">
                                    <h1 className="text-xl font-black tracking-tighter text-slate-800">
                                        A360 <span className="text-blue-500">WORKSHOP</span>
                                    </h1>

                                    {/* Capacity Ribbon for Users */}
                                    <div className="hidden lg:flex items-center gap-4 ml-6 pl-6 border-l border-slate-200">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-normal uppercase tracking-widest text-slate-400">Project Pool</span>
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                                <span className="text-sm font-normal text-slate-700">
                                                    {user?.projects?.length || 0} <span className="text-slate-300 mx-0.5">/</span> {user?.project_limit || 0}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-normal uppercase tracking-widest text-slate-400">Storage Usage</span>
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                <span className="text-sm font-normal text-slate-700">
                                                    {Math.round(((user?.storage_used || 0) / (user?.storage_quota || 1)) * 100)}% Used
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="hidden md:flex flex-col items-end mr-2 text-right">
                                        <span className="text-sm font-normal text-slate-800 tracking-tight leading-none mb-1">{user?.email}</span>
                                        <span className="text-[10px] font-normal text-blue-500 uppercase tracking-widest leading-none">
                                            {user?.expires_at ? (() => {
                                                const now = new Date().getTime();
                                                const creativeExp = new Date(user.expires_at).getTime();
                                                const totalExp = creativeExp + (60 * 24 * 60 * 60 * 1000); // +60 days

                                                if (now < creativeExp) {
                                                    const days = Math.max(0, Math.ceil((creativeExp - now) / (1000 * 60 * 60 * 24)));
                                                    return `${days} Days - Workshop Remaining`;
                                                } else if (now < totalExp) {
                                                    const days = Math.max(0, Math.ceil((totalExp - now) / (1000 * 60 * 60 * 24)));
                                                    return `${days} Days - View-Only Phase`;
                                                } else {
                                                    return 'Access Expired';
                                                }
                                            })() : (
                                                'Academic Access'
                                            )}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                                        onClick={handleLogout}
                                    >
                                        <LogOut className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        </header>

                        <main className="flex-1 p-6 md:p-8 pt-24 md:pt-28 overflow-auto">
                            <div className="max-w-7xl mx-auto">
                                {children}
                            </div>
                        </main>
                    </div>
                </>
            )}
        </div>
    );
}
