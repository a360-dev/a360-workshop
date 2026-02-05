import React, { useState } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Lock, KeyRound, Key } from "lucide-react"
import { AuthBackground } from "@/components/AuthBackground"
import { toast } from "sonner"
import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (!token) {
            toast.error("Invalid reset link");
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API_URL}/api/auth/reset-password`, {
                token,
                password
            });
            toast.success("Password updated successfully");
            setTimeout(() => navigate("/login"), 2000);
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to reset password");
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-[#F0F9FF] relative flex items-center justify-center p-4 overflow-hidden font-sans">
                <AuthBackground />
                <Card className="w-full max-w-sm bg-white/90 backdrop-blur-3xl border-destructive/20 shadow-2xl relative z-10 rounded-[3rem] border-2">
                    <CardHeader className="text-center pt-12">
                        <div className="mx-auto w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center border-2 border-white shadow-sm mb-4">
                            <ShieldCheck className="h-8 w-8 text-red-500" />
                        </div>
                        <CardTitle className="text-2xl font-black text-red-600 uppercase tracking-tighter">Access Denied</CardTitle>
                        <CardDescription className="text-slate-500 font-medium">
                            This security token is missing or malformed.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="pb-12 px-12">
                        <Link to="/login" className="w-full">
                            <Button variant="outline" className="w-full h-12 rounded-2xl border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[10px]">Return to Login</Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F0F9FF] relative flex items-center justify-center p-4 overflow-hidden font-sans">
            <AuthBackground />

            <Card className="w-full max-w-sm bg-white/90 backdrop-blur-3xl border-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.08)] relative z-10 animate-in fade-in zoom-in-95 duration-700 rounded-[3rem] border-2">
                <CardHeader className="text-center space-y-2 pb-6 pt-10">
                    <div className="flex flex-col items-center mb-2">
                        <div className="w-16 h-16 bg-blue-50 rounded-[1.5rem] flex items-center justify-center border-2 border-white shadow-sm ring-4 ring-blue-50/50 mb-3 transition-transform hover:scale-105 duration-300">
                            <Key className="h-8 w-8 text-blue-500" />
                        </div>
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-black tracking-tight text-slate-800 uppercase">
                            Secure <span className="text-blue-500">Key Update</span>
                        </CardTitle>
                        <h1 className="text-blue-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-1">A360 Workshop Platform</h1>
                    </div>
                </CardHeader>

                <form onSubmit={handleReset}>
                    <CardContent className="space-y-5 px-8 pb-8">
                        <div className="space-y-2">
                            <Label htmlFor="password" title="New Security Key" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">New Security Key</Label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-4 h-4 w-4 text-slate-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    className="pl-12 h-12 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100/50 transition-all font-medium"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" title="Verify New Key" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Verify New Key</Label>
                            <div className="relative">
                                <KeyRound className="absolute left-4 top-4 h-4 w-4 text-slate-400" />
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    required
                                    className="pl-12 h-12 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100/50 transition-all font-medium"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <Button
                            className="w-full h-12 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 mt-4"
                            disabled={loading}
                        >
                            {loading ? "Updating..." : "Update Security Key"}
                        </Button>
                    </CardContent>
                </form>

                <CardFooter className="flex flex-col gap-6 bg-blue-50/30 py-6 border-t border-slate-50 rounded-b-[3rem]">
                    <p className="text-[10px] text-center text-slate-300 font-black uppercase tracking-widest leading-relaxed px-8">
                        Authorized Workshop Success<br />
                        <span className="opacity-50">© {new Date().getFullYear()} A360 Co.,ltd</span>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
