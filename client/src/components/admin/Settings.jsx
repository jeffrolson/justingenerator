import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Save, RefreshCcw, ShieldCheck, Cpu } from 'lucide-react';

export function Settings() {
    const { getToken } = useAuth();
    const [settings, setSettings] = useState({ imageModel: 'gemini-2.5-flash-image' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const availableModels = [
        { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', description: 'Fastest, optimized for image generation. Recommended default.' },
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp', description: 'Experimental faster model with newer architecture.' },
        { id: 'gemini-exp-1206', name: 'Gemini Exp 1206', description: 'New experimental model (Dec 2024).' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Highest quality, more reasoning, but slower.' },
    ];

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const token = await getToken();
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/settings`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const json = await res.json();
                if (json.status === 'success') {
                    setSettings(json.settings);
                }
            } catch (e) {
                console.error("Failed to load settings", e);
                setMessage({ type: 'error', text: 'Failed to load settings.' });
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            const token = await getToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });
            const json = await res.json();
            if (json.status === 'success') {
                setMessage({ type: 'success', text: 'Settings saved successfully.' });
            } else {
                throw new Error(json.error || 'Failed to save settings');
            }
        } catch (e) {
            console.error("Save failed", e);
            setMessage({ type: 'error', text: e.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-white text-center p-8">Loading Settings...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-violet-500/20 rounded-lg text-violet-300">
                        <Cpu size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Model Configuration</h3>
                        <p className="text-gray-400 text-sm">Choose the underlying AI model for image generation</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {availableModels.map((model) => (
                        <label
                            key={model.id}
                            className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${settings.imageModel === model.id
                                    ? 'bg-violet-600/10 border-violet-500/50 text-white'
                                    : 'bg-black/20 border-white/5 text-gray-400 hover:border-white/20'
                                }`}
                        >
                            <input
                                type="radio"
                                name="imageModel"
                                value={model.id}
                                checked={settings.imageModel === model.id}
                                onChange={(e) => setSettings({ ...settings, imageModel: e.target.value })}
                                className="mt-1 accent-violet-500"
                            />
                            <div className="flex-1">
                                <div className="font-semibold mb-1">{model.name}</div>
                                <div className="text-xs text-gray-500">{model.description}</div>
                            </div>
                            {settings.imageModel === model.id && (
                                <ShieldCheck size={18} className="text-violet-400" />
                            )}
                        </label>
                    ))}
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
                    <div className="text-sm">
                        {message.text && (
                            <span className={message.type === 'error' ? 'text-red-400' : 'text-green-400'}>
                                {message.text}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-violet-500/20"
                    >
                        {saving ? <RefreshCcw className="animate-spin" size={20} /> : <Save size={20} />}
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 flex gap-4">
                <div className="p-2 bg-amber-500/20 rounded-lg h-fit text-amber-500">
                    <RefreshCcw size={20} />
                </div>
                <div>
                    <h4 className="font-semibold text-white mb-1">Propagation Delay</h4>
                    <p className="text-sm text-gray-400">
                        Changes to the image model take effect immediately for all new generation requests.
                        Ongoing batch jobs will continue using the model configured at the start of the job.
                    </p>
                </div>
            </div>
        </div>
    );
}
