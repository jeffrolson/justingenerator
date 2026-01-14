import { useState, useEffect } from 'react';
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
    const [showFullSize, setShowFullSize] = useState(false);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [previewImage, setPreviewImage] = useState(null);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

    const fetchHistory = async () => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${apiUrl}/api/generations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setHistory(data.generations || []);
            }
        } catch (e) {
            console.error("Failed to fetch history:", e);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [user]);

    const credits = parseInt(backendUser?.credits?.integerValue || '0');
    console.log("Dashboard Credits:", credits, "Type:", typeof credits);

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

            // Use apiUrl defined above

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
            const newImageUrl = `${apiUrl}${data.imageUrl}`;
            setResult(newImageUrl);

            // Add to history locally for immediate feedback
            setHistory(prev => [{
                id: data.genId,
                prompt: prompt || 'A futuristic cyberpunk portrait',
                imageUrl: data.imageUrl,
                createdAt: new Date().toISOString()
            }, ...prev]);

            // Ideally we should update credits in context, but for now a refresh or polling implies it updates eventually. 
            // Force reload of user sync? Context handles it on page load, maybe we trigger a refetch? 
            // Simplified: We assume user will refresh or next action will sync.

        } catch (e) {
            setError(e.message);
        } finally {
            setGenerating(false);
        }
    };

    const [activeJob, setActiveJob] = useState(null);

    // Placeholder for Firestore instance if you were using the SDK directly, 
    // but since we want "real-time" and this is a serverless demo, 
    // we'll implement a polling mechanism or handle onSnapshot if the user has firebase/firestore installed.
    // The previous implementation used Firebase SDK in contexts/AuthContext.

    useEffect(() => {
        if (!user) return;

        // In a real app we'd use onSnapshot, here we pollute a bit to check for active jobs
        const interval = setInterval(async () => {
            if (activeJob && activeJob.status === 'completed') {
                clearInterval(interval);
                fetchHistory();
                return;
            }

            try {
                const token = await user.getIdToken();
                // We'll add an endpoint to get active jobs or just use query
                // For simplicity, let's assume we can fetch history and see the latest job status
                // Or we can add a simple /api/jobs/active endpoint
                const res = await fetch(`${apiUrl}/api/jobs/active`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.job) {
                        setActiveJob(data.job);
                        if (data.job.status === 'completed') fetchHistory();
                    } else {
                        setActiveJob(null);
                    }
                }
            } catch (e) {
                console.error("Job check failed:", e);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [user, activeJob?.status]);

    const handleBuyCredits = async () => {
        if (!file) {
            alert("Please select a photo first to generate a batch!");
            return;
        }

        setGenerating(true);
        try {
            const token = await user.getIdToken();
            const formData = new FormData();
            formData.append('image', file);
            formData.append('prompt', prompt || 'A stylized portrait');

            // 1. Pre-upload image so we have a path for the webhook
            const uploadRes = await fetch(`${apiUrl}/api/upload-only`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!uploadRes.ok) throw new Error("Upload failed");
            const { path } = await uploadRes.json();

            // 2. Start Checkout
            const stripeRes = await fetch(`${apiUrl}/api/stripe/checkout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    priceId: 'price_1QfV3vLpG8S7zK7v8L9j2A1B', // Example ID
                    originalPath: path,
                    prompt: prompt || 'A stylized portrait'
                })
            });

            if (!stripeRes.ok) throw new Error("Checkout failed");
            const { url } = await stripeRes.json();
            window.location.href = url;

        } catch (e) {
            setError(e.message);
        } finally {
            setGenerating(false);
        }
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

                        <div className="flex items-center gap-4 py-2">
                            <div className="h-px bg-white/10 flex-grow"></div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">or</span>
                            <div className="h-px bg-white/10 flex-grow"></div>
                        </div>

                        <button
                            onClick={handleBuyCredits}
                            disabled={generating || !file}
                            className="w-full py-4 rounded-xl border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 font-bold transition-all flex items-center justify-center gap-2 group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer p-1"></div>
                            <Package className="w-5 h-5" />
                            Generate Pro Batch (10 Images)
                        </button>
                        <p className="text-center text-[10px] text-slate-500 font-medium">✨ Pro Batch uses advanced styles and saves to your collection</p>
                    </div>
                </section>

                {/* Result Section/Active Job Section */}
                <section className="glass-card p-1 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden">
                    {/* Background decor */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50 pointer-events-none"></div>

                    {activeJob ? (
                        <div className="w-full p-8 space-y-8 relative z-10 animate-fade-in">
                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <div className="space-y-1">
                                        <h4 className="text-xl font-bold text-white flex items-center gap-2">
                                            <span className="w-2 h-2 bg-violet-500 rounded-full animate-ping"></span>
                                            Batch Generation
                                        </h4>
                                        <p className="text-slate-400 text-sm">Processing your masterpiece collection</p>
                                    </div>
                                    <span className="text-violet-400 font-bold text-2xl">
                                        {Math.round((activeJob.completed / activeJob.total) * 100)}%
                                    </span>
                                </div>

                                <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
                                    <div
                                        className="h-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-600 bg-[length:200%_100%] animate-shimmer rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${(activeJob.completed / activeJob.total) * 100}%` }}
                                    ></div>
                                </div>
                                <p className="text-center text-xs text-slate-500 font-medium tracking-widest uppercase">
                                    {activeJob.completed} of {activeJob.total} images completed
                                </p>
                            </div>

                            {activeJob.results && activeJob.results.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-in-up">
                                    {activeJob.results.slice().reverse().map((url, i) => (
                                        <div key={i} className="aspect-square rounded-lg overflow-hidden border border-white/10 glass shadow-2xl relative group">
                                            <img src={`${apiUrl}${url}`} alt="Result" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        </div>
                                    ))}
                                    {[...Array(activeJob.total - activeJob.results.length)].map((_, i) => (
                                        <div key={`blank-${i}`} className="aspect-square rounded-lg bg-white/5 border border-white/5 animate-pulse flex items-center justify-center">
                                            <ImageIcon className="w-6 h-6 text-white/10" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : generating ? (
                        <div className="text-center space-y-8 relative z-10 animate-fade-in-up">
                            <div className="cyber-loader mx-auto"></div>
                            <div className="space-y-2">
                                <p className="text-white font-bold text-xl tracking-wide">Dreaming...</p>
                                <p className="text-violet-300 text-sm animate-pulse">Consulting the neural network</p>
                            </div>
                        </div>
                    ) : result ? (
                        <div className="w-full h-full max-h-[600px] flex items-center justify-center relative group animate-fade-in-up rounded-2xl overflow-hidden cursor-zoom-in" onClick={() => { setPreviewImage(result); setShowFullSize(true); }}>
                            <img
                                src={result}
                                alt="Generated"
                                className="max-w-full max-h-full object-contain bg-black/50 backdrop-blur-sm transition-transform duration-500 group-hover:scale-[1.02]"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                                <Plus className="w-12 h-12 text-white/80" />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300 md:translate-y-0" onClick={e => e.stopPropagation()}>
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

            {/* History Feed Section */}
            <section className="mt-16 space-y-8 pb-12">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/5 rounded-lg border border-white/10 shadow-inner">
                            <ImageIcon className="w-5 h-5 text-violet-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white tracking-tight">Your Gallery</h3>
                    </div>
                    {history.length > 0 && (
                        <span className="text-xs font-medium text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                            {history.length} Generations
                        </span>
                    )}
                </div>

                {loadingHistory ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="aspect-square bg-white/5 rounded-xl animate-pulse border border-white/5"></div>
                        ))}
                    </div>
                ) : history.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fade-in">
                        {history.map((item) => (
                            <div
                                key={item.id}
                                className="group relative aspect-square glass-card p-1 cursor-pointer overflow-hidden rounded-xl border-white/5 hover:border-violet-500/30"
                                onClick={() => {
                                    setPreviewImage(`${apiUrl}${item.imageUrl}`);
                                    setShowFullSize(true);
                                }}
                            >
                                <img
                                    src={`${apiUrl}${item.imageUrl}`}
                                    alt={item.prompt}
                                    className="w-full h-full object-cover rounded-lg transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <div className="absolute bottom-2 left-2 right-2">
                                        <p className="text-[10px] text-white/90 font-medium line-clamp-2 leading-tight">
                                            {item.prompt}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 glass-card bg-white/[0.01] border-dashed border-white/10">
                        <p className="text-slate-500 font-medium">Your artistic journey starts with your first generation.</p>
                    </div>
                )}
            </section>

            {/* Full Size Modal */}
            {showFullSize && previewImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-12 animate-fade-in"
                    onClick={() => setShowFullSize(false)}
                >
                    <button
                        className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10 z-[110]"
                        onClick={() => setShowFullSize(false)}
                    >
                        <Plus className="w-8 h-8 rotate-45" />
                    </button>
                    <div className="relative max-w-full max-h-full flex items-center justify-center animate-scale-in">
                        <img
                            src={previewImage}
                            alt="Full size"
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        />
                        <a
                            href={previewImage}
                            download="generated.png"
                            onClick={e => e.stopPropagation()}
                            className="absolute bottom-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white p-3 rounded-full transition-all border border-white/20 hover:scale-110 shadow-xl"
                            title="Download"
                        >
                            <Download className="w-6 h-6" />
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
