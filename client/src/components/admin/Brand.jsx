import React, { useState, useEffect, useRef } from 'react';
import { Palette, Image as ImageIcon, Upload, CheckCircle2, Copy, ExternalLink, Info, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl } from '../../lib/url';

export function Brand() {
    const { user } = useAuth();
    const [copiedColor, setCopiedColor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [branding, setBranding] = useState({});
    const [uploading, setUploading] = useState(null);
    const fileInputRefs = useRef({});

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

    const colors = [
        { name: 'Primary (Violet)', hex: '#8b5cf6', description: 'Core brand color used for buttons and highlights' },
        { name: 'Secondary (Fuchsia)', hex: '#d946ef', description: 'Accent color for gradients and secondary elements' },
        { name: 'Background Primary', hex: '#050505', description: 'Main application background' },
        { name: 'Background Secondary', hex: '#0a0a0a', description: 'Card and panel background' },
        { name: 'Text Primary', hex: '#f8fafc', description: 'Main heading and body text' },
        { name: 'Text Secondary', hex: '#64748b', description: 'Muted text and metadata' },
    ];

    const assetDefinitions = [
        {
            id: 'logo',
            name: 'Brand Logo',
            size: '1024x1024',
            format: 'PNG',
            usage: 'Header, Landing Page, Social Media',
            description: 'The primary visual identity of Justin Generator.'
        },
        {
            id: 'favicon',
            name: 'Favicon',
            size: '32x32',
            format: 'PNG',
            usage: 'Browser Tab',
            description: 'Shown in browser tabs and bookmarks.'
        },
        {
            id: 'apple',
            name: 'Apple Touch Icon',
            size: '180x180',
            format: 'PNG',
            usage: 'iOS Home Screen',
            description: 'Used when the app is saved to an iPhone/iPad home screen.'
        },
        {
            id: 'pwa-192',
            name: 'PWA Icon (Small)',
            size: '192x192',
            format: 'PNG',
            usage: 'Android Splash Screen',
            description: 'Standard icon for mobile progressive web apps.'
        },
        {
            id: 'pwa-512',
            name: 'PWA Icon (Large)',
            size: '512x512',
            format: 'PNG',
            usage: 'Android Splash Screen',
            description: 'High-resolution icon for mobile splash screens.'
        }
    ];

    useEffect(() => {
        fetchBranding();
    }, []);

    const fetchBranding = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${apiUrl}/api/admin/branding`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'success') {
                setBranding(data.branding);
            }
        } catch (e) {
            console.error("Failed to fetch branding:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (key, file) => {
        if (!file) return;
        setUploading(key);

        try {
            const token = await user.getIdToken();
            const formData = new FormData();
            formData.append('file', file);
            formData.append('key', key);

            const res = await fetch(`${apiUrl}/api/admin/branding/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (data.status === 'success') {
                setBranding(prev => ({ ...prev, [key]: data.imageUrl }));
            }
        } catch (e) {
            console.error("Upload failed:", e);
        } finally {
            setUploading(null);
        }
    };

    const copyToClipboard = (hex) => {
        navigator.clipboard.writeText(hex);
        setCopiedColor(hex);
        setTimeout(() => setCopiedColor(null), 2000);
    };

    const getAssetUrl = (path) => {
        if (!path) return '';
        // If it's a relative path to public folder, just return it
        if (path.startsWith('/') && !path.startsWith('/api/')) return path;
        // If it's an R2 path (branding/...), proxy it
        if (path.startsWith('branding/')) return getImageUrl(`/api/public/image/${path}`, apiUrl);
        // Default
        return getImageUrl(path, apiUrl);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-theme-text-secondary">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p>Loading brand config...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Asset Management */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <ImageIcon className="text-violet-500" size={24} />
                    <h2 className="text-xl font-bold">Brand Assets</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assetDefinitions.map(asset => (
                        <div key={asset.id} className="bg-theme-bg-secondary border border-theme-glass-border rounded-2xl overflow-hidden group hover:border-violet-500/30 transition-all flex flex-col">
                            <div className="aspect-square bg-black/40 flex items-center justify-center p-8 relative">
                                <img
                                    src={getAssetUrl(branding[asset.id]) || getAssetUrl(`/${asset.id === 'apple' ? 'apple-touch-icon' : (asset.id.startsWith('pwa') ? 'icon-' + asset.id.split('-')[1] : asset.id)}.png`)}
                                    alt={asset.name}
                                    className="max-w-full max-h-full object-contain drop-shadow-2xl"
                                />
                                {uploading === asset.id && (
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm">
                                        <Loader2 className="animate-spin text-white mb-2" />
                                        <span className="text-xs font-bold text-white uppercase tracking-widest">Uploading...</span>
                                    </div>
                                )}
                                <div className="absolute top-3 right-3 flex gap-1">
                                    <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[8px] font-black uppercase text-gray-400 border border-white/5">
                                        {asset.format}
                                    </div>
                                    <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[8px] font-black uppercase text-gray-400 border border-white/5">
                                        {asset.size}
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="font-bold text-lg mb-1">{asset.name}</h3>
                                <p className="text-xs text-theme-text-muted mb-4 line-clamp-2 h-8">{asset.description}</p>

                                <div className="space-y-2 mb-6">
                                    <div className="flex items-start gap-2">
                                        <Info size={12} className="text-violet-400 mt-0.5" />
                                        <div className="text-[10px] text-theme-text-secondary leading-tight">
                                            <span className="font-bold text-violet-300">USAGE:</span> {asset.usage}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 border-t border-theme-glass-border flex gap-2">
                                    <button
                                        onClick={() => window.open(getAssetUrl(branding[asset.id]), '_blank')}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-theme-glass-bg hover:bg-theme-glass-border text-xs font-bold transition-all border border-transparent hover:border-white/10"
                                    >
                                        <ExternalLink size={14} /> View
                                    </button>
                                    <button
                                        onClick={() => fileInputRefs.current[asset.id].click()}
                                        className="p-2 rounded-xl bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 transition-all border border-violet-500/20 group-hover:border-violet-500/40"
                                    >
                                        <Upload size={16} />
                                    </button>
                                    <input
                                        type="file"
                                        ref={el => fileInputRefs.current[asset.id] = el}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => handleUpload(asset.id, e.target.files[0])}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Color Palette */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Palette className="text-violet-500" size={24} />
                    <h2 className="text-xl font-bold">Color Identity</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {colors.map(color => (
                        <div key={color.hex} className="bg-theme-bg-secondary border border-theme-glass-border p-4 rounded-2xl flex items-center gap-4 group">
                            <div
                                className="w-16 h-16 rounded-xl shadow-lg border border-white/10 flex-shrink-0"
                                style={{ backgroundColor: color.hex }}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <h3 className="font-bold text-sm truncate">{color.name}</h3>
                                    <button
                                        onClick={() => copyToClipboard(color.hex)}
                                        className="text-theme-text-muted hover:text-white transition-colors"
                                    >
                                        {copiedColor === color.hex ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <div className="text-xs font-mono text-violet-400 font-bold mb-1 uppercase tracking-tighter">{color.hex}</div>
                                <p className="text-[10px] text-theme-text-muted leading-tight">{color.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="bg-violet-500/5 border border-violet-500/10 p-4 rounded-2xl flex items-start gap-3">
                <Info className="text-violet-400 shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-violet-200/60 leading-relaxed italic">
                    The branding system adheres to a high-contrast dark aesthetic using an Outfit variable font stack and a violet-to-fuchsia primary gradient.
                </p>
            </div>
        </div>
    );
}
