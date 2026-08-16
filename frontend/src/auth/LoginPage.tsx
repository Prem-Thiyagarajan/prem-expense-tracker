// File: src/auth/LoginPage.tsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, getRecoveryQuestion, resetPasswordWithAnswer } from '../api/apiClient';
import toast from 'react-hot-toast';
import loginImage from '../assets/login.jpg';
import { Eye, EyeOff, X } from 'lucide-react';
import PasswordStrength from './PasswordStrength';

const isPasswordStrong = (p: string) =>
    p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[\W_]/.test(p);

const inputClass = "w-full bg-bg border border-line rounded-chip px-3.5 py-3 mt-1.5 font-body text-sm text-ink placeholder:text-faint outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink transition-colors";
const primaryButtonClass = "w-full py-3 rounded-chip border-2 border-line font-heading font-extrabold text-sm text-[#1E1B16] bg-candy-blue shadow-card hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink transition-all duration-press disabled:opacity-50 disabled:pointer-events-none";

const LoginPage: React.FC = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);

    // Recovery modal state
    const [recIdentifier, setRecIdentifier] = useState('');
    const [recQuestion, setRecQuestion] = useState('');
    const [recAnswer, setRecAnswer] = useState('');
    const [recNewPassword, setRecNewPassword] = useState('');
    const [recBusy, setRecBusy] = useState(false);

    const navigate = useNavigate();

    const closeForgot = () => {
        setShowForgotModal(false);
        setRecIdentifier(''); setRecQuestion(''); setRecAnswer(''); setRecNewPassword('');
    };

    const handleFetchQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        setRecBusy(true);
        try {
            const { question } = await getRecoveryQuestion(recIdentifier);
            setRecQuestion(question);
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Could not start recovery. Try again.');
        } finally {
            setRecBusy(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isPasswordStrong(recNewPassword)) {
            toast.error('New password does not meet security requirements.');
            return;
        }
        setRecBusy(true);
        try {
            await resetPasswordWithAnswer({ identifier: recIdentifier, answer: recAnswer, new_password: recNewPassword });
            toast.success('Password reset! You can now log in.');
            closeForgot();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Could not reset password.');
        } finally {
            setRecBusy(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await login(identifier, password, rememberMe);
            toast.success("Login successful!");
            navigate('/dashboard', { replace: true });
        } catch (error: any) {
            if (error.response && error.response.status === 401) {
                toast.error("Incorrect username or password.");
            } else {
                toast.error("Login failed. Please check your connection and try again.");
            }
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex w-full min-h-screen bg-bg">
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-10">
                <div className="w-full max-w-sm bg-card border-2 border-line rounded-cardLg p-8">
                    <h1 className="font-heading text-3xl font-extrabold text-ink tracking-[-0.02em] mb-2">Welcome back</h1>
                    <p className="font-body text-sm text-muted mb-6">Enter your email or username to access your account.</p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="font-body font-semibold text-sm text-ink">Email or Username</label>
                            <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="yourname or your@email.com" className={inputClass} required />
                        </div>
                        <div>
                            <label className="font-body font-semibold text-sm text-ink">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Your password"
                                    className={`${inputClass} pr-11`}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center px-3.5 text-muted hover:text-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink rounded-r-chip transition-colors"
                                    aria-label="Toggle password visibility"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <label className="flex items-center gap-2 cursor-pointer select-none font-body text-ink">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={e => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 accent-candy-blue"
                                />
                                Remember Me
                                <span className="text-faint text-xs">(30 days)</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowForgotModal(true)}
                                className="font-body font-semibold text-link hover:underline focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink rounded-chip"
                            >
                                Forgot Password?
                            </button>
                        </div>
                        <button type="submit" disabled={isLoading} className={primaryButtonClass}>
                            {isLoading ? 'Logging In...' : 'Log In'}
                        </button>
                    </form>
                    <p className="text-sm font-body text-center text-ink mt-6">
                        Don't Have An Account? <Link to="/register" className="font-semibold text-link hover:underline">Register Now.</Link>
                    </p>
                </div>
            </div>

            <div className="hidden lg:flex w-1/2 bg-candy-blue items-center justify-center p-12 rounded-l-cardLg">
                <img src={loginImage} alt="Login" className="max-w-full max-h-full rounded-card border-2 border-line shadow-card" />
            </div>

            {/* Forgot Password Modal — security-question recovery */}
            {showForgotModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: "var(--scrim)" }}
                    onClick={closeForgot}
                >
                    <div
                        className="bg-card border-2 border-line rounded-cardLg shadow-sheet max-w-sm w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-heading font-extrabold text-lg text-ink">Reset Your Password</h2>
                            <button onClick={closeForgot} aria-label="Close" className="w-8 h-8 rounded-full border-2 border-line flex items-center justify-center hover:bg-hair transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {!recQuestion ? (
                            <form onSubmit={handleFetchQuestion} className="space-y-4">
                                <p className="text-sm font-body text-muted">
                                    Enter your email or username. If you've set a security question, we'll ask it next.
                                </p>
                                <div>
                                    <label className="font-body font-semibold text-sm text-ink">Email or Username</label>
                                    <input
                                        type="text"
                                        value={recIdentifier}
                                        onChange={e => setRecIdentifier(e.target.value)}
                                        placeholder="yourname or your@email.com"
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <button type="submit" disabled={recBusy} className={primaryButtonClass}>
                                    {recBusy ? 'Checking...' : 'Continue'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div>
                                    <label className="font-body font-semibold text-sm text-ink">Security Question</label>
                                    <p className="mt-1.5 text-sm font-body text-ink bg-hair border border-line rounded-chip p-3">{recQuestion}</p>
                                </div>
                                <div>
                                    <label className="font-body font-semibold text-sm text-ink">Your Answer</label>
                                    <input
                                        type="text"
                                        value={recAnswer}
                                        onChange={e => setRecAnswer(e.target.value)}
                                        placeholder="Answer to your security question"
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="font-body font-semibold text-sm text-ink">New Password</label>
                                    <input
                                        type="password"
                                        value={recNewPassword}
                                        onChange={e => setRecNewPassword(e.target.value)}
                                        placeholder="Create a new strong password"
                                        className={inputClass}
                                        required
                                    />
                                    <PasswordStrength password={recNewPassword} />
                                </div>
                                <button type="submit" disabled={recBusy} className={primaryButtonClass}>
                                    {recBusy ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
export default LoginPage;
