import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
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
    Layers,
    Settings,
    Search,
    User,
    Moon,
    Sun,
    Monitor
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
    const [currentGenId, setCurrentGenId] = useState(null);

    const [presets, setPresets] = useState([]);
    const [selectedPresetId, setSelectedPresetId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTag, setActiveTag] = useState(null);
    const [features, setFeatures] = useState({ dailyRewards: true, referrals: true });
    const [referralCredits, setReferralCredits] = useState(5);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const { theme, setTheme } = useTheme();

    // Handle File Preview
    useEffect(() => {
        if (!file) {
            setPreviewUrl(null);
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

    // Fetch config
    useEffect(() => {
        fetch(`${apiUrl}/api/public/config`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    if (data.features) setFeatures(data.features);
                    if (data.referralCredits) setReferralCredits(data.referralCredits);
                }
            })
            .catch(err => console.error("Failed to load config:", err));
    }, []);
    useEffect(() => {
        if (showFullSize || sharingItem) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [showFullSize, sharingItem]);



    const fetchPresets = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/presets`);
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
            let url = `${apiUrl}/api/generations?filter=${filter}`;
            if (tag) url += `&tag=${encodeURIComponent(tag)}`;
            const res = await fetch(url, {
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
            const newImageUrl = getImageUrl(data.imageUrl, apiUrl);
            setResult(newImageUrl);
            setCurrentGenId(data.genId);

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
            if (selectedPresetId) {
                formData.append('presetId', selectedPresetId);
            }

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
            const res = await fetch(`${apiUrl}/api/generations/${id}/vote`, {
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

    const handleNativeShare = async (item) => {
        const url = `${window.location.origin}/share/${item.id}`;
        const title = "My AI Masterpiece";
        const text = `Check out this AI portrait of me! Generated by Justin Generator.`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title,
                    text,
                    url
                });
                return true;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Error sharing native:', err);
                }
            }
        }
        return false;
    };

    const handleShare = async (item) => {
        try {
            let targetItem = item;

            // Not public? Toggle first
            if (!item.isPublic) {
                const token = await user.getIdToken();
                const res = await fetch(`${apiUrl}/api/generations/${item.id}/share`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    targetItem = { ...item, isPublic: data.isPublic };
                    setHistory(prev => prev.map(g => g.id === item.id ? targetItem : g));
                }
            }

            if (targetItem.isPublic) {
                const shared = await handleNativeShare(targetItem);
                if (!shared) {
                    setSharingItem(targetItem);
                }
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
        <div className="w-full max-w-5xl px-4 py-8">
            <header className="flex flex-col sm:flex-row justify-between items-center glass-panel p-4 md:p-6 rounded-2xl gap-4 md:gap-6 animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <div className="bg-violet-600 p-2 rounded-lg shadow-lg shadow-violet-500/30">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-theme-text-primary tracking-tight">Justin Generator</h2>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6">
                    <button
                        onClick={() => window.location.href = '/explore'}
                        className="text-theme-text-secondary hover:text-theme-text-primary transition-colors flex items-center gap-2 text-[10px] md:text-sm font-bold uppercase tracking-wider hover:scale-105"
                    >
                        <ExternalLink className="w-4 h-4" />
                        <span className="hidden xs:inline">Public Gallery</span>
                        <span className="xs:hidden">Gallery</span>
                    </button>
                    <div className="flex items-center gap-2 md:gap-3 bg-theme-bg-accent pl-3 md:pl-5 pr-1 md:pr-2 py-1 md:py-1.5 rounded-full border border-theme-glass-border group/credits">
                        <div className="flex items-center gap-2">
                            <span className="text-violet-600 dark:text-violet-300 text-[8px] md:text-[10px] font-bold uppercase tracking-widest">Credits</span>
                            <span className="text-theme-text-primary font-black text-lg md:text-xl tabular-nums">{credits}</span>
                        </div>
                        <div className="h-4 md:h-6 w-px bg-theme-glass-border mx-0.5 md:mx-1"></div>
                        <button
                            onClick={() => window.location.href = '/pricing'}
                            className="bg-violet-600 hover:bg-violet-500 text-white px-2 md:px-3 py-1 md:py-1.5 rounded-full transition-all hover:scale-105 flex items-center gap-1.5 shadow-lg shadow-violet-600/20"
                            title="Add Credits"
                        >
                            <Plus className="w-3 h-3 md:w-3.5 md:h-3.5" />
                            <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-wider">Add</span>
                        </button>
                    </div>
                    <div className="flex items-center gap-3 px-4 border-l border-theme-glass-border">
                        <button
                            onClick={() => setShowSettings(true)}
                            className="w-10 h-10 rounded-full bg-theme-bg-accent border border-theme-glass-border flex items-center justify-center text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-glass-bg transition-all hover:scale-110 active:scale-95 group relative"
                            title="User Settings"
                        >
                            <User className="w-5 h-5" />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-violet-500 rounded-full border-2 border-theme-bg-primary group-hover:scale-110 transition-transform"></div>
                        </button>
                    </div>
                </div>
            </header>

            {(features.dailyRewards || features.referrals) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
                    {/* Daily Bonus Card */}
                    {features.dailyRewards && (
                        <div className="glass-card p-4 flex items-center justify-between border-violet-500/20 bg-violet-500/5 group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Plus className="w-5 h-5 text-violet-400" />
                                </div>
                                <div>
                                    <h4 className="text-theme-text-primary font-bold text-sm">Daily Reward</h4>
                                    <p className="text-theme-text-secondary text-xs text-nowrap">Claim your free daily credit</p>
                                </div>
                            </div>
                            <button
                                onClick={() => alert("Daily credit added! (Mock implementation)")}
                                className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all hover:shadow-lg hover:shadow-violet-600/40"
                            >
                                Claim Now
                            </button>
                        </div>
                    )}

                    {/* Invite Card */}
                    {features.referrals && (
                        <div className="glass-card p-4 flex items-center justify-between border-fuchsia-500/20 bg-fuchsia-500/5 group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-fuchsia-600/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Share2 className="w-5 h-5 text-fuchsia-400" />
                                </div>
                                <div>
                                    <h4 className="text-theme-text-primary font-bold text-sm">Invite Friends</h4>
                                    <p className="text-theme-text-secondary text-xs text-nowrap">Get {referralCredits} credits for every referral</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/?ref=${user.uid}`);
                                    alert("Referral link copied to clipboard!");
                                }}
                                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all hover:shadow-lg hover:shadow-fuchsia-600/40"
                            >
                                Copy Link
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-8 mt-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>

                <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Input Section */}
                    <section className="glass-card p-8 space-y-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none group-hover:bg-violet-600/20 transition-all duration-700"></div>

                        <div>
                            <h3 className="text-2xl font-bold text-theme-text-primary mb-2">Create Magic</h3>
                            <p className="text-theme-text-secondary text-sm">Upload a photo and let AI transform it into art.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-theme-text-secondary dark:text-violet-200 flex items-center gap-2">
                                    {remixSource ? 'Remixing Style' : 'Choose a Style'}
                                    {(selectedPresetId || remixSource) && <Check className="w-4 h-4 text-emerald-500 animate-fade-in" />}
                                </label>
                            </div>

                            {remixSource ? (
                                <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex gap-4 items-center animate-fade-in-up">
                                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0">
                                        <img
                                            src={getImageUrl(remixSource.imageUrl, apiUrl)}
                                            alt="Remix Source"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                console.error('Remix source load error:', remixSource.imageUrl);
                                                e.target.src = 'https://placehold.co/100x100?text=Error';
                                            }}
                                        />
                                    </div>
                                    <div className="flex-grow">
                                        <p className="text-sm font-bold text-violet-300">Selected Style</p>
                                    </div>
                                    <button
                                        onClick={() => { setRemixSource(null); onClearRemix?.(); }}
                                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {presets.map((preset) => (
                                            <button
                                                key={preset.id}
                                                onClick={() => setSelectedPresetId(preset.id)}
                                                className={`group relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${selectedPresetId === preset.id ? 'border-violet-500 ring-2 ring-violet-500/50' : 'border-white/5 hover:border-white/20'}`}
                                            >
                                                <img src={getImageUrl(preset.sampleUrl, apiUrl, 200)} alt={preset.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" loading="lazy" decoding="async" />
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
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm font-medium text-theme-text-primary flex items-center gap-2">
                                Upload Your Photo
                                {file && <Check className="w-4 h-4 text-emerald-400 animate-fade-in" />}
                            </label>

                            <div
                                className={`border-2 border-dashed border-theme-glass-border rounded-2xl p-8 text-center transition-all duration-300 relative overflow-hidden ${file ? 'bg-violet-500/10 border-violet-500/30' : 'hover:bg-theme-glass-bg hover:border-violet-500/30'} cursor-pointer h-[200px] flex items-center justify-center`}
                            >
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setFile(e.target.files[0])}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                {previewUrl ? (
                                    <div className="absolute inset-0 w-full h-full animate-fade-in">
                                        <div className="absolute inset-0 bg-black/50 z-0 text-white flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity backdrop-blur-sm">
                                            <ImageIcon className="w-8 h-8 mb-2" />
                                            <p className="font-bold">Click to Change</p>
                                        </div>
                                        <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                                    </div>
                                ) : (
                                    <div className="space-y-4 pointer-events-none relative z-0 flex flex-col items-center justify-center">
                                        <div className={`p-4 rounded-full bg-theme-bg-secondary/50 transition-transform duration-300 ${!file && 'group-hover:scale-110'}`}>
                                            {file ? <ImageIcon className="w-8 h-8 text-violet-500" /> : <Upload className="w-8 h-8 text-theme-text-muted" />}
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-theme-text-primary font-medium text-lg">
                                                Upload Photo
                                            </p>
                                            <p className="text-theme-text-muted text-sm">
                                                Drag & drop or click to browse
                                            </p>
                                        </div>
                                    </div>
                                )}
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

                                    <div className="h-4 w-full bg-theme-bg-accent rounded-full overflow-hidden border border-theme-glass-border p-1">
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
                                                <img src={getImageUrl(url, apiUrl, 400)} alt="Result" className="w-full h-full object-cover transition-transform group-hover:scale-110" loading="lazy" decoding="async" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            </div>
                                        ))}
                                        {[...Array(activeJob.total - activeJob.results.length)].map((_, i) => (
                                            <div key={`blank-${i}`} className="aspect-square rounded-lg bg-theme-bg-accent border border-theme-glass-border animate-pulse flex items-center justify-center">
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
                            <div className="w-full space-y-4 animate-fade-in-up">
                                <div
                                    className="w-full max-h-[600px] flex items-center justify-center relative group rounded-2xl overflow-hidden cursor-zoom-in border border-white/10 glass shadow-2xl"
                                    onClick={() => { setPreviewImage(result); setShowFullSize(true); }}
                                >
                                    <img
                                        src={result}
                                        alt="Generated"
                                        className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                                    />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                                        <Plus className="w-10 h-10 text-white/50" />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 pt-2" onClick={e => e.stopPropagation()}>
                                    <a
                                        href={result}
                                        download="generated.png"
                                        className="flex-grow bg-white text-black font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-violet-50 transition-all shadow-lg active:scale-95"
                                    >
                                        <Download className="w-5 h-5" />
                                        Download Masterpiece
                                    </a>
                                    {currentGenId && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const item = history.find(h => h.id === currentGenId) || { id: currentGenId, isPublic: false };
                                                handleShare(item);
                                            }}
                                            className="px-8 bg-violet-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 active:scale-95"
                                        >
                                            <Share2 className="w-5 h-5" />
                                            Share
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-slate-600 space-y-4 relative z-10">
                                <div className="p-8 rounded-full bg-theme-bg-accent inline-flex backdrop-blur-xl border border-theme-glass-border shimmer">
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
                                <div className="p-2 bg-theme-bg-accent rounded-lg border border-white/10 shadow-inner">
                                    <ImageIcon className="w-5 h-5 text-violet-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white tracking-tight">Gallery</h3>
                            </div>

                            {/* Search / Tag Filter */}
                            <div className="relative flex-grow max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search prompts & tags..."
                                    className="bg-theme-bg-accent border border-theme-glass-border rounded-full pl-10 pr-10 py-2.5 text-sm text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50 w-full transition-all"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1 hover:bg-white/10 rounded-full transition-all"
                                    >
                                        <X className="w-4 h-4" />
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
                            <div className="flex bg-theme-bg-accent p-1 rounded-xl border border-white/10">
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
                                <div key={i} className="aspect-square bg-theme-bg-accent rounded-xl animate-pulse border border-theme-glass-border"></div>
                            ))}
                        </div>
                    ) : (() => {
                        const filtered = history.filter(item => {
                            if (!searchQuery) return true;
                            const q = searchQuery.toLowerCase();
                            return (
                                item.prompt?.toLowerCase().includes(q) ||
                                item.summary?.toLowerCase().includes(q) ||
                                item.tags?.some(tag => tag.toLowerCase().includes(q))
                            );
                        });

                        if (filtered.length === 0) {
                            return (
                                <div className="text-center py-20 animate-fade-in">
                                    <div className="p-6 rounded-3xl bg-theme-bg-accent border border-theme-glass-border inline-block backdrop-blur-xl mb-4">
                                        <ImageIcon className="w-12 h-12 text-slate-700 mx-auto" />
                                    </div>
                                    <h4 className="text-white font-bold text-lg">No results found</h4>
                                    <p className="text-slate-500">Try adjusting your search or filters</p>
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="mt-4 text-violet-400 font-bold hover:text-violet-300 transition-colors text-sm"
                                        >
                                            Clear Search
                                        </button>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-fade-in">
                                {filtered.map((item) => (
                                    <div key={item.id} className="group flex flex-col space-y-3">
                                        <div
                                            className="relative aspect-[3/4] glass-card p-1 cursor-pointer overflow-hidden rounded-2xl border-white/5 hover:border-violet-500/30 transition-all duration-500 shadow-lg group-hover:shadow-violet-500/10"
                                            onClick={() => {
                                                setPreviewImage(getImageUrl(item.imageUrl, apiUrl));
                                                setShowFullSize(true);
                                            }}
                                        >
                                            <img
                                                src={getImageUrl(item.imageUrl, apiUrl, 400)}
                                                alt={item.prompt}
                                                className="w-full h-full object-cover rounded-xl transition-transform duration-700 group-hover:scale-105"
                                                loading="lazy"
                                                decoding="async"
                                            />

                                            {/* Quick Actions Overlay - Always visible on mobile, hover on desktop */}
                                            <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
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
                                        </div>

                                        <div className="px-1 flex items-center justify-between gap-3">
                                            <div className="flex-grow min-w-0">
                                                <h4 className="text-sm font-bold text-white truncate group-hover:text-violet-300 transition-colors">
                                                    {item.summary || "Masterpiece"}
                                                </h4>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {item.tags?.slice(0, 2).map(tag => (
                                                        <button
                                                            key={tag}
                                                            onClick={(e) => { e.stopPropagation(); setActiveTag(tag); }}
                                                            className="text-[9px] font-bold text-violet-300 hover:text-white px-1.5 py-0.5 bg-violet-500/10 rounded border border-violet-500/20 transition-colors uppercase"
                                                        >
                                                            {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 bg-theme-bg-accent rounded-full p-1 border border-theme-glass-border">
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
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleShare(item); }}
                                                    className="p-2.5 bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 rounded-full border border-violet-500/20 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-violet-500/5 group/share"
                                                    title="Share Masterpiece"
                                                >
                                                    <Share2 className="w-4 h-4 transition-transform group-hover/share:rotate-12" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </section>
            </div >

            {/* Full Size Modal - Outside of animated transform container */}
            {
                showFullSize && previewImage && (
                    <div
                        className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-12 animate-fade-in"
                        onClick={() => setShowFullSize(false)}
                    >
                        <button
                            className="absolute top-4 right-4 md:top-6 md:right-6 text-white/50 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10 z-[210]"
                            onClick={() => setShowFullSize(false)}
                        >
                            <Plus className="w-8 h-8 rotate-45" />
                        </button>
                        <div className="relative max-w-full max-h-full flex items-center justify-center animate-scale-in">
                            <img
                                src={previewImage}
                                alt="Full size"
                                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
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
                )
            }

            {/* Share Modal - Outside of animated transform container */}
            {
                sharingItem && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSharingItem(null)}></div>
                        <div className="glass-panel w-full max-w-md rounded-3xl overflow-hidden relative animate-scale-in">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-theme-bg-accent">
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

                                    {navigator.share && (
                                        <button
                                            onClick={() => handleNativeShare(sharingItem)}
                                            className="w-full py-4 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 font-bold rounded-2xl border border-violet-500/30 transition-all flex items-center justify-center gap-2 mb-2 group"
                                        >
                                            <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                            Share to other apps
                                        </button>
                                    )}

                                    <div className="grid grid-cols-3 gap-4">
                                        <button
                                            onClick={() => shareSocial('twitter', sharingItem)}
                                            className="flex flex-col items-center gap-2 p-4 bg-theme-bg-accent hover:bg-white/10 rounded-2xl transition-all border border-theme-glass-border group"
                                        >
                                            <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                                                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Twitter</span>
                                        </button>
                                        <button
                                            onClick={() => shareSocial('whatsapp', sharingItem)}
                                            className="flex flex-col items-center gap-2 p-4 bg-theme-bg-accent hover:bg-white/10 rounded-2xl transition-all border border-theme-glass-border group"
                                        >
                                            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 group-hover:scale-110 transition-transform">
                                                <MessageCircle className="w-6 h-6" />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp</span>
                                        </button>
                                        <button
                                            onClick={() => shareSocial('facebook', sharingItem)}
                                            className="flex flex-col items-center gap-2 p-4 bg-theme-bg-accent hover:bg-white/10 rounded-2xl transition-all border border-theme-glass-border group"
                                        >
                                            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facebook</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-theme-bg-accent border-t border-white/5">
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
                )
            }
            {/* User Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowSettings(false)}></div>
                    <div className="glass-panel w-full max-w-md rounded-3xl overflow-hidden relative animate-scale-in border border-white/10 shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-theme-bg-accent">
                            <h3 className="text-xl font-bold text-theme-text-primary flex items-center gap-2">
                                <User className="w-5 h-5 text-violet-400" />
                                User Profile
                            </h3>
                            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
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
                                            navigator.clipboard.writeText(`${window.location.origin}/?ref=${user.uid}`);
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
            )}
        </div >
    );
}
