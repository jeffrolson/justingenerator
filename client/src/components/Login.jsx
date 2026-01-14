import { useAuth } from '../contexts/AuthContext';
import { Sparkles, ArrowRight } from 'lucide-react';

export function Login() {
    const { login } = useAuth();

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-fade-in-up relative">
            {/* Decorative background blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl -z-10 pointer-events-none"></div>

            <div className="glass-card max-w-md w-full text-center space-y-10 p-12 relative overflow-hidden backdrop-blur-xl border border-white/10">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Sparkles className="w-24 h-24 text-white" />
                </div>

                <div className="space-y-6 relative z-10">
                    <div className="inline-flex p-3 rounded-2xl bg-violet-600/20 mb-2 ring-1 ring-violet-500/30">
                        <Sparkles className="w-8 h-8 text-violet-300" />
                    </div>

                    <h1 className="text-5xl font-bold text-white tracking-tight drop-shadow-md">
                        Justin <span className="text-violet-400 drop-shadow-lg">Generator</span>
                    </h1>

                    <p className="text-slate-300 text-lg leading-relaxed">
                        Transform your moments into <span className="text-violet-200 font-medium">digital masterpieces</span> using next-gen AI.
                    </p>
                </div>

                <div className="space-y-4 pt-2">
                    <button
                        onClick={login}
                        className="btn-primary w-full py-4 text-lg font-bold rounded-xl shadow-xl shadow-violet-900/20 flex items-center justify-center gap-3 group"
                    >
                        <span>Start Creating</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <p className="text-sm text-slate-500 font-medium">
                        No credit card required to enable.
                    </p>
                </div>
            </div>
        </div>
    );
}
