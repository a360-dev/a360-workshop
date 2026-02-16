import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import Login from './pages/Login';
import Register from './pages/Register';
import Editor from './pages/Editor';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Admin from './pages/Admin';
import Projects from './pages/Projects';
import Viewer from './pages/Viewer';
import AllProjects from './pages/AllProjects';
import MagicPortal from './pages/MagicPortal';
import { toast } from 'sonner';
import axios from 'axios';

interface GuardProps {
    children: React.ReactNode;
}

const ProtectedRoute = ({ children }: GuardProps) => {
    const token = localStorage.getItem('token');
    if (!token) return <Navigate to="/login" replace />;
    return <>{children}</>;
};

const AdminRoute = ({ children }: GuardProps) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.is_admin) return <Navigate to="/projects" replace />;
    return <ProtectedRoute>{children}</ProtectedRoute>;
};

const UserRoute = ({ children }: GuardProps) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.is_admin) return <Navigate to="/admin" replace />;
    return <ProtectedRoute>{children}</ProtectedRoute>;
};

const MagicRedirect = () => {
    const { code } = useParams();
    const [target, setTarget] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

    useEffect(() => {
        const resolveCode = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/magic/${code}`);
                setTarget(res.data.id);
            } catch (err) {
                toast.error("Invalid or expired Magic Code");
                setError(true);
            }
        };
        resolveCode();
    }, [code]);

    if (error) return <Navigate to="/login" replace />;
    if (target) return <Navigate to={`/view/${target}`} replace />;

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 shadow-xl shadow-blue-500/20"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Resolving Portal...</span>
        </div>
    );
};

function App() {
    useEffect(() => {
        console.log("%c--- A360 CORE V7.2 DEPLOYED ---", "background: #00ff00; color: #000; font-size: 20px; font-weight: bold; padding: 10px;");
        console.log("A360 Platform Version: 1.0.8-WS-V7.2");

        // Inactivity Timeout Logic: 15 minutes (900,000 ms)
        const TIMEOUT = 15 * 60 * 1000;
        let inactivityTimer: NodeJS.Timeout;

        const resetTimer = () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                const token = localStorage.getItem('token');
                if (token) {
                    console.warn("Session expired due to inactivity. Logging out.");
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/login?reason=inactivity';
                }
            }, TIMEOUT);
        };

        // Events to monitor for activity
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

        events.forEach(event => {
            window.addEventListener(event, resetTimer);
        });

        resetTimer(); // Initialize timer

        return () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            events.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, []);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAuthenticated = !!localStorage.getItem('token');

    return (
        <Router>
            <Toaster position="top-center" richColors />
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Role-Based Protected Routes */}
                <Route path="/projects" element={<UserRoute><Projects /></UserRoute>} />
                <Route path="/dashboard" element={<Navigate to="/projects" replace />} />

                <Route path="/all-projects" element={<AdminRoute><AllProjects /></AdminRoute>} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />

                {/* Shared Accessible Routes (Access Control handled within components) */}
                <Route path="/view/:id" element={<Viewer />} />
                <Route path="/editor/:id" element={<ProtectedRoute><Editor /></ProtectedRoute>} />

                {/* Public / Semi-Public */}
                <Route path="/magic" element={<MagicPortal />} />
                <Route path="/magic/:code" element={<MagicRedirect />} />

                <Route path="/" element={
                    !isAuthenticated ? <Login /> : (user.is_admin ? <Navigate to="/admin" replace /> : <Navigate to="/projects" replace />)
                } />
            </Routes>
        </Router>
    );
}

export default App;
