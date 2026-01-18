import React, { useState, useEffect, useRef } from 'react';
import { Palette, Image as ImageIcon, Upload, CheckCircle2, Copy, ExternalLink, Info, Loader2, Save, Type, Trash2, Plus, Bookmark, RefreshCcw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl } from '../../lib/url';

export function Brand() {
    const { user } = useAuth();
    const [copiedColor, setCopiedColor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [branding, setBranding] = useState({
        typography: { primary: 'Outfit, sans-serif', secondary: 'Inter, sans-serif', mono: 'Space Mono, monospace' },
        colors: [
            { name: 'Primary (Violet)', hex: '#8b5cf6', description: 'Core brand color used for buttons and highlights' },
            { name: 'Secondary (Fuchsia)', hex: '#d946ef', description: 'Accent color for gradients and secondary elements' },
            { name: 'Background Primary', hex: '#050505', description: 'Main application background' },
            { name: 'Background Secondary', hex: '#0a0a0a', description: 'Card and panel background' },
            { name: 'Text Primary', hex: '#f8fafc', description: 'Main heading and body text' },
            { name: 'Text Secondary', hex: '#64748b', description: 'Muted text and metadata' },
        ]
    });
    const [profiles, setProfiles] = useState([]);
    const [uploading, setUploading] = useState(null);
    const [saving, setSaving] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [showProfileInput, setShowProfileInput] = useState(false);
    const fileInputRefs = useRef({});

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

    useEffect(() => {
        fetchBranding();
        fetchProfiles();
    }, []);

    const fetchBranding = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${apiUrl}/api/admin/branding`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'success') {
                setBranding(prev => ({ ...prev, ...data.branding }));
            }
        } catch (e) {
            console.error("Failed to fetch branding:", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchProfiles = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${apiUrl}/api/admin/branding/profiles`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'success') {
                setProfiles(data.profiles);
            }
        } catch (e) {
            console.error("Failed to fetch profiles:", e);
        }
    };

    const handleSaveMain = async () => {
        setSaving(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${apiUrl}/api/admin/branding`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(branding)
            });
            if (res.ok) {
                alert("Branding configuration saved globally!");
            }
        } catch (e) {
            console.error("Save failed:", e);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!profileName.trim()) return;
        setSaving(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${apiUrl}/api/admin/branding/profiles`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: profileName, config: branding })
            });
            if (res.ok) {
                setProfileName('');
                setShowProfileInput(false);
                fetchProfiles();
            }
        } catch (e) {
            console.error("Profile save failed:", e);
        } finally {
            setSaving(false);
        }
    };

    const handleApplyProfile = async (id) => {
        if (!confirm("Apply this profile to the live site? This will overwrite the current branding.")) return;
        setLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${apiUrl}/api/admin/branding/profiles/${id}/apply`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                await fetchBranding();
                alert("Profile applied successfully!");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProfile = async (id) => {
        if (!confirm("Delete this profile forever?")) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${apiUrl}/api/admin/branding/profiles/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchProfiles();
            }
        } catch (e) {
            console.error("Delete failed:", e);
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

    const handleColorChange = (index, field, value) => {
        const newColors = [...branding.colors];
        newColors[index] = { ...newColors[index], [field]: value };
        setBranding(prev => ({ ...prev, colors: newColors }));
    };

    const handleTypoChange = (field, value) => {
        setBranding(prev => ({
            ...prev,
            typography: { ...prev.typography, [field]: value }
        }));
    };

    const copyToClipboard = (hex) => {
        navigator.clipboard.writeText(hex);
        setCopiedColor(hex);
        setTimeout(() => setCopiedColor(null), 2000);
    };

    const getAssetUrl = (path) => {
        if (!path) return '';
        if (path.startsWith('/') && !path.startsWith('/api/')) return path;
        if (path.startsWith('branding/')) return getImageUrl(`/api/public/image/${path}`, apiUrl);
        return getImageUrl(path, apiUrl);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-theme-text-secondary">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p>Loading brand configuration...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-32 max-w-6xl mx-auto">
            {/* Header / Actions */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-theme-bg-secondary/30 p-6 rounded-3xl border border-theme-glass-border">
                <div>
                    <h1 className="text-3xl font-black tracking-tight mb-1">Brand Studio</h1>
                    <p className="text-theme-text-muted text-sm">Design and manage your global visual identity.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setShowProfileInput(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-theme-bg-secondary text-sm font-bold rounded-xl border border-theme-glass-border hover:bg-theme-glass-bg transition-all"
                    >
                        <Bookmark size={16} className="text-violet-400" />
                        Save as Profile
                    </button>
                    <button
                        onClick={handleSaveMain}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-violet-600/20 transition-all disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Global Config
                    </button>
                </div>
            </header>

            {/* Profile Creation Modal/Input */}
            {showProfileInput && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-[#111] border border-white/10 p-6 rounded-3xl shadow-2xl max-w-md w-full space-y-4">
                        <h3 className="text-xl font-bold">New Brand Profile</h3>
                        <p className="text-theme-text-muted text-sm">Enter a name for this visual identity preset.</p>
                        <input
                            autoFocus
                            type="text"
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
                            placeholder="e.g. Winter Holiday Redux"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end pt-2">
                            <button onClick={() => setShowProfileInput(false)} className="px-4 py-2 text-sm text-theme-text-muted hover:text-white">Cancel</button>
                            <button
                                onClick={handleSaveProfile}
                                disabled={!profileName.trim() || saving}
                                className="px-6 py-2 bg-violet-600 rounded-xl text-sm font-bold text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
                            >
                                Save Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-12">
                    {/* Typography Section */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2">
                            <Type className="text-violet-500" size={24} />
                            <h2 className="text-xl font-bold">Typography</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { id: 'primary', name: 'Primary Font', value: branding.typography.primary },
                                { id: 'secondary', name: 'Secondary Font', value: branding.typography.secondary },
                                { id: 'mono', name: 'Mono Font', value: branding.typography.mono }
                            ].map(font => (
                                <div key={font.id} className="bg-theme-bg-secondary p-4 rounded-2xl border border-theme-glass-border">
                                    <label className="text-[10px] font-black text-theme-text-muted uppercase tracking-widest block mb-2">{font.name}</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors font-mono"
                                        value={font.value}
                                        onChange={(e) => handleTypoChange(font.id, e.target.value)}
                                    />
                                    <div className="mt-4 p-3 bg-black/60 rounded-xl h-20 flex items-center justify-center overflow-hidden">
                                        <span style={{ fontFamily: font.value }} className="text-lg truncate">ABCabc 123</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Color Palette */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2">
                            <Palette className="text-violet-500" size={24} />
                            <h2 className="text-xl font-bold">Color Identity</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {branding.colors.map((color, index) => (
                                <div key={index} className="bg-theme-bg-secondary border border-theme-glass-border p-5 rounded-3xl flex flex-col gap-4 group">
                                    <div className="flex items-center gap-4">
                                        <div className="relative group/picker">
                                            <div
                                                className="w-20 h-20 rounded-2xl shadow-lg border border-white/10 flex-shrink-0 cursor-pointer overflow-hidden"
                                                style={{ backgroundColor: color.hex }}
                                            />
                                            <input
                                                type="color"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                value={color.hex}
                                                onChange={(e) => handleColorChange(index, 'hex', e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-2">
                                            <input
                                                type="text"
                                                className="w-full bg-transparent font-bold text-base text-white border-b border-white/5 focus:border-violet-500 focus:outline-none pb-1"
                                                value={color.name}
                                                onChange={(e) => handleColorChange(index, 'name', e.target.value)}
                                            />
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    className="w-24 bg-black/40 border border-white/10 rounded-md px-2 py-0.5 text-xs font-mono text-violet-400 font-bold uppercase"
                                                    value={color.hex}
                                                    onChange={(e) => handleColorChange(index, 'hex', e.target.value)}
                                                />
                                                <button
                                                    onClick={() => copyToClipboard(color.hex)}
                                                    className="text-theme-text-muted hover:text-white transition-colors"
                                                >
                                                    {copiedColor === color.hex ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <textarea
                                        className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-[11px] text-theme-text-muted leading-relaxed focus:outline-none focus:border-white/20 h-16 resize-none"
                                        value={color.description}
                                        onChange={(e) => handleColorChange(index, 'description', e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="space-y-8">
                    {/* Profiles Management Sidebar */}
                    <section className="bg-theme-bg-secondary/50 border border-theme-glass-border rounded-3xl p-6 sticky top-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Bookmark className="text-violet-500" size={20} />
                                <h2 className="text-lg font-bold">Brand Profiles</h2>
                            </div>
                            <button onClick={fetchProfiles} className="p-1.5 rounded-lg hover:bg-white/5 text-theme-text-muted">
                                <RefreshCcw size={14} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {profiles.length === 0 ? (
                                <div className="text-center py-8 px-4 border border-dashed border-white/10 rounded-2xl">
                                    <p className="text-xs text-theme-text-muted italic">No profiles saved yet.</p>
                                </div>
                            ) : (
                                profiles.map(profile => (
                                    <div key={profile.id} className="group bg-black/40 border border-white/5 rounded-2xl p-4 hover:border-violet-500/30 transition-all">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-sm truncate">{profile.name}</h4>
                                                <p className="text-[10px] text-theme-text-muted mt-0.5">{new Date(profile.createdAt).toLocaleDateString()}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteProfile(profile.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => handleApplyProfile(profile.id)}
                                            className="w-full py-2 bg-theme-glass-bg border border-white/5 rounded-xl text-[11px] font-bold hover:bg-violet-600 hover:text-white transition-all"
                                        >
                                            Apply Profile
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </div>

            {/* Asset Management - Detailed Grid */}
            <section className="space-y-6 pt-10 border-t border-theme-glass-border">
                <div className="flex items-center gap-2">
                    <ImageIcon className="text-violet-500" size={24} />
                    <h2 className="text-xl font-bold">Brand Assets</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[
                        { id: 'logo', name: 'Logo', size: '1024x1024', format: 'PNG' },
                        { id: 'favicon', name: 'Favicon', size: '32x32', format: 'PNG' },
                        { id: 'apple', name: 'Apple', size: '180x180', format: 'PNG' },
                        { id: 'pwa-192', name: 'PWA-192', size: '192x192', format: 'PNG' },
                        { id: 'pwa-512', name: 'PWA-512', size: '512x512', format: 'PNG' }
                    ].map(asset => (
                        <div key={asset.id} className="bg-theme-bg-secondary border border-theme-glass-border rounded-2xl overflow-hidden group flex flex-col">
                            <div className="aspect-square bg-black/40 flex items-center justify-center p-6 relative">
                                <img
                                    src={getAssetUrl(branding[asset.id]) || getAssetUrl(`/${asset.id === 'apple' ? 'apple-touch-icon' : (asset.id.startsWith('pwa') ? 'icon-' + asset.id.split('-')[1] : asset.id)}.png`)}
                                    alt={asset.name}
                                    className="max-w-full max-h-full object-contain"
                                />
                                {uploading === asset.id && (
                                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm">
                                        <Loader2 className="animate-spin text-white" size={20} />
                                    </div>
                                )}
                            </div>
                            <div className="p-3 bg-black/20 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-theme-text-muted">{asset.name}</span>
                                    <button
                                        onClick={() => fileInputRefs.current[asset.id].click()}
                                        className="p-1.5 rounded-lg bg-violet-600/10 text-violet-400 hover:bg-violet-600/30 transition-all border border-violet-500/10"
                                    >
                                        <Upload size={12} />
                                    </button>
                                </div>
                                <input
                                    type="file"
                                    ref={el => fileInputRefs.current[asset.id] = el}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleUpload(asset.id, e.target.files[0])}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
