import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Link } from "react-router-dom"
import { useState } from "react"
import { Presentation, Wand2, KeyRound, User, ArrowRight } from "lucide-react"
import { AuthBackground } from "@/components/AuthBackground"
import { toast } from "sonner"
import axios from "axios"

export default function Login() {
    const [email, setEmail] = useState("admin@example.com")
    const [password, setPassword] = useState("password123")
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/auth/login`, {
                email,
                password
            });
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));

            if (res.data.user.is_admin) {
                window.location.href = '/admin';
            } else {
                window.location.href = '/projects';
            }
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F0F9FF] relative flex items-center justify-center p-4 overflow-hidden font-sans">
            <AuthBackground />

            <Card className="w-full max-w-sm bg-white/90 backdrop-blur-3xl border-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.08)] relative z-10 animate-in fade-in zoom-in-95 duration-700 rounded-[3rem] border-2">
                <CardHeader className="text-center space-y-2 pb-6 pt-10">
                    <div className="flex flex-col items-center mb-2">
                        <div className="w-16 h-16 bg-blue-50 rounded-[1.5rem] flex items-center justify-center border-2 border-white shadow-sm ring-4 ring-blue-50/50 mb-3 transition-transform hover:scale-105 duration-300">
                            <Presentation className="h-8 w-8 text-blue-500" />
                        </div>
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-black tracking-tight text-slate-800">
                            A360 <span className="text-blue-500">Workshop</span>
                        </CardTitle>
                        <h1 className="text-blue-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-1">Spatial Creation Gateway</h1>
                    </div>
                    <CardDescription className="hidden">
                        Enter your credentials to manage space
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-8 pb-8">

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Professional Email</Label>
                            <div className="relative">
                                <User className="absolute left-4 top-4 h-4 w-4 text-slate-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="workshop@a360.co.th"
                                    className="h-12 pl-12 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100/50 transition-all font-medium"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Security Key</Label>
                                <Link to="/forgot-password" title="Recover Access?" className="text-[10px] text-blue-400 font-bold hover:text-blue-600 transition-colors">
                                    Recover Key?
                                </Link>
                            </div>
                            <div className="relative">
                                <KeyRound className="absolute left-4 top-4 h-4 w-4 text-slate-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className="h-12 pl-12 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-100/50 transition-all font-medium"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <Button
                        className="w-full h-14 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-200 transition-all hover:scale-[1.02] active:scale-95 mt-6 gap-3 border-b-4 border-blue-700"
                        disabled={loading}
                        onClick={handleLogin}
                    >
                        {loading ? "Authenticating..." : (
                            <>
                                Sign In
                                <ArrowRight className="h-5 w-5" />
                            </>
                        )}
                    </Button>

                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-100" />
                        </div>
                        <div className="relative flex justify-center text-[9px] uppercase tracking-[0.3em] font-black text-slate-300">
                            <span className="bg-white px-3">or access space</span>
                        </div>
                    </div>

                    <Link to="/magic" className="block">
                        <Button
                            variant="outline"
                            className="w-full h-12 gap-2 border-blue-100 bg-blue-50/30 hover:bg-blue-50 hover:border-blue-200 text-blue-500 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                        >
                            <Wand2 className="h-4 w-4" /> Use Magic Code
                        </Button>
                    </Link>
                </CardContent>
                <CardFooter className="flex flex-col gap-6 bg-blue-50/30 py-6 border-t border-slate-50 rounded-b-[3rem]">
                    <p className="text-[10px] text-center text-slate-300 font-black uppercase tracking-widest leading-relaxed px-8">
                        Authorized Workshop Access<br />
                        <span className="opacity-50">© {new Date().getFullYear()} A360 Co.,ltd</span>
                    </p>
                </CardFooter>
            </Card>

            {/* Footer Institutional Tag */}
            <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none">
                <div className="flex items-center justify-center gap-4 text-[11px] font-black uppercase tracking-[0.5em] text-blue-200 opacity-60">
                    <div className="w-12 h-px bg-blue-100" />
                    A360 WORKSHOP ECOSYSTEM
                    <div className="w-12 h-px bg-blue-100" />
                </div>
            </div>
        </div>
    );
}
