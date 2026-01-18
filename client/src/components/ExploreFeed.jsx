import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Heart, Bookmark, ArrowRight, Layers, Share2 } from 'lucide-react';
import { getImageUrl } from '../lib/url';

export function ExploreFeed({ onRemix }) {
    const { user } = useAuth();
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

    useEffect(() => {
        const fetchFeed = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/public/feed`);
                if (res.ok) {
                    const data = await res.json();
                    setFeed(data.feed || []);
                }
            } catch (e) {
                console.error("Failed to fetch feed:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchFeed();
    }, [apiUrl]);

    const handleAction = (type, item) => {
        if (!user) {
            // Store action for post-login redirect
            localStorage.setItem('redirectAction', JSON.stringify({ type, id: item.id }));
            window.location.href = '/login'; // Or use a router if available
            return;
        }

        if (type === 'remix') {
            onRemix(item);
        } else {
            performInteraction(type, item.id);
        }
    };

    const performInteraction = async (type, id) => {
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${apiUrl}/api/generations/${id}/${type}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                // Optimistic UI update
                setFeed(prev => prev.map(item => {
                    if (item.id === id) {
                        const countKey = type === 'like' ? 'likesCount' : 'bookmarksCount';
                        const isSetKey = type === 'like' ? 'isLiked' : 'isBookmarked';
                        const currentCount = item[countKey] || 0;
                        const currentlySet = item[isSetKey];

                        return {
                            ...item,
                            [countKey]: currentlySet ? currentCount - 1 : currentCount + 1,
                            [isSetKey]: !currentlySet
                        };
                    }
                    return item;
                }));
            }
        } catch (e) {
            console.error(`Failed to ${type}:`, e);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto px-4 py-12">
            <div className="text-center mb-12 md:mb-16 space-y-4 relative">
                {user && (
                    <button
                        onClick={() => window.location.href = '/'}
                        className="md:absolute left-0 top-0 flex items-center gap-2 text-theme-text-secondary hover:text-theme-text-primary transition-colors text-sm font-medium bg-theme-glass-bg px-4 py-2 rounded-full border border-theme-glass-border hover:bg-theme-bg-accent mb-6 md:mb-0 mx-auto md:mx-0 w-fit"
                    >
                        <ArrowRight className="w-4 h-4 rotate-180" />
                        Back to Studio
                    </button>
                )}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium animate-fade-in">
                    <Sparkles className="w-4 h-4" />
                    <span>Discovery Feed</span>
                </div>
                <h1 className="text-3xl md:text-6xl font-bold tracking-tight text-theme-text-primary px-2">
                    Explore the <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-500 to-fuchsia-500 dark:from-violet-400 dark:to-fuchsia-400">Masterpieces</span>
                </h1>
                <p className="text-[var(--text-secondary)] text-base md:text-lg max-w-2xl mx-auto px-4 font-medium">
                    Click any photo below to transform your own photo into that style instantly.
                </p>

                {/* How it Works Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 max-w-4xl mx-auto px-4">
                    {[
                        { step: "1", title: "Pick a Style", desc: "Choose any masterpiece you love from the feed below." },
                        { step: "2", title: "Upload Photo", desc: "Upload a selfie or clear photo of yourself." },
                        { step: "3", title: "Get Your Art", desc: "Our AI generates a new portrait of you in that style!" }
                    ].map((item, i) => (
                        <div key={i} className="flex flex-col items-center space-y-2 p-4 rounded-2xl bg-theme-glass-bg border border-theme-glass-border">
                            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-600/20">
                                {item.step}
                            </div>
                            <h4 className="text-theme-text-primary font-bold text-sm">{item.title}</h4>
                            <p className="text-theme-text-secondary text-xs leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {feed.map((item) => (
                    <div
                        key={item.id}
                        className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-theme-bg-accent border border-theme-glass-border hover:border-violet-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-violet-500/20"
                    >
                        <img
                            src={getImageUrl(item.imageUrl, apiUrl, 400)}
                            onLoad={() => console.log('Image loaded:', getImageUrl(item.imageUrl, apiUrl, 400))}
                            onError={() => console.error('Image FAILED:', { path: item.imageUrl, apiUrl, final: getImageUrl(item.imageUrl, apiUrl, 400) })}
                            alt={item.summary}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            loading="lazy"
                            decoding="async"
                        />

                        {/* Overlay - Visible on mobile by default, hover on desktop */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 cursor-pointer"
                            onClick={() => handleAction('remix', item)}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex gap-4 text-white font-medium">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleAction('like', item); }}
                                        className="flex items-center gap-1.5 hover:text-rose-400 transition-colors"
                                    >
                                        <Heart className={`w-5 h-5 ${item.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                                        <span>{item.likesCount || 0}</span>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleAction('bookmark', item); }}
                                        className="flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                                    >
                                        <Bookmark className={`w-5 h-5 ${item.isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
                                        <span>{item.bookmarksCount || 0}</span>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const url = `${window.location.origin}/share/${item.id}`;
                                            if (navigator.share) {
                                                navigator.share({
                                                    title: item.summary || 'AI Masterpiece',
                                                    text: 'Check out this AI portrait!',
                                                    url
                                                }).catch(err => {
                                                    if (err.name !== 'AbortError') console.error('Share failed:', err);
                                                });
                                            } else {
                                                navigator.clipboard.writeText(url);
                                                alert("Link copied to clipboard!");
                                            }
                                        }}
                                        className="flex items-center gap-1.5 hover:text-violet-400 transition-colors"
                                        title="Share"
                                    >
                                        <Share2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); handleAction('remix', item); }}
                                className="w-full py-3 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-violet-500 hover:text-white transition-all duration-300 transform active:scale-95 shadow-xl"
                            >
                                <Layers className="w-5 h-5" />
                                <span>Remix with me</span>
                                <ArrowRight className="w-4 h-4 ml-1" />
                            </button>
                        </div>

                        {/* Mobile Prompt - Subtle hint for mobile users */}
                        <div className="md:hidden absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-white text-[10px] font-bold flex items-center gap-2 pointer-events-none">
                            <Layers className="w-3 h-3 text-violet-400" />
                            Click to Remix
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
}
