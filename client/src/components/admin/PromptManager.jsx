import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Trash2, Plus, Upload, X, Download, FileSpreadsheet, Edit2, MoreVertical, Search } from 'lucide-react';

export function PromptManager() {
    const { getToken } = useAuth();
    const [prompts, setPrompts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        prompt: '',
        tags: '',
        category: 'Photorealistic',
        image: null
    });
    const [previewUrl, setPreviewUrl] = useState(null);

    const fetchPrompts = useCallback(async () => {
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
    }, [getToken]);

    useEffect(() => {
        fetchPrompts();
    }, [fetchPrompts]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({ ...prev, image: file }));
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleEdit = (prompt) => {
        try {
            console.log("Editing prompt:", prompt.id);
            setEditingId(prompt.id);

            // Format tags defensively - handle arrays, strings, or nulls
            let tagString = '';
            if (Array.isArray(prompt.tags)) {
                tagString = prompt.tags.join(', ');
            } else if (typeof prompt.tags === 'string') {
                tagString = prompt.tags;
            }

            setFormData({
                name: prompt.name || '',
                prompt: prompt.prompt || '',
                tags: tagString,
                category: prompt.category || 'Photorealistic',
                image: null
            });

            setPreviewUrl(
                prompt.imageUrl ? (prompt.imageUrl.startsWith('http') ? prompt.imageUrl : `${import.meta.env.VITE_API_URL}/api/image/${encodeURIComponent(prompt.imageUrl)}`) : null
            );

            setShowForm(true);

            // Ensure the user sees the form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error("Error in handleEdit:", err);
            alert("Failed to open edit form: " + err.message);
        }
    };

    const resetForm = (shouldClose = true) => {
        setFormData({ name: '', prompt: '', tags: '', category: 'Photorealistic', image: null });
        setPreviewUrl(null);
        setEditingId(null);
        if (shouldClose && shouldClose !== false) {
            setShowForm(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.prompt) return;

        try {
            setSubmitting(true);
            const token = await getToken();
            const body = new FormData();
            body.append('name', formData.name);
            body.append('prompt', formData.prompt);
            body.append('tags', formData.tags);
            body.append('category', formData.category);
            if (formData.image) {
                body.append('image', formData.image);
            }

            const url = editingId
                ? `${import.meta.env.VITE_API_URL}/api/admin/prompts/${editingId}`
                : `${import.meta.env.VITE_API_URL}/api/admin/prompts`;

            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: { Authorization: `Bearer ${token}` },
                body: body
            });

            if (!res.ok) throw new Error(`Failed to ${editingId ? 'update' : 'create'} prompt`);

            resetForm();
            fetchPrompts();
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

    const handleExportCSV = () => {
        const headers = ['Name', 'Prompt', 'Tags', 'Category', 'Created At', 'Generations'];
        const csvContent = [
            headers.join(','),
            ...prompts.map(p => {
                const tags = p.tags ? `"${p.tags.join(',')}"` : '';
                const promptText = p.prompt ? `"${p.prompt.replace(/"/g, '""')}"` : '';
                const category = p.category || 'Uncategorized';
                return `"${p.name}",${promptText},${tags},"${category}",${p.createdAt},${p.generationsCount || 0}`;
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prompts_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const handleImportCSV = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const lines = text.split('\n');
            // const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

            // Basic CSV parsing (not robust for all edge cases but good for simple imports)
            const newPrompts = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                // Very simple splitting, assumes no commas in values or quotes handled simply
                // For better parsing, we'd need a library or regex splitter
                // Assuming format: Name, Prompt, Tags
                // Let's rely on user putting quotes for prompts with commas: "Prompt, content"

                // Quick Regex split handling quotes
                const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                if (!row) continue;

                // Map based on assumed order if headers present, or just index
                // Assume standard order: Name, Prompt, Tags
                const name = row[0]?.replace(/^"|"$/g, '');
                const prompt = row[1]?.replace(/^"|"$/g, '').replace(/""/g, '"');
                const tags = row[2]?.replace(/^"|"$/g, '');

                if (name && prompt) {
                    newPrompts.push({ name, prompt, tags });
                }
            }

            if (newPrompts.length === 0) {
                alert("No valid prompts found in CSV");
                return;
            }

            if (!window.confirm(`Found ${newPrompts.length} prompts to import. Proceed?`)) return;

            setSubmitting(true);
            try {
                const token = await getToken();
                // Sequential execution to avoid rate limits
                for (const p of newPrompts) {
                    const body = new FormData();
                    body.append('name', p.name);
                    body.append('prompt', p.prompt);
                    body.append('tags', p.tags);
                    // No image for CSV import currently
                    // Maybe default image? 

                    await fetch(`${import.meta.env.VITE_API_URL}/api/admin/prompts`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: body
                    });
                }
                alert('Import Complete!');
                fetchPrompts();
            } catch (e) {
                alert(`Import failed: ${e.message}`);
            } finally {
                setSubmitting(false);
            }
        };
        reader.readAsText(file);
    };

    const filteredPrompts = prompts.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.prompt?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddPreset = () => {
        if (showForm) {
            resetForm();
        } else {
            resetForm(false);
            setShowForm(true);
        }
    };

    return (
        <div className="text-white max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-bold">Prompt Management</h2>
                    <p className="text-gray-400 text-sm mt-1">Manage generation presets and view usage stats</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 relative z-10">
                    <label className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg cursor-pointer transition-colors border border-white/10">
                        <Upload size={18} className="text-violet-400" />
                        <span className="text-sm font-medium">Import CSV</span>
                        <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
                    </label>
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg transition-colors border border-white/10"
                    >
                        <Download size={18} className="text-green-400" />
                        <span className="text-sm font-medium">Export CSV</span>
                    </button>
                    <button
                        onClick={handleAddPreset}
                        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-lg transition-colors shadow-lg shadow-violet-900/20"
                    >
                        {showForm ? <X size={20} /> : <Plus size={20} />}
                        <span className="font-medium">{showForm ? 'Cancel' : 'Add Preset'}</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/20 text-red-200 p-4 rounded-lg mb-6 flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError(null)}><X size={18} /></button>
                </div>
            )}

            {showForm && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8 backdrop-blur-sm animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-xl font-semibold mb-6">{editingId ? 'Edit Preset' : 'Create New Preset'}</h3>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                                        className="w-full h-40 bg-black/20 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors resize-none font-mono text-sm leading-relaxed"
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
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500 transition-colors text-white"
                                    >
                                        <option value="Photorealistic">Photorealistic</option>
                                        <option value="Digital Art">Digital Art</option>
                                        <option value="Artistic">Artistic</option>
                                        <option value="Cinematic">Cinematic</option>
                                        <option value="Uncategorized">Uncategorized</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-sm text-gray-400 mb-1">Reference Image {editingId && '(Leave empty to keep existing)'}</label>
                                <div className={`
                  border-2 border-dashed border-white/10 rounded-xl aspect-square flex flex-col items-center justify-center
                  ${!previewUrl ? 'hover:border-violet-500/50 hover:bg-white/5' : 'border-violet-500'}
                  transition-all cursor-pointer relative overflow-hidden group bg-black/20
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
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-center p-4">
                                                <Upload className="w-8 h-8 text-white mb-2" />
                                                <span className="text-white font-medium">Click to Update Image</span>
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

                        <div className="flex justify-end pt-4 border-t border-white/10 gap-3">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-6 py-2.5 rounded-lg font-medium text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-900/20"
                            >
                                {submitting ? 'Saving...' : (editingId ? 'Update Preset' : 'Create Preset')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                    type="text"
                    placeholder="Search presets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-violet-500 transition-colors"
                />
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-black/20">
                                    <th className="p-4 font-semibold text-gray-400 text-sm">Image</th>
                                    <th className="p-4 font-semibold text-gray-400 text-sm">Preset Name</th>
                                    <th className="p-4 font-semibold text-gray-400 text-sm w-1/4">Prompt</th>
                                    <th className="p-4 font-semibold text-gray-400 text-sm">Category</th>
                                    <th className="p-4 font-semibold text-gray-400 text-sm">Tags</th>
                                    <th className="p-4 font-semibold text-gray-400 text-sm text-center">Generations</th>
                                    <th className="p-4 font-semibold text-gray-400 text-sm text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPrompts.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-gray-500">
                                            No presets found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPrompts.map(prompt => (
                                        <tr key={prompt.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                            <td className="p-4">
                                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/40 border border-white/10">

                                                    {
                                                        prompt.imageUrl ? (
                                                            <img
                                                                src={prompt.imageUrl.startsWith('http')
                                                                    ? prompt.imageUrl
                                                                    : `${(import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '')}/api/image/${encodeURIComponent(prompt.imageUrl)}`
                                                                }
                                                                alt={prompt.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">No Img</div>
                                                        )
                                                    }
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-semibold text-white">{prompt.name}</div>
                                                <div className="text-xs text-gray-500">ID: {prompt.id.substring(0, 6)}...</div>
                                            </td>
                                            <td className="p-4 text-gray-300 text-sm">
                                                <div className="line-clamp-2 max-w-sm" title={prompt.prompt}>{prompt.prompt}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className="inline-block px-2 py-1 bg-white/5 rounded text-xs text-gray-300 border border-white/10">
                                                    {prompt.category || 'Uncategorized'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {(Array.isArray(prompt.tags) ? prompt.tags : []).slice(0, 3).map((tag, i) => (
                                                        <span key={i} className="text-xs bg-white/10 text-gray-400 px-1.5 py-0.5 rounded">#{tag}</span>
                                                    ))}
                                                    {Array.isArray(prompt.tags) && prompt.tags.length > 3 && <span className="text-xs text-gray-500">+{prompt.tags.length - 3}</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                                    {prompt.generationsCount || 0}
                                                </div>
                                                {prompt.updatedAt && (
                                                    <div className="text-[10px] text-gray-600 mt-1">
                                                        Upd: {new Date(prompt.updatedAt).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEdit(prompt);
                                                        }}
                                                        className="p-2 bg-theme-bg-secondary text-theme-text-muted hover:text-violet-400 hover:border-violet-500/50 rounded-lg border border-theme-glass-border transition-all flex items-center justify-center cursor-pointer"
                                                        title="Edit Template"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(prompt.id);
                                                        }}
                                                        className="p-2 bg-theme-bg-secondary text-theme-text-muted hover:text-red-400 hover:border-red-500/50 rounded-lg border border-theme-glass-border transition-all flex items-center justify-center cursor-pointer"
                                                        title="Delete Template"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
