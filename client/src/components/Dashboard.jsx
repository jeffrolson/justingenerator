import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase'; // Need auth for getToken
import { Sparkles, Image as ImageIcon, Upload, Download, LogOut, Plus } from 'lucide-react';

export function Dashboard() {
    const { user, backendUser, logout } = useAuth();
    const [file, setFile] = useState(null);
    const [prompt, setPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const credits = backendUser?.credits?.integerValue || 0;

    const handleGenerate = async () => {
        if (!file) return;

        setGenerating(true);
        setError(null);
        setResult(null);

        try {
            const token = await user.getIdToken();
            const formData = new FormData();
            formData.append('image', file);
            formData.append('prompt', prompt || 'A futuristic cyberpunk portrait');

            // Use VITE_API_URL or default
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

            const res = await fetch(`${apiUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Generation failed');
            }

            const data = await res.json();
            setResult(`${apiUrl}${data.imageUrl}`);
            // Ideally we should update credits in context, but for now a refresh or polling implies it updates eventually. 
            // Force reload of user sync? Context handles it on page load, maybe we trigger a refetch? 
            // Simplified: We assume user will refresh or next action will sync.

        } catch (e) {
            setError(e.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleBuyCredits = async () => {
        // TODO: Call /api/stripe/checkout
        alert("Stripe integration coming next!");
    };

    return (
        <div className="w-full max-w-5xl space-y-8 animate-fade-in-up px-4 py-8">
            <header className="flex justify-between items-center glass-panel p-6 rounded-2xl">
                <div className="flex items-center gap-3">
                    <div className="bg-violet-600 p-2 rounded-lg shadow-lg shadow-violet-500/30">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Justin Generator</h2>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 bg-white/5 px-5 py-2.5 rounded-full border border-white/10">
                        <span className="text-violet-200 text-sm font-medium">Credits</span>
                        <div className="h-4 w-px bg-white/10"></div>
                        <span className="text-white font-bold text-lg">{credits}</span>
                        <button
                            onClick={handleBuyCredits}
                            className="ml-2 bg-violet-600 hover:bg-violet-500 text-white p-1 rounded-full transition-all hover:scale-105"
                            title="Add Credits"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={logout}
                        className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Input Section */}
                <section className="glass-card p-8 space-y-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none group-hover:bg-violet-600/20 transition-all duration-700"></div>

                    <div>
                        <h3 className="text-2xl font-bold text-white mb-2">Create Magic</h3>
                        <p className="text-slate-400 text-sm">Upload a photo and let AI transform it into art.</p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-violet-200 ml-1">Prompt</label>
                            <div className="relative">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe your vision (e.g., A cyberpunk warrior in neon rain...)"
                                    className="w-full glass-input rounded-xl px-4 py-3 text-white placeholder:text-slate-500 min-h-[100px] resize-none focus:ring-2 focus:ring-violet-500/50"
                                />
                                <Sparkles className="absolute bottom-3 right-3 w-5 h-5 text-violet-500/50 pointer-events-none" />
                            </div>
                        </div>

                        <div
                            className={`border-2 border-dashed border-white/10 rounded-2xl p-8 text-center transition-all duration-300 relative overflow-hidden ${file ? 'bg-violet-500/10 border-violet-500/30' : 'hover:bg-white/5 hover:border-violet-500/30'} cursor-pointer`}
                        >
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setFile(e.target.files[0])}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="space-y-4 pointer-events-none relative z-0 flex flex-col items-center justify-center">
                                <div className={`p-4 rounded-full bg-white/5 transition-transform duration-300 ${!file && 'group-hover:scale-110'}`}>
                                    {file ? <ImageIcon className="w-8 h-8 text-violet-300" /> : <Upload className="w-8 h-8 text-slate-400" />}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-white font-medium text-lg">
                                        {file ? file.name : "Upload Photo"}
                                    </p>
                                    <p className="text-slate-400 text-sm">
                                        {file ? "Click to change" : "Drag & drop or click to browse"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl text-sm flex items-center gap-2 animate-fade-in-up">
                                <span className="text-lg">⚠️</span>
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={generating || !file || credits < 1}
                            className={`btn-primary w-full py-4 text-lg font-bold rounded-xl shadow-lg relative overflow-hidden group ${generating || !file || credits < 1 ? 'opacity-70' : ''}`}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {generating ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        Generate (1 Credit)
                                    </>
                                )}
                            </span>
                        </button>
                    </div>
                </section>

                {/* Result Section */}
                <section className="glass-card p-1 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden">
                    {/* Background decor */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50 pointer-events-none"></div>

                    {generating ? (
                        <div className="text-center space-y-8 relative z-10 animate-fade-in-up">
                            <div className="cyber-loader mx-auto"></div>
                            <div className="space-y-2">
                                <p className="text-white font-bold text-xl tracking-wide">Dreaming...</p>
                                <p className="text-violet-300 text-sm animate-pulse">Consulting the neural network</p>
                            </div>
                        </div>
                    ) : result ? (
                        <div className="w-full h-full relative group animate-fade-in-up rounded-2xl overflow-hidden">
                            <img
                                src={result}
                                alt="Generated"
                                className="w-full h-full object-contain bg-black/50 backdrop-blur-sm"
                            />
                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300 md:translate-y-0">
                                <a
                                    href={result}
                                    download="generated.png"
                                    className="w-full bg-white text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-violet-50 transition-colors shadow-lg shadow-black/50"
                                >
                                    <Download className="w-5 h-5" />
                                    Download High-Res
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-600 space-y-4 relative z-10">
                            <div className="p-8 rounded-full bg-white/5 inline-flex backdrop-blur-xl border border-white/5 shimmer">
                                <ImageIcon className="w-16 h-16 opacity-30" />
                            </div>
                            <p className="text-slate-500 font-medium">Your masterpiece will appear here</p>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
