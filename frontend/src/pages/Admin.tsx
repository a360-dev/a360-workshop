// Verified Patch 2.0
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Trash2, Ticket, Plus, Clock, Pencil, Search, ChevronLeft, ChevronRight, ListTodo, HardDrive, Database, Copy } from 'lucide-react';
import axios from 'axios';
import { cn } from '@/lib/utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function Admin() {
    const [inviteEmail, setInviteEmail] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [regCodes, setRegCodes] = useState<any[]>([]);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [stats, setStats] = useState({ total_users: 0, total_codes: 0, active_codes: 0, total_space: 0 });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'users' | 'codes' | 'invites' | 'logs'>('users');
    const [userSearch, setUserSearch] = useState('');
    const [userPage, setUserPage] = useState(1);
    const [userTotal, setUserTotal] = useState(0);
    const [inviteIsAdmin, setInviteIsAdmin] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);

    // Derived safety state
    const safeUsers = Array.isArray(users) ? users : [];

    // New code form refined
    const [newCode, setNewCode] = useState({
        code: '',
        description: '',
        max_usage: 50,
        project_limit: 3,
        storage_quota: 300 * 1024 * 1024, // Initialized but updated on change
        expiry_months: 3, // Default to 3
        is_active: true,
        valid_from: new Date().toISOString().split('T')[0]
    });


    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            const user = JSON.parse(savedUser);
            if (!user.is_admin) {
                window.location.href = '/dashboard';
                return;
            }
        } else {
            window.location.href = '/login';
            return;
        }

        fetchCodes();
        fetchStats();
        fetchInvitations();
        fetchAuditLogs();
        generateRandomCode();
    }, []);

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        }
    }, [userPage, activeTab]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === 'users') {
                setUserPage(1);
                fetchUsers();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [userSearch]);

    useEffect(() => {
        if (!showInviteModal) {
            setInviteEmail('');
            setInviteIsAdmin(false);
        }
    }, [showInviteModal]);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const fetchStats = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await axios.get(`${API_URL}/api/admin/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(res.data);
        } catch (err) {
            console.error('Failed to fetch stats', err);
        }
    };

    const fetchAuditLogs = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await axios.get(`${API_URL}/api/admin/audit-logs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAuditLogs(res.data);
        } catch (err) {
            console.error('Failed to fetch audit logs', err);
        }
    };

    const fetchInvitations = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await axios.get(`${API_URL}/api/admin/invitations`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInvitations(res.data);
        } catch (err) {
            console.error('Failed to fetch invitations', err);
        }
    };

    const fetchUsers = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login';
            return;
        }

        try {
            const res = await axios.get(`${API_URL}/api/admin/users`, {
                params: {
                    search: userSearch,
                    page: userPage,
                    limit: 10
                },
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(Array.isArray(res.data?.users) ? res.data.users : []);
            setUserTotal(res.data?.total || 0);
        } catch (err: any) {
            console.error('Failed to fetch users', err);
            if (err.response?.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }
        }
    };

    const fetchCodes = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const res = await axios.get(`${API_URL}/api/admin/reg-codes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRegCodes(res.data);
        } catch (err: any) {
            console.error('Failed to fetch codes', err);
            if (err.response?.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/admin/invite`, {
                email: inviteEmail,
                is_admin: inviteIsAdmin
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(`Invitation sent to ${inviteEmail} `);
            setInviteEmail('');
            setInviteIsAdmin(false);
            setShowInviteModal(false);
            fetchInvitations();
        } catch (err: any) {
            console.error('Invite error', err);
            if (err.response?.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }
            toast.error(err.response?.data?.error || 'Failed to send invite');
        } finally {
            setLoading(false);
        }
    };

    const generateRandomCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setNewCode({ ...newCode, code: result });
    };

    const handleCreateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/admin/reg-codes`, newCode, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchCodes();
            generateRandomCode();
            setNewCode(prev => ({ ...prev, description: '', max_usage: 50 }));
            setShowCodeModal(false);
            toast.success('Registration code created successfully!');
        } catch (err: any) {
            console.error('Create code error', err);
            if (err.response?.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }
            toast.error(err.response?.data?.error || 'Failed to create registration code');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm('Are you sure you want to PERMANENTLY delete this user and all their projects? This cannot be undone.')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/admin/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('User deleted successfully');
            fetchUsers();
        } catch (err) {
            toast.error('Failed to delete user');
        }
    };

    const handleDeleteCode = async (id: number) => {
        if (!confirm('Are you sure you want to delete this code?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/admin/reg-codes/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Registration code deleted');
            fetchCodes();
        } catch (err) {
            toast.error('Failed to delete registration code');
        }
    };

    const handleToggleCode = async (id: number) => {
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/api/admin/reg-codes/${id}/toggle`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchCodes();
        } catch (err) {
            toast.error('Failed to toggle code status');
        }
    };

    const handleToggleAdmin = async (id: number) => {
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/api/admin/users/${id}/toggle-admin`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchUsers();
        } catch (err) {
            toast.error('Failed to toggle admin status');
        }
    };

    const handleToggleActive = async (userId: number) => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            await axios.patch(`${API_URL}/api/admin/users/${userId}/toggle-active`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('User status updated');
            fetchUsers();
        } catch (err) {
            toast.error('Failed to update user status');
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/api/admin/users/${editingUser.id}`, {
                storage_quota: editingUser.storage_quota,
                project_limit: editingUser.project_limit,
                valid_from: new Date(editingUser.valid_from).toISOString(),
                expires_at: new Date(editingUser.expires_at).toISOString()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('User updated successfully');
            setShowEditUserModal(false);
            fetchUsers();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to update user');
        } finally {
            setLoading(false);
        }
    };

    const handleRecalculateStorage = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/admin/recalculate-storage`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Storage statistics recalculated');
            fetchStats();
        } catch (err) {
            toast.error('Failed to recalculate storage');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteInvitation = async (id: number) => {
        if (!confirm('Cancel this invitation?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/admin/invitations/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Invitation cancelled');
            fetchInvitations();
        } catch (err) {
            toast.error('Failed to delete invitation');
        }
    };

    const copyRegistrationLink = (code: string) => {
        const url = `${window.location.origin}/register?code=${code}`;
        navigator.clipboard.writeText(url);
        toast.success('Registration link copied to clipboard!');
    };

    return (
        <Layout>
            <div className="space-y-8">
                <div className="flex justify-between items-center bg-white/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/50 shadow-xl shadow-blue-500/5 mb-2 group">
                    <div>
                        <h2 className="text-4xl font-black tracking-tight text-slate-800 transition-transform group-hover:translate-x-1 duration-300">
                            Admin <span className="text-blue-500">Console</span>
                        </h2>
                        <p className="text-slate-500 text-sm font-medium mt-1 uppercase tracking-widest opacity-60">System Governance & Oversight</p>
                    </div>
                    <div className="flex bg-blue-50/50 p-1.5 rounded-2xl shadow-inner border border-blue-100/50">
                        <Button
                            variant={activeTab === 'users' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('users')}
                            className={cn("rounded-xl font-bold uppercase tracking-widest text-[10px] h-9 px-4 transition-all", activeTab === 'users' ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:text-blue-500")}
                        >
                            <Users className="h-4 w-4 mr-2" /> Users
                        </Button>
                        <Button
                            variant={activeTab === 'invites' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('invites')}
                            className={cn("rounded-xl font-bold uppercase tracking-widest text-[10px] h-9 px-4 transition-all", activeTab === 'invites' ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:text-blue-500")}
                        >
                            <Mail className="h-4 w-4 mr-2" /> Invitations
                        </Button>
                        <Button
                            variant={activeTab === 'codes' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('codes')}
                            className={cn("rounded-xl font-bold uppercase tracking-widest text-[10px] h-9 px-4 transition-all", activeTab === 'codes' ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:text-blue-500")}
                        >
                            <Ticket className="h-4 w-4 mr-2" /> Seminar Codes
                        </Button>
                        <Button
                            variant={activeTab === 'logs' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('logs')}
                            className={cn("rounded-xl font-bold uppercase tracking-widest text-[10px] h-9 px-4 transition-all", activeTab === 'logs' ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:text-blue-500")}
                        >
                            <ListTodo className="h-4 w-4 mr-2" /> Audit Logs
                        </Button>
                    </div>
                </div>

                {activeTab === 'users' && (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <Card className="bg-white/50 backdrop-blur-lg border-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03)] rounded-[2rem] overflow-hidden border-2">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-blue-500/5">
                                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Platform Users</CardTitle>
                                    <Users className="h-4 w-4 text-blue-500" />
                                </CardHeader>
                                <CardContent className="pt-4 pb-6">
                                    <div className="text-3xl font-black text-slate-800">{stats.total_users}</div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">Total registered accounts</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-white/50 backdrop-blur-lg border-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03)] rounded-[2rem] overflow-hidden border-2">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-sky-500/5">
                                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500">Seminar Codes</CardTitle>
                                    <Ticket className="h-4 w-4 text-sky-500" />
                                </CardHeader>
                                <CardContent className="pt-4 pb-6">
                                    <div className="text-3xl font-black text-slate-800">{stats.total_codes}</div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">
                                        <span className="text-sky-500 font-bold">{stats.active_codes}</span> active / {stats.total_codes} total
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="bg-white/50 backdrop-blur-lg border-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03)] rounded-[2rem] overflow-hidden border-2">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-amber-500/5">
                                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Storage Usage</CardTitle>
                                    <HardDrive className="h-4 w-4 text-amber-500" />
                                </CardHeader>
                                <CardContent className="pt-4 pb-6">
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <div className="text-3xl font-black text-slate-800">
                                                {stats.total_space > 1024 * 1024 * 1024
                                                    ? `${(stats.total_space / (1024 * 1024 * 1024)).toFixed(2)} GB`
                                                    : `${(stats.total_space / (1024 * 1024)).toFixed(0)} MB`
                                                }
                                            </div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">Total physical data</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-3 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/10 text-amber-600 bg-amber-50 rounded-xl border border-amber-100 shadow-sm"
                                            onClick={handleRecalculateStorage}
                                            disabled={loading}
                                        >
                                            <Database className="h-3 w-3 mr-1.5" /> Sync
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="bg-white/60 backdrop-blur-xl border-white shadow-xl shadow-blue-500/5 rounded-[3rem] overflow-hidden border-2">
                            <CardHeader className="p-8 pb-4">
                                <CardTitle className="text-2xl font-black text-slate-800">User Management</CardTitle>
                                <CardDescription className="text-slate-500 font-medium">View and manage all registered accounts, their roles, and tour limits.</CardDescription>
                                <div className="mt-6 relative max-w-sm">
                                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search by email..."
                                        className="pl-10 h-11 bg-slate-50 border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100/50 transition-all text-xs font-medium"
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="relative w-full overflow-auto px-8 pb-8">
                                    <table className="w-full caption-bottom text-sm text-left">
                                        <thead className="[&_tr]:border-b-0">
                                            <tr className="transition-colors truncate">
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">User Identity</th>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center">Role</th>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center">Status</th>
                                                <th className="h-10 px-4 align-middle font-medium text-muted-foreground text-[10px] uppercase tracking-wider text-center">Register</th>
                                                <th className="h-10 px-4 align-middle font-medium text-muted-foreground text-[10px] uppercase tracking-wider text-center">Expiry</th>
                                                <th className="h-10 px-4 align-middle font-medium text-muted-foreground text-[10px] uppercase tracking-wider text-center">Tours Created</th>
                                                <th className="h-10 px-4 align-middle font-medium text-muted-foreground text-[10px] uppercase tracking-wider text-center">Storage Usage</th>
                                                <th className="h-10 px-4 align-middle font-medium text-muted-foreground text-[10px] uppercase tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="[&_tr:last-child]:border-0">
                                            {safeUsers.map((user) => {
                                                const isExpired = user.expires_at && new Date(user.expires_at) < new Date();
                                                const isInactive = !user.is_active;
                                                return (
                                                    <tr key={user.id} className={cn(
                                                        "border-b transition-colors hover:bg-muted/50",
                                                        (isExpired || isInactive) && "bg-slate-100/50 grayscale-[0.5] opacity-80"
                                                    )}>
                                                        <td className="p-4 align-middle font-medium">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold">{user.full_name || "N/A"}</span>
                                                                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">{user.user_type || "Direct"}</span>
                                                                </div>
                                                                <span className="text-xs text-muted-foreground">{user.email}</span>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] text-muted-foreground/70">ID: {user.id}</span>
                                                                    {isInactive && <span className="text-[8px] bg-slate-200 text-slate-600 px-1 rounded font-black uppercase">Inactive</span>}
                                                                    {isExpired && <span className="text-[8px] bg-red-100 text-red-600 px-1 rounded font-black uppercase">Expired</span>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-middle text-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className={cn("h-7 px-2 text-[10px] uppercase font-bold rounded", user.is_admin ? "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20" : "text-muted-foreground hover:bg-muted/20")}
                                                                onClick={() => handleToggleAdmin(user.id)}
                                                                disabled={user.email === 'admin@example.com'}
                                                            >
                                                                {user.is_admin ? 'Admin' : 'User'}
                                                            </Button>
                                                        </td>
                                                        <td className="p-4 align-middle text-center">
                                                            <button
                                                                onClick={() => handleToggleActive(user.id)}
                                                                disabled={user.email === 'admin@example.com'}
                                                                className={cn(
                                                                    "h-2.5 w-2.5 rounded-full ring-2 ring-offset-2 transition-all mx-auto",
                                                                    user.is_active
                                                                        ? "bg-green-500 ring-green-500/20 hover:bg-green-600"
                                                                        : "bg-slate-300 ring-slate-200 hover:bg-slate-400"
                                                                )}
                                                                title={user.is_active ? "Active" : "Inactive"}
                                                            />
                                                        </td>
                                                        <td className="p-4 align-middle text-center text-[10px] font-medium text-muted-foreground">
                                                            {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB') : '-'}
                                                        </td>
                                                        <td className="p-4 align-middle text-center text-[10px] font-medium text-muted-foreground">
                                                            {user.expires_at ? new Date(user.expires_at).toLocaleDateString('en-GB') : '-'}
                                                        </td>
                                                        <td className="p-4 align-middle text-center font-mono text-[10px] font-bold">
                                                            {user.projects?.length || 0} / {user.project_limit}
                                                        </td>
                                                        <td className="p-4 align-middle text-center text-[10px] font-medium">
                                                            {formatBytes(user.storage_used || 0)} / {formatBytes(user.storage_quota)}
                                                        </td>
                                                        <td className="p-4 align-middle text-right">
                                                            <div className="flex justify-end gap-1">
                                                                {user.email !== 'admin@example.com' && (
                                                                    <>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-muted-foreground hover:text-blue-500 hover:bg-blue-50"
                                                                            onClick={() => {
                                                                                setEditingUser({
                                                                                    ...user,
                                                                                    valid_from: user.valid_from ? new Date(user.valid_from).toISOString().split('T')[0] : '',
                                                                                    expires_at: user.expires_at ? new Date(user.expires_at).toISOString().split('T')[0] : ''
                                                                                });
                                                                                setShowEditUserModal(true);
                                                                            }}
                                                                        >
                                                                            <Pencil className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-destructive hover:text-red-500 hover:bg-red-50"
                                                                            onClick={() => handleDeleteUser(user.id)}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex items-center justify-between px-2 py-4 border-t mt-4">
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold">
                                        Showing {(userPage - 1) * 10 + 1} to {Math.min(userPage * 10, userTotal)} of {userTotal} users
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setUserPage(p => Math.max(1, p - 1))}
                                            disabled={userPage === 1}
                                            className="h-8 px-2 text-[10px] uppercase font-bold"
                                        >
                                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                                        </Button>
                                        <div className="text-[10px] font-bold px-2 uppercase">
                                            Page {userPage} / {Math.ceil(userTotal / 10) || 1}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setUserPage(p => p + 1)}
                                            disabled={userPage >= Math.ceil(userTotal / 10)}
                                            className="h-8 px-2 text-[10px] uppercase font-bold"
                                        >
                                            Next <ChevronRight className="h-4 w-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Dialog open={showEditUserModal} onOpenChange={setShowEditUserModal}>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader className="text-left">
                                    <DialogTitle className="flex items-center gap-2">
                                        <Pencil className="h-5 w-5 text-primary" /> Edit User Account
                                    </DialogTitle>
                                    <DialogDescription>
                                        Modify access limits and validity periods for {editingUser?.email}.
                                    </DialogDescription>
                                </DialogHeader>
                                {editingUser && (
                                    <form onSubmit={handleUpdateUser} className="space-y-4 pt-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs">Full Name</Label>
                                            <Input
                                                value={editingUser.full_name || ''}
                                                onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                                                placeholder="e.g. John Doe"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">User Type</Label>
                                            <select
                                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                value={editingUser.user_type || ''}
                                                onChange={(e) => setEditingUser({ ...editingUser, user_type: e.target.value })}
                                            >
                                                <option value="">Select Type</option>
                                                <option value="Student">Student</option>
                                                <option value="Teacher/Professor">Teacher/Professor</option>
                                                <option value="Anonymous">Anonymous</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Tour Limit</Label>
                                                <Input
                                                    type="number"
                                                    value={editingUser.project_limit}
                                                    onChange={(e) => setEditingUser({ ...editingUser, project_limit: parseInt(e.target.value) })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Quota (MB)</Label>
                                                <Input
                                                    type="number"
                                                    value={editingUser.storage_quota / (1024 * 1024)}
                                                    onChange={(e) => setEditingUser({ ...editingUser, storage_quota: parseInt(e.target.value) * 1024 * 1024 })}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Register Date</Label>
                                                <Input
                                                    type="date"
                                                    value={editingUser.created_at ? new Date(editingUser.created_at).toISOString().split('T')[0] : ''}
                                                    disabled
                                                    className="bg-muted/50"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Expiry Date</Label>
                                                <Input
                                                    type="date"
                                                    value={editingUser.expires_at}
                                                    onChange={(e) => setEditingUser({ ...editingUser, expires_at: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <Button className="w-full mt-4 h-10 font-bold uppercase tracking-widest text-[10px]" disabled={loading}>
                                            {loading ? 'Updating...' : 'Save Changes'}
                                        </Button>
                                    </form>
                                )}
                            </DialogContent>
                        </Dialog>
                    </>
                )}

                {activeTab === 'invites' && (
                    <div className="flex flex-col gap-6">
                        {/* Send Invitation Dialog (Standard UI) */}
                        <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
                            <DialogContent className="sm:max-w-[425px] rounded-[2.5rem] border-2 border-white bg-white/90 backdrop-blur-3xl shadow-2xl p-8">
                                <DialogHeader className="text-center pb-4">
                                    <div className="mx-auto w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center border-2 border-white shadow-sm ring-4 ring-blue-50/50 mb-4">
                                        <Mail className="h-7 w-7 text-blue-500" />
                                    </div>
                                    <DialogTitle className="text-2xl font-black text-slate-800">Send <span className="text-blue-500">Invite</span></DialogTitle>
                                    <DialogDescription className="text-slate-500 font-medium">Issue a secure access invitation via email.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleInvite} className="space-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Recipient Space</Label>
                                        <Input
                                            placeholder="student@a360.co.th"
                                            type="email"
                                            required
                                            className="h-12 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100/50 transition-all font-medium"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50 shadow-inner group transition-colors hover:bg-blue-50/50">
                                        <div className="space-y-0.5">
                                            <Label className="text-xs font-black text-slate-700 uppercase tracking-tight">Admin Authority</Label>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Grant system governance access</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="h-5 w-5 accent-blue-500 cursor-pointer rounded-lg"
                                            checked={inviteIsAdmin}
                                            onChange={(e) => setInviteIsAdmin(e.target.checked)}
                                        />
                                    </div>
                                    <Button className="w-full h-12 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 mt-4" disabled={loading}>
                                        {loading ? 'Transmitting...' : 'Issue Invitation'}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>

                        <Card className="bg-white/60 backdrop-blur-xl border-white shadow-xl shadow-blue-500/5 rounded-[3rem] overflow-hidden border-2">
                            <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                                <div className="space-y-1">
                                    <CardTitle className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                        <Clock className="h-6 w-6 text-blue-500" /> Pending Invitations
                                    </CardTitle>
                                    <CardDescription className="text-slate-500 font-medium tracking-tight">Track secure access tokens and their redemption status.</CardDescription>
                                </div>
                                <Button onClick={() => setShowInviteModal(true)} className="h-12 gap-3 shadow-2xl shadow-blue-500/30 font-black uppercase tracking-widest px-8 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl transition-all hover:scale-[1.05] active:scale-95 border-b-4 border-blue-700">
                                    <Plus className="h-5 w-5" /> Issue Token
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="relative w-full overflow-auto px-8 pb-8">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Target Identity</th>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center">Authority</th>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center">Token Status</th>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center">Expiry</th>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invitations.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-12 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">No invitations found in database</td>
                                                </tr>
                                            ) : (
                                                invitations.map((invite) => (
                                                    <tr key={invite.id} className={cn("border-b border-slate-50 transition-colors hover:bg-blue-50/30 group", invite.is_used && "opacity-40")}>
                                                        <td className="p-4 align-middle">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-slate-700">{invite.email}</span>
                                                                {invite.is_used && <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">Identified User</span>}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-middle text-center">
                                                            <Badge className={cn("rounded-lg font-black uppercase tracking-widest text-[9px] px-2", invite.is_admin ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200")}>
                                                                {invite.is_admin ? 'Admin' : 'User'}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-4 align-middle text-center">
                                                            {invite.is_used ? (
                                                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-lg font-black uppercase tracking-widest text-[9px] px-2">REDEEMED</Badge>
                                                            ) : new Date(invite.expires_at) < new Date() ? (
                                                                <Badge className="bg-red-100 text-red-700 border-red-200 rounded-lg font-black uppercase tracking-widest text-[9px] px-2">STALE</Badge>
                                                            ) : (
                                                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 rounded-lg font-black uppercase tracking-widest text-[9px] px-2">SECURE</Badge>
                                                            )}
                                                        </td>
                                                        <td className="p-4 align-middle text-center text-xs font-bold text-slate-400">
                                                            {new Date(invite.expires_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="p-4 align-middle text-right">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 rounded-xl hover:bg-red-50 hover:text-red-600 border-slate-100 shadow-sm"
                                                                onClick={() => handleDeleteInvitation(invite.id)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
                {activeTab === 'codes' && (
                    <div className="flex flex-col gap-6">
                        <Dialog open={showCodeModal} onOpenChange={setShowCodeModal}>
                            <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-2 border-white bg-white/90 backdrop-blur-3xl shadow-2xl p-8">
                                <DialogHeader className="text-center pb-4">
                                    <div className="mx-auto w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center border-2 border-white shadow-sm ring-4 ring-sky-50/50 mb-4">
                                        <Ticket className="h-7 w-7 text-sky-500" />
                                    </div>
                                    <DialogTitle className="text-2xl font-black text-slate-800">Seminar <span className="text-sky-500">Registration</span></DialogTitle>
                                    <DialogDescription className="text-slate-500 font-medium tracking-tight">Generate bulk access codes for classroom environments.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreateCode} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                            Registration Key (Max 6)
                                            <Button
                                                type="button"
                                                variant="link"
                                                className="h-auto p-0 text-[10px] uppercase font-black text-sky-500 hover:text-sky-600"
                                                onClick={generateRandomCode}
                                            >
                                                Auto-Generate
                                            </Button>
                                        </Label>
                                        <Input
                                            placeholder="SEM24X"
                                            required
                                            maxLength={6}
                                            className="uppercase font-black text-center tracking-[0.3em] text-2xl h-16 rounded-2xl bg-sky-50/50 border-sky-100 focus:bg-white focus:ring-4 focus:ring-sky-100/50 transition-all text-slate-700"
                                            value={newCode.code}
                                            onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase().slice(0, 6) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Seminar Identifier</Label>
                                        <Input
                                            placeholder="e.g. Physics Section A"
                                            required
                                            className="h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100/50 transition-all font-medium"
                                            value={newCode.description}
                                            onChange={(e) => setNewCode({ ...newCode, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Max Accounts</Label>
                                            <Input
                                                type="number"
                                                className="h-11 rounded-xl bg-slate-50 border-slate-100 font-bold"
                                                value={newCode.max_usage}
                                                onChange={(e) => setNewCode({ ...newCode, max_usage: parseInt(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Tours / User</Label>
                                            <Input
                                                type="number"
                                                className="h-11 rounded-xl bg-slate-50 border-slate-100 font-bold"
                                                value={newCode.project_limit}
                                                onChange={(e) => {
                                                    const limit = parseInt(e.target.value);
                                                    setNewCode({
                                                        ...newCode,
                                                        project_limit: limit,
                                                        storage_quota: limit * 100 * 1024 * 1024
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 items-end">
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Launch Date</Label>
                                            <Input
                                                type="date"
                                                className="h-11 rounded-xl bg-slate-50 border-slate-100 font-bold text-xs"
                                                value={newCode.valid_from}
                                                onChange={(e) => setNewCode({ ...newCode, valid_from: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Validity</Label>
                                            <div className="h-11 flex items-center px-4 bg-slate-100 rounded-xl text-[10px] font-black text-slate-500 uppercase">
                                                3 Months Fixed
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 transition-colors">
                                        <input
                                            type="checkbox"
                                            id="isActive"
                                            className="h-5 w-5 accent-emerald-500 cursor-pointer"
                                            checked={newCode.is_active}
                                            onChange={(e) => setNewCode({ ...newCode, is_active: e.target.checked })}
                                        />
                                        <Label htmlFor="isActive" className="cursor-pointer text-[10px] font-black text-emerald-700 uppercase tracking-tight">Deploy Registration Key Immediately</Label>
                                    </div>
                                    <Button className="w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-black uppercase tracking-widest shadow-xl shadow-sky-500/20 transition-all hover:scale-[1.02] active:scale-95 mt-4" disabled={loading}>
                                        {loading ? 'Processing...' : 'Generate Seminar Code'}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>

                        <Card className="bg-white/60 backdrop-blur-xl border-white shadow-xl shadow-blue-500/5 rounded-[3rem] overflow-hidden border-2">
                            <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                                <div className="space-y-1">
                                    <CardTitle className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                        <Ticket className="h-6 w-6 text-sky-500" /> Seminar Access Keys
                                    </CardTitle>
                                    <CardDescription className="text-slate-500 font-medium tracking-tight">Monitor and control high-volume registration channels.</CardDescription>
                                </div>
                                <Button onClick={() => setShowCodeModal(true)} className="h-12 gap-3 shadow-2xl shadow-sky-500/30 font-black uppercase tracking-widest px-8 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl transition-all hover:scale-[1.05] active:scale-95 border-b-4 border-sky-700">
                                    <Plus className="h-5 w-5" /> New Master Code
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="relative w-full overflow-auto px-8 pb-8">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center w-[60px]">Status</th>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Master Key</th>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Description</th>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center">Usage</th>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center">Expiry</th>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center">Limit</th>
                                                <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {regCodes.map((code) => (
                                                <tr key={code.id} className="border-b border-slate-50 transition-colors hover:bg-sky-50/20 group">
                                                    <td className="p-4 align-middle text-center">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleCode(code.id);
                                                            }}
                                                            className={cn(
                                                                "h-3 w-3 rounded-full ring-4 ring-offset-2 transition-all mx-auto",
                                                                code.is_active
                                                                    ? "bg-emerald-500 ring-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                                                    : "bg-slate-200 ring-slate-100"
                                                            )}
                                                            title={code.is_active ? "Enabled" : "Disabled"}
                                                        />
                                                    </td>
                                                    <td className="p-4 align-middle">
                                                        <span className="font-mono font-black tracking-[0.2em] text-sky-600 bg-sky-50 px-3 py-1 rounded-lg border border-sky-100">
                                                            {code.code}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 align-middle">
                                                        <span className="font-bold text-slate-600 text-xs">{code.description || "Unlabeled Seminar"}</span>
                                                    </td>
                                                    <td className="p-4 align-middle text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[10px] font-black text-slate-800 tracking-tighter">
                                                                {code.usage_count} / {code.max_usage === 0 ? '∞' : code.max_usage}
                                                            </span>
                                                            <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                                <div
                                                                    className="h-full bg-sky-500"
                                                                    style={{ width: `${Math.min(100, (code.usage_count / (code.max_usage || 100)) * 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 align-middle text-center">
                                                        <span className={cn("text-[10px] font-black uppercase tracking-tighter", new Date(code.expires_at) < new Date() ? "text-red-500" : "text-slate-400")}>
                                                            {new Date(code.expires_at).toLocaleDateString()}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 align-middle text-center">
                                                        <Badge className="bg-slate-100 text-slate-600 border-slate-200 rounded-lg text-[9px] font-black">
                                                            {code.project_limit} PANO
                                                        </Badge>
                                                    </td>
                                                    <td className="p-4 align-middle text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 rounded-xl hover:bg-blue-50 hover:text-blue-600 border-slate-100 shadow-sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    copyRegistrationLink(code.code);
                                                                }}
                                                            >
                                                                <Copy className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 rounded-xl hover:bg-red-50 hover:text-red-600 border-slate-100 shadow-sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteCode(code.id);
                                                                }}
                                                                disabled={code.usage_count > 0}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
                {activeTab === 'logs' && (
                    <Card className="bg-white/60 backdrop-blur-xl border-white shadow-xl shadow-blue-500/5 rounded-[3rem] overflow-hidden border-2">
                        <CardHeader className="p-8 pb-4">
                            <CardTitle className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                <ListTodo className="h-6 w-6 text-slate-400" /> Audit Logs
                            </CardTitle>
                            <CardDescription className="text-slate-500 font-medium tracking-tight">Traceable history of system governance and resource modifications.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="relative w-full overflow-auto px-8 pb-8">
                                <table className="w-full text-sm text-left">
                                    <thead>
                                        <tr>
                                            <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Timestamp</th>
                                            <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center">Operation</th>
                                            <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Target</th>
                                            <th className="h-12 px-4 align-middle font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Metadata</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-12 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">No administrative records found</td>
                                            </tr>
                                        ) : (
                                            auditLogs.map((log) => (
                                                <tr key={log.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/50 group">
                                                    <td className="p-4 align-middle">
                                                        <span className="text-[10px] font-mono font-bold text-slate-400">
                                                            {new Date(log.created_at).toLocaleString('en-GB')}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 align-middle text-center">
                                                        <Badge className="bg-blue-50 text-blue-600 border-blue-100 rounded-lg font-black uppercase tracking-widest text-[9px] px-2">
                                                            {log.action}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-4 align-middle">
                                                        <span className="font-black text-slate-700 text-xs">{log.target}</span>
                                                    </td>
                                                    <td className="p-4 align-middle">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{log.details || "No secondary data"}</span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </Layout >
    );
}
