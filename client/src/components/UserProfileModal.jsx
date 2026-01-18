import { X, User, Sun, Moon, Monitor, Plus, Share2, Settings, LogOut } from 'lucide-react';

export function UserProfileModal({ isOpen, onClose, user, backendUser, logout, theme, setTheme, credits }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose}></div>
            <div className="glass-panel w-full max-w-md rounded-3xl overflow-hidden relative animate-scale-in border border-white/10 shadow-2xl">
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-theme-bg-accent">
                    <h3 className="text-xl font-bold text-theme-text-primary flex items-center gap-2">
                        <User className="w-5 h-5 text-violet-400" />
                        User Profile
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {/* User Info */}
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-theme-bg-accent border border-theme-glass-border">
                        <div className="w-12 h-12 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-xl">
                            {user?.email?.[0].toUpperCase()}
                        </div>
                        <div className="flex-grow min-w-0">
                            <p className="text-theme-text-primary font-bold truncate">{user?.email}</p>
                            <p className="text-theme-text-secondary text-xs">Member since {new Date(backendUser?.createdAt?.timestampValue || Date.now()).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {/* Theme Selection */}
                    <div className="space-y-4">
                        <p className="text-xs font-bold text-theme-text-muted uppercase tracking-widest">Appearance</p>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setTheme('light')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${theme === 'light' ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20' : 'bg-theme-bg-accent border-theme-glass-border text-theme-text-secondary hover:border-theme-text-primary'}`}
                            >
                                <Sun className="w-5 h-5" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Light</span>
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20' : 'bg-theme-bg-accent border-theme-glass-border text-theme-text-secondary hover:border-theme-text-primary'}`}
                            >
                                <Moon className="w-5 h-5" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Dark</span>
                            </button>
                            <button
                                onClick={() => setTheme('system')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${theme === 'system' ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20' : 'bg-theme-bg-accent border-theme-glass-border text-theme-text-secondary hover:border-theme-text-primary'}`}
                            >
                                <Monitor className="w-5 h-5" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">System</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-theme-bg-accent border border-theme-glass-border">
                            <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Available Credits</p>
                            <p className="text-xl font-bold text-theme-text-primary">{credits}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-theme-bg-accent border border-theme-glass-border">
                            <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Account Role</p>
                            <p className="text-xl font-bold text-theme-text-primary capitalize">{backendUser?.role?.stringValue || 'user'}</p>
                        </div>
                    </div>
                    {/* Actions */}
                    <div className="space-y-3">
                        <p className="text-xs font-bold text-theme-text-muted uppercase tracking-widest">Quick Actions</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => window.location.href = '/pricing'}
                                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-lg shadow-violet-600/20 text-xs font-bold uppercase tracking-wider"
                            >
                                <Plus className="w-4 h-4" />
                                Add Credits
                            </button>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/?ref=${user?.uid}`);
                                    alert("Referral link copied to clipboard!");
                                }}
                                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-theme-bg-accent border border-theme-glass-border text-theme-text-primary hover:bg-theme-glass-bg transition-all text-xs font-bold uppercase tracking-wider"
                            >
                                <Share2 className="w-4 h-4 text-violet-500" />
                                Referral Link
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-theme-bg-accent border-t border-white/5 flex flex-col gap-3">
                    {backendUser?.role?.stringValue === 'admin' && (
                        <button
                            onClick={() => window.location.href = '/admin'}
                            className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20"
                        >
                            <Settings className="w-4 h-4" />
                            Admin Portal
                        </button>
                    )}
                    <button
                        onClick={logout}
                        className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
