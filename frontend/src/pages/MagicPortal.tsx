import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Loader2, BookOpen, Presentation } from 'lucide-react';
import { toast } from 'sonner';

export default function MagicPortal() {
    const [code, setCode] = useState(['', '', '', '']);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) value = value.slice(-1);
        const newCode = [...code];
        newCode[index] = value.toUpperCase();
        setCode(newCode);

        // Auto-focus next
        if (value && index < 3) {
            const nextInput = document.getElementById(`magic-input-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            const prevInput = document.getElementById(`magic-input-${index - 1}`);
            prevInput?.focus();
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const fullCode = code.join('');

        if (fullCode.length !== 4) {
            toast.error('Please enter the full 4-digit code');
            return;
        }

        setLoading(true);
        setTimeout(() => {
            navigate(`/magic/${fullCode}`);
        }, 800);
    };

    return (
        <div className="min-h-screen bg-[#F0F9FF] relative flex items-center justify-center p-4 overflow-hidden font-sans">
            {/* CSS Bokeh / Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200/30 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-sky-200/20 rounded-full blur-[150px]" />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-white rounded-full blur-[100px] opacity-60" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
            </div>

            <Card className="w-full max-w-md bg-white/90 backdrop-blur-3xl border-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.08)] relative z-10 animate-in fade-in zoom-in-95 duration-700 rounded-[3rem] border-2">
                <CardHeader className="text-center space-y-3 pb-8 pt-14">
                    <div className="mx-auto w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center border-2 border-white shadow-sm ring-8 ring-blue-50/50 mb-4 transition-transform hover:scale-105 duration-300">
                        <Presentation className="h-10 w-10 text-blue-500" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-4xl font-black tracking-tight text-slate-800">
                            A360 <span className="text-blue-500">Workshop</span>
                        </CardTitle>
                        <CardDescription className="text-blue-400 font-bold uppercase tracking-[0.3em] text-[11px]">
                            Spatial Creation Gateway
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="px-12 pb-12">
                    <form onSubmit={handleSubmit} className="space-y-12">
                        <div className="flex justify-center gap-4">
                            {code.map((char, idx) => (
                                <input
                                    key={idx}
                                    id={`magic-input-${idx}`}
                                    type="text"
                                    maxLength={1}
                                    value={char}
                                    onChange={(e) => handleChange(idx, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(idx, e)}
                                    className="w-16 h-20 text-center text-4xl font-black bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-blue-400 focus:bg-white focus:ring-8 focus:ring-blue-100/50 outline-none transition-all text-slate-800 placeholder:text-slate-200 uppercase shadow-soft"
                                    autoComplete="off"
                                    disabled={loading}
                                    autoFocus={idx === 0}
                                />
                            ))}
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-16 text-sm font-black uppercase tracking-[0.2em] gap-4 shadow-2xl shadow-blue-200 rounded-[2rem] transition-all hover:scale-[1.02] active:scale-95 bg-blue-500 hover:bg-blue-600 text-white border-b-4 border-blue-700"
                            disabled={loading || code.some(c => !c)}
                        >
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <>
                                    Enter Space
                                    <ArrowRight className="h-6 w-6" />
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex flex-col gap-6 bg-blue-50/30 py-8 border-t border-slate-50 rounded-b-[3rem]">
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-[10px] font-medium">
                        <BookOpen className="h-3.5 w-3.5 opacity-60" />
                        <span>Ready for your next discovery?</span>
                    </div>
                    <Button
                        variant="link"
                        size="sm"
                        className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 transition-colors"
                        onClick={() => navigate('/login')}
                    >
                        Workshop Login
                    </Button>
                    <p className="text-[9px] text-center text-slate-300 font-black uppercase tracking-widest opacity-50 mt-2">
                        © {new Date().getFullYear()} A360 Co.,ltd
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
