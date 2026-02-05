import React, { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Mail, CheckCircle2, ShieldQuestion } from "lucide-react"
import { AuthBackground } from "@/components/AuthBackground"
import { toast } from "sonner"
import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    React.useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (cooldown > 0) return;

        setLoading(true);
        try {
            await axios.post(`${API_URL}/api/auth/forgot-password`, { email });
            setSubmitted(true);
            setCooldown(120); // 2 minute cooldown
            toast.success("Reset instructions sent to your email");
        } catch (err: any) {
            // Check for backend cooldown
            if (err.response?.status === 429) {
                const remaining = err.response.data.remaining || 120;
                setCooldown(Math.ceil(remaining));
            }
            toast.error(err.response?.data?.error || "Failed to process request");
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-sm text-center">
                    <CardHeader>
                        <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="h-6 w-6 text-green-500" />
                        </div>
                        <CardTitle className="text-2xl font-bold">Email Sent</CardTitle>
                        <CardDescription>
                            We've sent password reset instructions to <strong>{email}</strong>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            If you don't see the email, please check your spam folder.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <Link to="/login" className="w-full">
                            <Button variant="outline" className="w-full">Return to Login</Button>
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
                    <Link to="/login" className="absolute top-6 left-6 text-xs text-slate-400 hover:text-blue-500 flex items-center gap-1 transition-colors font-black uppercase tracking-widest">
                        <ArrowLeft className="h-3 w-3" /> Back
                    </Link>

                    <div className="flex flex-col items-center mb-2 pt-4">
                        <div className="w-16 h-16 bg-blue-50 rounded-[1.5rem] flex items-center justify-center border-2 border-white shadow-sm ring-4 ring-blue-50/50 mb-3 transition-transform hover:scale-105 duration-300">
                            <ShieldQuestion className="h-8 w-8 text-blue-500" />
                        </div>
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-black tracking-tight text-slate-800 uppercase">
                            Key <span className="text-blue-500">Recovery</span>
                        </CardTitle>
                        <h1 className="text-blue-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-1">A360 Workshop Platform</h1>
                    </div>
                </CardHeader>

                <form onSubmit={handleResetRequest}>
                    <CardContent className="space-y-6 px-8 pb-8">
                        <div className="space-y-3">
                            <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Work Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-4 h-4 w-4 text-slate-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="workshop@a360.co.th"
                                    required
                                    className="pl-12 h-12 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100/50 transition-all font-medium"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <Button
                            className="w-full h-12 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 mt-2"
                            disabled={loading || cooldown > 0}
                        >
                            {loading ? "Processing..." : cooldown > 0 ? `Retry in ${cooldown}s` : "Submit Request"}
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
