import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Trash2, Plus, Upload, X } from 'lucide-react';

export function PromptManager() {
    const { user, getToken } = useAuth();
    const [prompts, setPrompts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        prompt: '',
        tags: '',
        image: null
    });
    const [previewUrl, setPreviewUrl] = useState(null);

    const fetchPrompts = async () => {
        try {
            setLoading(true);
            const token = await getToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/prompts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch prompts');
            const data = await res.json();
            setPrompts(data.prompts || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrompts();
    }, []);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({ ...prev, image: file }));
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.image || !formData.name || !formData.prompt) return;

        try {
            setSubmitting(true);
            const token = await getToken();
            const body = new FormData();
            body.append('name', formData.name);
            body.append('prompt', formData.prompt);
            body.append('tags', formData.tags);
            body.append('image', formData.image);

            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/prompts`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: body
            });

            if (!res.ok) throw new Error('Failed to create prompt');

            // Reset Form
            setFormData({ name: '', prompt: '', tags: '', image: null });
            setPreviewUrl(null);
            setShowForm(false);
            fetchPrompts(); // Refresh list
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this prompt?')) return;
        try {
            const token = await getToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/prompts/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to delete prompt');
            fetchPrompts();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="text-white max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">Prompt Management</h2>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
                >
                    {showForm ? <X size={20} /> : <Plus size={20} />}
                    {showForm ? 'Cancel' : 'Add New Preset'}
                </button>
            </div>

            {error && (
                <div className="bg-red-500/20 text-red-200 p-4 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {showForm && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8 backdrop-blur-sm animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-xl font-semibold mb-6">Create New Preset</h3>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Preset Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors"
                                        placeholder="e.g. Cyberpunk"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Prompt Template</label>
                                    <textarea
                                        required
                                        value={formData.prompt}
                                        onChange={e => setFormData({ ...formData, prompt: e.target.value })}
                                        className="w-full h-32 bg-black/20 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                                        placeholder="Detailed prompt description..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Tags (comma separated)</label>
                                    <input
                                        type="text"
                                        value={formData.tags}
                                        onChange={e => setFormData({ ...formData, tags: e.target.value })}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors"
                                        placeholder="neon, sci-fi, futuristic"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-sm text-gray-400 mb-1">Reference Image</label>
                                <div className={`
                  border-2 border-dashed border-white/10 rounded-xl aspect-square flex flex-col items-center justify-center
                  ${!previewUrl ? 'hover:border-violet-500/50 hover:bg-white/5' : 'border-violet-500'}
                  transition-all cursor-pointer relative overflow-hidden group
                `}>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    {previewUrl ? (
                                        <>
                                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-white font-medium">Click to Change</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-6">
                                            <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                                            <p className="text-gray-400 font-medium">Upload Reference Image</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-white/10">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Creating...' : 'Create Preset'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {prompts.map(prompt => (
                        <div key={prompt.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden group hover:border-violet-500/30 transition-all">
                            <div className="aspect-video relative overflow-hidden bg-black/40">
                                {prompt.imageUrl ? (
                                    <img
                                        src={prompt.imageUrl.startsWith('http') ? prompt.imageUrl : `${import.meta.env.VITE_API_URL}/api/image/${encodeURIComponent(prompt.imageUrl)}`}
                                        alt={prompt.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600">No Image</div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                                    <button
                                        onClick={() => handleDelete(prompt.id)}
                                        className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-lg backdrop-blur-sm transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-white mb-1">{prompt.name}</h3>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {prompt.tags.map((tag, i) => (
                                        <span key={i} className="text-xs bg-white/10 text-gray-300 px-2 py-1 rounded">#{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
