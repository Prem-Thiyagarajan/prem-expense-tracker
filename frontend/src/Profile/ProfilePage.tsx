// File: src/Profile/ProfilePage.tsx
import React, { useState, useEffect } from 'react';
import { getMyProfile, changePassword, setSecurityQuestion } from '../api/apiClient';
import type { User } from '../types';
import { KeyRound, Eye, EyeOff, ShieldQuestion } from 'lucide-react';
import toast from 'react-hot-toast';
import PasswordStrength from '../auth/PasswordStrength';

const isPasswordStrong = (p: string) =>
    p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[\W_]/.test(p);

const inputClass = "w-full bg-bg border border-line rounded-chip px-3.5 py-3 font-body text-sm text-ink placeholder:text-faint outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink transition-colors";
const microLabel = "font-body font-semibold text-[9.5px] uppercase tracking-[0.14em] text-muted mb-1.5 block";
const eyeButtonClass = "absolute inset-y-0 right-0 flex items-center px-3.5 text-muted hover:text-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink rounded-r-chip transition-colors";
const primaryButtonClass = "px-6 py-3 rounded-chip border-2 border-line font-heading font-extrabold text-sm text-[#1E1B16] shadow-card hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink transition-all duration-press disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const ProfilePage: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNew, setConfirmNew] = useState('');
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Security question
    const SECURITY_QUESTIONS = [
        'What was the name of your first pet?',
        "What is your mother's maiden name?",
        'What city were you born in?',
        'What was the name of your first school?',
    ];
    const [sqQuestion, setSqQuestion] = useState(SECURITY_QUESTIONS[0]);
    const [sqAnswer, setSqAnswer] = useState('');
    const [sqPassword, setSqPassword] = useState('');
    const [isSavingSQ, setIsSavingSQ] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setIsLoading(true);
                const profileData = await getMyProfile();
                setUser(profileData);
            } catch (err) {
                setError('Failed to load your profile. Please try logging in again.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isPasswordStrong(newPassword)) {
            toast.error('New password does not meet security requirements.');
            return;
        }
        if (newPassword !== confirmNew) {
            toast.error('New passwords do not match.');
            return;
        }
        if (oldPassword === newPassword) {
            toast.error('New password must be different from the current password.');
            return;
        }
        setIsSaving(true);
        try {
            await changePassword({ old_password: oldPassword, new_password: newPassword });
            toast.success('Password changed successfully!');
            setOldPassword('');
            setNewPassword('');
            setConfirmNew('');
        } catch (err: any) {
            const msg = err.response?.data?.detail || 'Failed to change password.';
            toast.error(msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSetSecurityQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sqAnswer.trim()) {
            toast.error('Please enter an answer.');
            return;
        }
        setIsSavingSQ(true);
        try {
            await setSecurityQuestion({ current_password: sqPassword, question: sqQuestion, answer: sqAnswer });
            toast.success('Security question saved!');
            setSqAnswer('');
            setSqPassword('');
            setUser(prev => prev ? { ...prev, has_security_question: true } : prev);
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to save security question.');
        } finally {
            setIsSavingSQ(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center font-body font-semibold text-ink">Loading Profile...</div>;
    if (error) return <div className="m-6 p-4 text-center font-body text-semantic-red bg-candy-coral/20 border-2 border-line rounded-card">{error}</div>;
    if (!user) return <div className="p-8 text-center font-body text-muted">Could not find user data.</div>;

    return (
        <div className="max-w-content mx-auto p-4 md:p-6 lg:p-8 space-y-6">
            <header>
                <h1 className="font-heading text-3xl font-extrabold text-ink tracking-[-0.02em]">Your profile</h1>
                <p className="font-body text-sm text-muted mt-1">Account details and security.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-[18px] items-start">
                <div className="flex flex-col gap-[18px]">
                    {/* Identity card */}
                    <div className="bg-candy-pink border-2 border-line rounded-cardLg shadow-card p-6 text-[#1E1B16]">
                        <div className="flex items-center gap-4">
                            <span className="w-[58px] h-[58px] rounded-full bg-white border-2 border-line flex items-center justify-center font-heading font-extrabold text-xl shrink-0">
                                {user.username.charAt(0).toUpperCase()}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="font-heading font-extrabold text-xl truncate">{user.username}</p>
                                <p className="font-mono text-xs mt-1 truncate">{user.email}</p>
                            </div>
                        </div>
                    </div>

                    {/* Account Info */}
                    <div className="bg-card border-2 border-line rounded-cardLg p-5">
                        <h2 className="font-heading font-extrabold text-base text-ink border-b-2 border-line pb-3">Account details</h2>
                        <div className="flex flex-col gap-3.5 mt-4">
                            <div>
                                <span className={microLabel}>Username</span>
                                <p className="bg-hair border border-line rounded-chip px-3.5 py-3 font-heading font-bold text-sm text-ink">{user.username}</p>
                            </div>
                            <div>
                                <span className={microLabel}>Email address</span>
                                <p className="bg-hair border border-line rounded-chip px-3.5 py-3 font-mono text-xs text-ink">{user.email}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-[18px]">
                    {/* Change Password */}
                    <div className="bg-card border-2 border-line rounded-cardLg p-5">
                        <h2 className="font-heading font-extrabold text-base text-ink border-b-2 border-line pb-3 flex items-center gap-2">
                            <KeyRound size={17} /> Change password
                        </h2>
                        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className={microLabel}>Current password</label>
                                    <div className="relative">
                                        <input
                                            type={showOld ? 'text' : 'password'}
                                            value={oldPassword}
                                            onChange={e => setOldPassword(e.target.value)}
                                            placeholder="Enter current password"
                                            className={`${inputClass} pr-11`}
                                            required
                                        />
                                        <button type="button" onClick={() => setShowOld(!showOld)} className={eyeButtonClass} aria-label="Toggle current password visibility">
                                            {showOld ? <EyeOff size={17} /> : <Eye size={17} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className={microLabel}>New password</label>
                                    <div className="relative">
                                        <input
                                            type={showNew ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder="Create a strong one"
                                            className={`${inputClass} pr-11`}
                                            required
                                        />
                                        <button type="button" onClick={() => setShowNew(!showNew)} className={eyeButtonClass} aria-label="Toggle new password visibility">
                                            {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <PasswordStrength password={newPassword} />

                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3.5 sm:items-end">
                                <div>
                                    <label className={microLabel}>Confirm new password</label>
                                    <div className="relative">
                                        <input
                                            type={showConfirm ? 'text' : 'password'}
                                            value={confirmNew}
                                            onChange={e => setConfirmNew(e.target.value)}
                                            placeholder="Repeat new password"
                                            className={`${inputClass} pr-11 ${confirmNew && newPassword !== confirmNew ? 'border-semantic-red' : ''}`}
                                            required
                                        />
                                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} className={eyeButtonClass} aria-label="Toggle confirm password visibility">
                                            {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                                        </button>
                                    </div>
                                    {confirmNew && newPassword !== confirmNew && (
                                        <p className="text-xs font-body text-semantic-red mt-1.5">Passwords do not match.</p>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className={`${primaryButtonClass} bg-candy-blue`}
                                >
                                    {isSaving ? 'Saving...' : 'Update password'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Security Question (password recovery) */}
                    <div className="bg-card border-2 border-line rounded-cardLg p-5">
                        <h2 className="font-heading font-extrabold text-base text-ink border-b-2 border-line pb-3 flex items-center gap-2">
                            <ShieldQuestion size={17} /> Security question
                        </h2>
                        <p className="text-sm font-body text-muted mt-3 leading-relaxed">
                            {user.has_security_question
                                ? 'A security question is set. You can update it below. This lets you reset your password if you forget it.'
                                : 'Set a security question so you can reset your password without email if you forget it.'}
                        </p>
                        <form onSubmit={handleSetSecurityQuestion} className="mt-4 space-y-3.5">
                            <div>
                                <label className={microLabel}>Question</label>
                                <select
                                    value={sqQuestion}
                                    onChange={e => setSqQuestion(e.target.value)}
                                    className={`${inputClass} cursor-pointer`}
                                >
                                    {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className={microLabel}>Answer</label>
                                    <input
                                        type="text"
                                        value={sqAnswer}
                                        onChange={e => setSqAnswer(e.target.value)}
                                        placeholder="Case-insensitive"
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={microLabel}>Current password</label>
                                    <input
                                        type="password"
                                        value={sqPassword}
                                        onChange={e => setSqPassword(e.target.value)}
                                        placeholder="Confirm it's you"
                                        className={inputClass}
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isSavingSQ}
                                className={`${primaryButtonClass} bg-candy-coral`}
                            >
                                {isSavingSQ ? 'Saving...' : (user.has_security_question ? 'Update security question' : 'Save security question')}
                            </button>
                        </form>
                    </div>

                    <p className="text-center text-xs font-body text-muted">To delete your account, please go to the Settings page.</p>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
