import { useState, useEffect } from "react"
import { useSearchParams, Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Ticket, Link as LinkIcon } from "lucide-react"
import { toast } from "sonner"
import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function Register() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        fullName: "",
        userType: "Student",
        token: searchParams.get("token") || "",
        regCode: searchParams.get("code") || ""
    });
    const [loading, setLoading] = useState(false);
    const [fetchingToken, setFetchingToken] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const fetchInvitation = async () => {
            const token = searchParams.get("token");
            if (!token) return;

            setFetchingToken(true);
            try {
                const res = await axios.get(`${API_URL}/api/auth/invitation-details?token=${token}`);
                setFormData(prev => ({
                    ...prev,
                    email: res.data.email,
                    token: token
                }));
            } catch (err) {
                console.error("Failed to fetch invitation details:", err);
                toast.error("Invalid or expired invitation link");
                setFormData(prev => ({ ...prev, token: "" }));
            } finally {
                setFetchingToken(false);
            }
        };

        fetchInvitation();
    }, [searchParams]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Registering with data:", formData.email);

        if (formData.password !== formData.confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (!formData.token && !formData.regCode) {
            toast.error("Missing invitation token or registration code");
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API_URL}/api/auth/register`, {
                email: formData.email,
                password: formData.password,
                full_name: formData.fullName,
                user_type: formData.userType,
                token: formData.token,
                reg_code: formData.regCode
            });
            toast.success("Account created successfully!");
            setSuccess(true);
            setTimeout(() => navigate("/login"), 3000);
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    if (fetchingToken) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-sm">
                    <CardHeader className="text-center">
                        <CardTitle className="animate-pulse">Verifying Invitation...</CardTitle>
                        <CardDescription>Securing your institutional access</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold">Register</CardTitle>
                    <CardDescription>
                        Join the A360 platform
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleRegister}>
                    <CardContent className="space-y-4">

                        {formData.token ? (
                            <div className="space-y-2 text-xs text-blue-400 bg-blue-500/10 p-3 rounded border border-blue-500/20">
                                <div className="flex items-center gap-2 mb-1">
                                    <LinkIcon className="h-3 w-3" />
                                    <p className="font-semibold uppercase text-[10px]">Invite Token Detected</p>
                                </div>
                                <p className="truncate font-mono opacity-80 mb-1">{formData.token}</p>
                                <p className="text-blue-200/60 italic">Your email has been locked to the invitation recipient.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="regCode" className="flex items-center gap-2">
                                    <Ticket className="h-4 w-4" /> Registration Code
                                </Label>
                                <Input
                                    id="regCode"
                                    placeholder="Enter seminar code (e.g. SEMINAR2024)"
                                    value={formData.regCode}
                                    disabled
                                    className="bg-muted text-muted-foreground"
                                />
                                <p className="text-[10px] text-muted-foreground italic">Required for registration. Cannot be changed.</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input
                                id="fullName"
                                placeholder="Enter your full name"
                                required
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                disabled={loading || success}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="userType">User Type</Label>
                            <select
                                id="userType"
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                required
                                value={formData.userType}
                                onChange={(e) => setFormData({ ...formData, userType: e.target.value })}
                                disabled={loading || success}
                            >
                                <option value="Student">Student</option>
                                <option value="Teacher/Professor">Teacher/Professor</option>
                                <option value="Anonymous">Anonymous</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="m@example.com"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                disabled={loading || success || !!formData.token}
                                className={(loading || success || !!formData.token) ? "bg-muted text-muted-foreground" : ""}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                disabled={loading || success}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm Password</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                required
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                disabled={loading || success}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button className="w-full" disabled={loading || success || (!formData.token && !formData.regCode)}>
                            {loading ? "Processing..." : success ? "Account Ready!" : "Create account"}
                        </Button>
                        <p className="text-sm text-center text-muted-foreground">
                            Already have an account?{" "}
                            <Link to="/login" className="text-primary hover:underline">
                                Login
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
