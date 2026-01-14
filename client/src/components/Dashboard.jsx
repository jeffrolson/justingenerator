import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase'; // Need auth for getToken
import { getImageUrl } from '../lib/url';
import {
    Sparkles,
    Image as ImageIcon,
    Upload,
    Download,
    LogOut,
    Plus,
    ThumbsUp,
    ThumbsDown,
    Share2,
    ExternalLink,
    Check,
    X,
    Link2,
    MessageCircle,
    Heart,
    Bookmark,
    Layers
} from 'lucide-react';

export function Dashboard({ initialRemix, onClearRemix }) {
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
    const [sharingItem, setSharingItem] = useState(null);
    const [copied, setCopied] = useState(false);
    const [activeJob, setActiveJob] = useState(null);
    const [activeTab, setActiveTab] = useState('my'); // 'my', 'likes', 'bookmarks'
    const [remixSource, setRemixSource] = useState(initialRemix || null);

    const [presets, setPresets] = useState([]);
    const [selectedPresetId, setSelectedPresetId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTag, setActiveTag] = useState(null);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

    const fetchPresets = async () => {
        try {
            const res = await fetch(`${apiUrl} /api/presets`);
            if (res.ok) {
                const data = await res.json();
                setPresets(data.presets || []);
                if (data.presets?.length > 0) setSelectedPresetId(data.presets[0].id);
            }
        } catch (e) {
            console.error("Failed to fetch presets:", e);
        }
    };

    const fetchHistory = async (filter = activeTab, tag = activeTag) => {
        if (!user) return;
        setLoadingHistory(true);
        try {
            const token = await user.getIdToken();
            let url = `${apiUrl} /api/generations ? filter = ${filter} `;
            if (tag) url += `& tag=${encodeURIComponent(tag)} `;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token} ` }
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
        fetchPresets();
    }, []);

    useEffect(() => {
        fetchHistory(activeTab, activeTag);
    }, [user, activeTab, activeTag]);

    // Handle incoming remix from Explore
    useEffect(() => {
        if (initialRemix) {
            setRemixSource(initialRemix);
            // Scroll to top to focus on generator
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [initialRemix]);

    const credits = parseInt(backendUser?.credits?.integerValue || '0');

    const handleGenerate = async () => {
        if (!file) return;

        setGenerating(true);
        setError(null);
        setResult(null);

        try {
            const token = await user.getIdToken();
            const formData = new FormData();
            formData.append('image', file);
            if (selectedPresetId && !remixSource) {
                formData.append('presetId', selectedPresetId);
            }
            if (remixSource) {
                formData.append('remixFrom', remixSource.id);
            }

            const res = await fetch(`${apiUrl} /api/generate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token} `
                },
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Generation failed');
            }

            const data = await res.json();
            const newImageUrl = getImageUrl(data.imageUrl, apiUrl);
            setResult(newImageUrl);

            // Add to history locally for immediate feedback
            setHistory(prev => [{
                id: data.genId,
                summary: data.summary || 'New Masterpiece',
                imageUrl: data.imageUrl,
                tags: data.tags || [],
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
                const res = await fetch(`${apiUrl} /api/jobs / active`, {
                    headers: { 'Authorization': `Bearer ${token} ` }
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
            if (selectedPresetId) {
                formData.append('presetId', selectedPresetId);
            }

            // 1. Pre-upload image so we have a path for the webhook
            const uploadRes = await fetch(`${apiUrl} /api/upload - only`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token} ` },
                body: formData
            });

            if (!uploadRes.ok) throw new Error("Upload failed");
            const { path } = await uploadRes.json();

            // 2. Start Checkout
            const stripeRes = await fetch(`${apiUrl} /api/stripe / checkout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token} `,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    priceId: 'price_1QfV3vLpG8S7zK7v8L9j2A1B', // Example ID
                    originalPath: path,
                    presetId: selectedPresetId
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

    const handleVote = async (id, type) => {
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${apiUrl} /api/generations / ${id}/vote`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type })
            });
            if (res.ok) {
                const data = await res.json();
                setHistory(prev => prev.map(item =>
                    item.id === id ? { ...item, votes: data.votes } : item
                ));
            }
        } catch (e) {
            console.error("Vote failed:", e);
        }
    };

    const handleInteraction = async (type, item) => {
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${apiUrl}/api/generations/${item.id}/${type}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const isSetKey = type === 'like' ? 'isLiked' : 'isBookmarked';
                const countKey = type === 'like' ? 'likesCount' : 'bookmarksCount';
                const currentlySet = item[isSetKey];

                // Update local state
                setHistory(prev => {
                    // If we are in a filtered tab and we just un-set it, remove from view
                    if ((activeTab === 'likes' && type === 'like' && currentlySet) ||
                        (activeTab === 'bookmarks' && type === 'bookmark' && currentlySet)) {
                        return prev.filter(g => g.id !== item.id);
                    }

                    return prev.map(g => {
                        if (g.id === item.id) {
                            return {
                                ...g,
                                [isSetKey]: !currentlySet,
                                [countKey]: currentlySet ? (g[countKey] || 1) - 1 : (g[countKey] || 0) + 1
                            };
                        }
                        return g;
                    });
                });
            }
        } catch (e) {
            console.error(`${type} failed:`, e);
        }
    };

    const handleShare = async (item) => {
        try {
            // Already public? Just show modal.
            if (item.isPublic) {
                setSharingItem(item);
                return;
            }

            // Not public? Toggle first then show modal
            const token = await user.getIdToken();
            const res = await fetch(`${apiUrl}/api/generations/${item.id}/share`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const updatedItem = { ...item, isPublic: data.isPublic };
                setHistory(prev => prev.map(g => g.id === item.id ? updatedItem : g));
                if (data.isPublic) setSharingItem(updatedItem);
            }
        } catch (e) {
            console.error("Share failed:", e);
        }
    };

    const copyShareLink = (id) => {
        const url = `${window.location.origin}/share/${id}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareSocial = (platform, item) => {
        const url = `${window.location.origin}/share/${item.id}`;
        const text = `Check out this AI portrait of me! Generated by Justin Generator.`;

        let shareUrl = '';
        switch (platform) {
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
                break;
            case 'whatsapp':
                shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
                break;
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
                break;
        }
        if (shareUrl) window.open(shareUrl, '_blank');
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
                    <div className="flex items-center gap-3 bg-white/5 pl-5 pr-2 py-1.5 rounded-full border border-white/10 group/credits">
                        <div className="flex items-center gap-2">
                            <span className="text-violet-200 text-[10px] font-bold uppercase tracking-widest opacity-60">Credits</span>
                            <span className="text-white font-black text-xl tabular-nums">{credits}</span>
                        </div>
                        <div className="h-6 w-px bg-white/10 mx-1"></div>
                        <button
                            onClick={handleBuyCredits}
                            className="bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-full transition-all hover:scale-105 flex items-center gap-1.5 shadow-lg shadow-violet-600/20"
                            title="Add Credits"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Get More</span>
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

                    <div className="space-y-4">
                        <label className="text-sm font-medium text-violet-200 ml-1">
                            {remixSource ? 'Remixing Style' : 'Choose a Style'}
                        </label>

                        {remixSource ? (
                            <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex gap-4 items-center animate-fade-in-up">
                                <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0">
                                    <img src={getImageUrl(remixSource.imageUrl, apiUrl)} alt="Remix Source" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-grow">
                                    <p className="text-sm font-bold text-violet-300">Remixing Original Prompt</p>
                                    <p className="text-xs text-slate-400">The underlying prompt is hidden to maintain the magic.</p>
                                </div>
                                <button
                                    onClick={() => { setRemixSource(null); onClearRemix?.(); }}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {presets.map((preset) => (
                                    <button
                                        key={preset.id}
                                        onClick={() => setSelectedPresetId(preset.id)}
                                        className={`group relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${selectedPresetId === preset.id ? 'border-violet-500 ring-2 ring-violet-500/50' : 'border-white/5 hover:border-white/20'}`}
                                    >
                                        <img src={preset.sampleUrl} alt={preset.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                        <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity ${selectedPresetId === preset.id ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'}`}></div>
                                        <div className="absolute inset-0 flex flex-col justify-end p-3">
                                            <p className="text-[10px] font-bold text-white uppercase tracking-wider">{preset.title}</p>
                                            {selectedPresetId === preset.id && (
                                                <div className="absolute top-2 right-2 bg-violet-600 rounded-full p-1 shadow-lg">
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
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
                        <Sparkles className="w-5 h-5" />
                        Generate Pro Batch (10 Images)
                    </button>
                    <p className="text-center text-[10px] text-slate-500 font-medium">✨ Pro Batch uses advanced styles and saves to your collection</p>
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
                                            <img src={getImageUrl(url, apiUrl)} alt="Result" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
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

            <section className="mt-16 space-y-8 pb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/5 rounded-lg border border-white/10 shadow-inner">
                                <ImageIcon className="w-5 h-5 text-violet-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Gallery</h3>
                        </div>

                        {/* Search / Tag Filter */}
                        <div className="relative hidden md:block">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by tag..."
                                className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 w-48 transition-all focus:w-64"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        {activeTag && (
                            <div className="flex items-center gap-2 bg-violet-600/20 text-violet-300 px-3 py-1 rounded-full border border-violet-500/30 text-xs font-bold animate-fade-in">
                                Tag: {activeTag}
                                <button onClick={() => setActiveTag(null)} className="hover:text-white">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                            {['my', 'likes', 'bookmarks'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {tab === 'my' ? 'My Creations' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {loadingHistory ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="aspect-square bg-white/5 rounded-xl animate-pulse border border-white/5"></div>
                        ))}
                    </div>
                ) : history.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-fade-in">
                        {history.map((item) => (
                            <div
                                key={item.id}
                                className="group flex flex-col space-y-3"
                            >
                                <div
                                    className="relative aspect-[3/4] glass-card p-1 cursor-pointer overflow-hidden rounded-2xl border-white/5 hover:border-violet-500/30 transition-all duration-500 shadow-lg group-hover:shadow-violet-500/10"
                                    onClick={() => {
                                        setPreviewImage(`${apiUrl}${item.imageUrl}`);
                                        setShowFullSize(true);
                                    }}
                                >
                                    <img
                                        src={getImageUrl(item.imageUrl, apiUrl)}
                                        alt={item.prompt}
                                        className="w-full h-full object-cover rounded-xl transition-transform duration-700 group-hover:scale-105"
                                    />

                                    {/* Quick Actions Overlay */}
                                    <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleInteraction('like', item); }}
                                            className={`p-2 rounded-full backdrop-blur-md border transition-all hover:scale-110 ${item.isLiked ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' : 'bg-black/40 border-white/10 text-white/70 hover:text-rose-400'}`}
                                            title="Like"
                                        >
                                            <Heart className={`w-4 h-4 ${item.isLiked ? 'fill-rose-500' : ''}`} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleInteraction('bookmark', item); }}
                                            className={`p-2 rounded-full backdrop-blur-md border transition-all hover:scale-110 ${item.isBookmarked ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-black/40 border-white/10 text-white/70 hover:text-amber-400'}`}
                                            title="Bookmark"
                                        >
                                            <Bookmark className={`w-4 h-4 ${item.isBookmarked ? 'fill-amber-500' : ''}`} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setRemixSource(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                            className="p-2 rounded-full backdrop-blur-md border border-white/10 bg-black/40 text-white/70 hover:text-white hover:bg-violet-600/50 transition-all hover:scale-110"
                                            title="Remix Style"
                                        >
                                            <Layers className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleShare(item); }}
                                            className={`p-2 rounded-full backdrop-blur-md border transition-all hover:scale-110 ${item.isPublic ? 'bg-violet-500/20 border-violet-500/50 text-violet-200' : 'bg-black/40 border-white/10 text-white/70 hover:text-white'}`}
                                            title={item.isPublic ? "Share Settings" : "Make Public & Share"}
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Hover info */}
                                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {item.tags?.slice(0, 3).map(tag => (
                                                <span
                                                    key={tag}
                                                    onClick={(e) => { e.stopPropagation(); setActiveTag(tag); }}
                                                    className="bg-white/10 hover:bg-white/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-full border border-white/10 transition-colors"
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Summary & Voting */}
                                <div className="px-1 flex items-center justify-between gap-3">
                                    <div className="flex-grow min-w-0">
                                        <h4 className="text-sm font-bold text-white truncate group-hover:text-violet-300 transition-colors">
                                            {item.summary || "Masterpiece"}
                                        </h4>
                                        <p className="text-[10px] text-slate-500 font-medium">
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/5">
                                        <button
                                            onClick={() => handleVote(item.id, 'up')}
                                            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-green-400"
                                        >
                                            <ThumbsUp className="w-3.5 h-3.5" />
                                        </button>
                                        <span className="text-[10px] font-bold text-slate-300 min-w-[12px] text-center">
                                            {item.votes || 0}
                                        </span>
                                        <button
                                            onClick={() => handleVote(item.id, 'down')}
                                            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-red-400"
                                        >
                                            <ThumbsDown className="w-3.5 h-3.5" />
                                        </button>
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

            {/* Share Modal */}
            {sharingItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSharingItem(null)}></div>
                    <div className="glass-panel w-full max-w-md rounded-3xl overflow-hidden relative animate-scale-in">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Share2 className="w-5 h-5 text-violet-400" />
                                Share Masterpiece
                            </h3>
                            <button onClick={() => setSharingItem(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Link Box */}
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Shareable Link</p>
                                <div className="flex gap-2 p-2 bg-black/40 rounded-2xl border border-white/10 items-center">
                                    <input
                                        readOnly
                                        value={`${window.location.origin}/share/${sharingItem.id}`}
                                        className="bg-transparent border-none text-sm text-slate-300 px-3 flex-grow outline-none truncate"
                                    />
                                    <button
                                        onClick={() => copyShareLink(sharingItem.id)}
                                        className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${copied ? 'bg-green-500 text-white' : 'bg-violet-600 text-white hover:bg-violet-500'}`}
                                    >
                                        {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                                        {copied ? 'Copied' : 'Copy'}
                                    </button>
                                </div>
                            </div>

                            {/* Social Buttons */}
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Share to Socials</p>
                                <div className="grid grid-cols-3 gap-4">
                                    <button
                                        onClick={() => shareSocial('twitter', sharingItem)}
                                        className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 group"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Twitter</span>
                                    </button>
                                    <button
                                        onClick={() => shareSocial('whatsapp', sharingItem)}
                                        className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 group"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 group-hover:scale-110 transition-transform">
                                            <MessageCircle className="w-6 h-6" />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp</span>
                                    </button>
                                    <button
                                        onClick={() => shareSocial('facebook', sharingItem)}
                                        className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 group"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facebook</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-white/5 border-t border-white/5">
                            <button
                                onClick={async () => {
                                    const token = await user.getIdToken();
                                    const res = await fetch(`${apiUrl}/api/generations/${sharingItem.id}/share`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}` }
                                    });
                                    if (res.ok) {
                                        const data = await res.json();
                                        setHistory(prev => prev.map(g => g.id === sharingItem.id ? { ...g, isPublic: data.isPublic } : g));
                                    }
                                    setSharingItem(null);
                                }}
                                className="w-full py-4 text-xs font-bold text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest"
                            >
                                Stop Sharing Publicly
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
