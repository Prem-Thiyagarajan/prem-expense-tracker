// File: src/auth/RegisterPage.tsx
import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api/apiClient';
import toast from 'react-hot-toast';
import PasswordStrength from './PasswordStrength';
import registerImage from '../assets/register.png';
import { Eye, EyeOff } from 'lucide-react';

const isEmailValid = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isPasswordStrong = (password: string): boolean => {
    return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[\W_]/.test(password);
};

const inputClass = "w-full bg-bg border border-line rounded-chip px-3.5 py-3 mt-1.5 font-body text-sm text-ink placeholder:text-faint outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink transition-colors";
const primaryButtonClass = "w-full py-3 rounded-chip border-2 border-candyLine font-heading font-extrabold text-sm text-[#1E1B16] bg-candy-blue shadow-card hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink transition-all duration-press disabled:opacity-50 disabled:pointer-events-none";

const RegisterPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const emailError = useMemo(() => email && !isEmailValid(email) ? "Please enter a valid email address." : null, [email]);
    const passwordMatchError = useMemo(() => confirmPassword && password !== confirmPassword ? "Passwords do not match." : null, [password, confirmPassword]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) { toast.error("Please enter your name."); return; }
        if (emailError) { toast.error(emailError); return; }
        if (!isPasswordStrong(password)) { toast.error("Password does not meet all the security requirements."); return; }
        if (passwordMatchError) { toast.error(passwordMatchError); return; }

        setIsLoading(true);
        try {
            await register({ email, username, password });
            toast.success("Account created successfully! Please log in.", { id: 'register-success', duration: 4000 });
            navigate('/login');
        } catch (error: any) {
            const errorMessage = error.response?.data?.detail || "Registration failed. That username or email may already be taken.";
            toast.error(errorMessage, { id: 'register-error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex w-full min-h-screen bg-bg">
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-10">
                <div className="w-full max-w-md bg-card border-2 border-line rounded-cardLg p-8">
                    <h1 className="font-heading text-3xl font-extrabold text-ink tracking-[-0.02em] mb-2">Create an account</h1>
                    <p className="font-body text-sm text-muted mb-6">Join now to streamline your experience from day one.</p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="font-body font-semibold text-sm text-ink">Name</label>
                            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g., Steven Gerrard" className={inputClass} required />
                        </div>
                        <div>
                            <label className="font-body font-semibold text-sm text-ink">Email</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g., your@email.com" className={`${inputClass} ${emailError ? 'border-semantic-red' : ''}`} required />
                            {emailError && <p className="text-xs font-body text-semantic-red mt-1.5">{emailError}</p>}
                        </div>
                        <div>
                            <label className="font-body font-semibold text-sm text-ink">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Create a strong password"
                                    className={`${inputClass} pr-11`}
                                    required
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center px-3.5 text-muted hover:text-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink rounded-r-chip transition-colors" aria-label="Toggle password visibility">
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <PasswordStrength password={password} />
                        </div>
                        <div>
                            <label className="font-body font-semibold text-sm text-ink">Confirm Password</label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your password"
                                    className={`${inputClass} pr-11 ${passwordMatchError ? 'border-semantic-red' : ''}`}
                                    required
                                />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute inset-y-0 right-0 flex items-center px-3.5 text-muted hover:text-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink rounded-r-chip transition-colors" aria-label="Toggle confirm password visibility">
                                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {passwordMatchError && <p className="text-xs font-body text-semantic-red mt-1.5">{passwordMatchError}</p>}
                        </div>
                        <button type="submit" disabled={isLoading} className={primaryButtonClass}>
                            {isLoading ? 'Registering...' : 'Register'}
                        </button>
                    </form>
                    <p className="text-sm font-body text-center text-ink mt-6">
                        Already have an account? <Link to="/login" className="font-semibold text-link hover:underline">Sign In</Link>
                    </p>
                </div>
            </div>
            <div className="hidden lg:flex w-1/2 bg-candy-blue items-center justify-center p-12 rounded-l-cardLg">
                <img src={registerImage} alt="Register" className="max-w-full max-h-full rounded-card border-2 border-line shadow-card" />
            </div>
        </div>
    );
};
export default RegisterPage;
