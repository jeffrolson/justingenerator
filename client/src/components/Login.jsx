import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, ArrowRight, Mail, Lock, User } from 'lucide-react';

export function Login() {
    const { login, loginWithEmail, register } = useAuth();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isSignUp) {
                if (!firstName || !lastName) {
                    throw new Error('Please enter both your first and last name.');
                }
                await register(email, password, firstName, lastName);
            } else {
                await loginWithEmail(email, password);
            }
        } catch (err) {
            setError(err.message || 'An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
        const handleGoogleLogin = async () => {
            try {
                setError('');
                await login();
            } catch (err) {
                console.error("Google Login Error:", err);
                setError(err.message || 'Failed to sign in with Google');
            }
        };

        return (


            <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-fade-in-up relative">
                {/* Decorative background blob */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl -z-10 pointer-events-none"></div>

                <div className="glass-card max-w-md w-full text-center space-y-8 p-10 relative overflow-hidden backdrop-blur-xl border border-white/10">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Sparkles className="w-20 h-20 text-white" />
                    </div>

                    <div className="space-y-4 relative z-10">
                        <div className="inline-flex p-3 rounded-2xl bg-violet-600/20 mb-2 ring-1 ring-violet-500/30">
                            <Sparkles className="w-8 h-8 text-violet-300" />
                        </div>

                        <h1 className="text-4xl font-bold text-white tracking-tight">
                            {isSignUp ? 'Join' : 'Welcome to'} <span className="text-violet-400">Justin Generator</span>
                        </h1>

                        <p className="text-slate-300 text-sm">
                            {isSignUp
                                ? 'Create an account to start generating AI masterpieces.'
                                : 'Transform your moments into digital masterpieces using next-gen AI.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-left">
                        {isSignUp && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">First Name</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-4 w-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                                            placeholder="Justin"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Last Name</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-4 w-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                                            placeholder="V"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-4 w-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                                    placeholder="name@example.com"
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        {error && (
                            <p className="text-red-400 text-xs font-medium ml-1 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-3 text-lg font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/5"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[#0f172a] px-3 text-slate-500 font-bold">Or continue with</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handleGoogleLogin}
                            className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium rounded-xl flex items-center justify-center gap-3 transition-all"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span>Google</span>
                        </button>

                        <button
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError('');
                            }}
                            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center w-full gap-2"
                        >
                            {isSignUp ? "Already have an account?" : "Don't have an account?"}
                            <span className="text-violet-400 font-bold underline underline-offset-4 decoration-violet-500/30">
                                {isSignUp ? 'Sign In' : 'Sign Up'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }
