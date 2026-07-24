// File: src/Profile/ProfilePage.tsx
import React, { useState, useEffect } from 'react';
import { getMyProfile, changePassword, setSecurityQuestion } from '../api/apiClient';
import type { User } from '../types';
import { UserCircle, Mail, KeyRound, Eye, EyeOff, ShieldQuestion } from 'lucide-react';
import toast from 'react-hot-toast';
import PasswordStrength from '../auth/PasswordStrength';

const isPasswordStrong = (p: string) =>
    p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[\W_]/.test(p);

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

    if (isLoading) return <div className="p-8 text-center font-semibold">Loading Profile...</div>;
    if (error) return <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg">{error}</div>;
    if (!user) return <div className="p-8 text-center">Could not find user data.</div>;

    return (
        <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
            <header className="mb-2">
                <h1 className="text-3xl font-bold text-gray-800">Your Profile</h1>
                <p className="text-gray-500 mt-1">View your account details and manage your password.</p>
            </header>

            {/* Account Info */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-700 mb-4">Account Details</h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-600 flex items-center">
                            <UserCircle size={16} className="mr-2" /> Username
                        </label>
                        <p className="mt-1 text-lg text-gray-800 font-semibold bg-gray-50 p-3 rounded-md">{user.username}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600 flex items-center">
                            <Mail size={16} className="mr-2" /> Email Address
                        </label>
                        <p className="mt-1 text-lg text-gray-800 font-semibold bg-gray-50 p-3 rounded-md">{user.email}</p>
                    </div>
                </div>
            </div>

            {/* Change Password */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <KeyRound size={18} /> Change Password
                </h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="text-sm font-semibold">Current Password</label>
                        <div className="relative">
                            <input
                                type={showOld ? 'text' : 'password'}
                                value={oldPassword}
                                onChange={e => setOldPassword(e.target.value)}
                                placeholder="Enter your current password"
                                className="w-full p-3 mt-1 border rounded-lg pr-10"
                                required
                            />
                            <button type="button" onClick={() => setShowOld(!showOld)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700">
                                {showOld ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-semibold">New Password</label>
                        <div className="relative">
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="Create a new strong password"
                                className="w-full p-3 mt-1 border rounded-lg pr-10"
                                required
                            />
                            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700">
                                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <PasswordStrength password={newPassword} />
                    </div>
                    <div>
                        <label className="text-sm font-semibold">Confirm New Password</label>
                        <div className="relative">
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                value={confirmNew}
                                onChange={e => setConfirmNew(e.target.value)}
                                placeholder="Repeat your new password"
                                className={`w-full p-3 mt-1 border rounded-lg pr-10 ${confirmNew && newPassword !== confirmNew ? 'border-red-500' : ''}`}
                                required
                            />
                            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700">
                                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {confirmNew && newPassword !== confirmNew && (
                            <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
                    >
                        {isSaving ? 'Saving...' : 'Update Password'}
                    </button>
                </form>
            </div>

            {/* Security Question (password recovery) */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-700 mb-1 flex items-center gap-2">
                    <ShieldQuestion size={18} /> Security Question
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    {user.has_security_question
                        ? 'A security question is set. You can update it below. This lets you reset your password if you forget it.'
                        : 'Set a security question so you can reset your password without email if you forget it.'}
                </p>
                <form onSubmit={handleSetSecurityQuestion} className="space-y-4">
                    <div>
                        <label className="text-sm font-semibold">Question</label>
                        <select
                            value={sqQuestion}
                            onChange={e => setSqQuestion(e.target.value)}
                            className="w-full p-3 mt-1 border rounded-lg bg-white"
                        >
                            {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-semibold">Answer</label>
                        <input
                            type="text"
                            value={sqAnswer}
                            onChange={e => setSqAnswer(e.target.value)}
                            placeholder="Your answer (case-insensitive)"
                            className="w-full p-3 mt-1 border rounded-lg"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold">Current Password</label>
                        <input
                            type="password"
                            value={sqPassword}
                            onChange={e => setSqPassword(e.target.value)}
                            placeholder="Confirm with your current password"
                            className="w-full p-3 mt-1 border rounded-lg"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSavingSQ}
                        className="px-6 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
                    >
                        {isSavingSQ ? 'Saving...' : (user.has_security_question ? 'Update Security Question' : 'Save Security Question')}
                    </button>
                </form>
            </div>

            <div className="text-center text-sm text-gray-500">
                <p>To delete your account, please go to the Settings page.</p>
            </div>
        </div>
    );
};

export default ProfilePage;
