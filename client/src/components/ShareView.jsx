import { useState, useEffect } from 'react';
import { Sparkles, Download, Calendar, ThumbsUp } from 'lucide-react';
import { getImageUrl } from '../lib/url';

export function ShareView({ genId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

    useEffect(() => {
        const fetchShare = async () => {
            try {
                console.log("Fetching share data for:", genId);
                const res = await fetch(`${apiUrl}/api/public/share/${genId}`);
                if (!res.ok) {
                    if (res.status === 404) throw new Error("This generation is not public or does not exist.");
                    throw new Error("Failed to load masterpiece");
                }
                const json = await res.json();
                console.log("Share data received:", json);
                // Support both { generation: ... } and direct data
                const fetchedData = json.generation || json;
                if (!fetchedData || !fetchedData.imageUrl) {
                    throw new Error("Invalid masterpiece data received");
                }
                setData(fetchedData);
            } catch (e) {
                console.error("Share fetch error:", e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchShare();
    }, [genId]);

    const handleDownload = async () => {
        if (!data) return;
        try {
            const url = getImageUrl(data.imageUrl, apiUrl);
            const res = await fetch(url);
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `generation-${genId}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Download failed:", e);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4">
                <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-violet-200 animate-pulse font-medium">Revealing Masterpiece...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black p-6 text-center">
                <div className="glass-panel p-8 rounded-3xl border-red-500/20 max-w-md w-full">
                    <div className="bg-red-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Oops!</h2>
                    <p className="text-slate-400 mb-8">{error}</p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3 px-6 rounded-xl transition-all border border-white/10"
                    >
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-black flex flex-col items-center py-12 px-4 overflow-x-hidden">
            {/* Logo/Header */}
            <div
                className="flex items-center gap-3 mb-12 cursor-pointer group"
                onClick={() => window.location.href = '/'}
            >
                <div className="bg-violet-600 p-2 rounded-lg shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Justin Generator</h1>
            </div>

            <div className="w-full max-w-2xl animate-fade-in">
                <div className="glass-card overflow-hidden rounded-[2.5rem] border-white/5 shadow-2xl shadow-violet-500/5 group">
                    {/* Main Image Container */}
                    <div className="relative aspect-[3/4] bg-slate-900 overflow-hidden">
                        <img
                            src={getImageUrl(data.imageUrl, apiUrl)}
                            alt={data.summary}
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>

                        {/* Download FAB */}
                        <button
                            onClick={handleDownload}
                            className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-2xl border border-white/20 text-white transition-all hover:scale-110 active:scale-95 group/btn shadow-xl"
                            title="Download Masterpiece"
                        >
                            <Download className="w-6 h-6 group-hover/btn:rotate-12 transition-transform" />
                        </button>
                    </div>

                    {/* Metadata Section */}
                    <div className="p-8 md:p-10 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div className="space-y-2">
                                <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
                                    {data.summary}
                                </h2>
                            </div>

                            <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5">
                                <div className="px-4 py-2 text-center border-r border-white/5">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Votes</p>
                                    <div className="flex items-center gap-2 justify-center">
                                        <ThumbsUp className="w-4 h-4 text-green-400" />
                                        <span className="text-xl font-black text-white">{data.votes || 0}</span>
                                    </div>
                                </div>
                                <div className="px-4 py-2 text-center">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Created</p>
                                    <div className="flex items-center gap-2 justify-center">
                                        <Calendar className="w-4 h-4 text-violet-400" />
                                        <span className="text-sm font-bold text-white">
                                            {new Date(data.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">Original Prompt</h3>
                            <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                <p className="text-slate-300 italic leading-relaxed md:text-lg">
                                    "{data.prompt}"
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                localStorage.setItem('redirectAction', JSON.stringify({ type: 'remix', id: genId }));
                                window.location.href = '/';
                            }}
                            className="w-full mt-8 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black py-5 px-8 rounded-2xl transition-all shadow-xl shadow-violet-600/30 active:scale-[0.98] flex items-center justify-center gap-3 border border-white/10 group/cta"
                        >
                            <span className="text-lg">Remix this style on me</span>
                            <Sparkles className="w-6 h-6 group-hover/cta:animate-pulse" />
                        </button>
                    </div>
                </div>

                {/* Footer simple */}
                <p className="text-center text-slate-600 text-[10px] mt-12 font-medium tracking-wide">
                    POWERED BY JUSTIN GENERATOR & GOOGLE GEMINI
                </p>
            </div>
        </div>
    );
}
