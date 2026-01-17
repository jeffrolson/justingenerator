import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Save, RefreshCw, ShieldCheck, Cpu, MessageCircle, Layers } from 'lucide-react';

export function Settings() {
    const { getToken } = useAuth();
    const [settings, setSettings] = useState({
        imageModel: 'gemini-2.5-flash-image',
        featureFlags: { dailyRewards: true, referrals: true }
    });
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
        <div className="max-w-[1600px] mx-auto space-y-8">
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
                        {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>

            {/* Feature Flags */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-300">
                        <Layers size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Feature Management</h3>
                        <p className="text-gray-400 text-sm">Control availability of specific platform features</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Daily Rewards */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5">
                        <div>
                            <div className="font-semibold text-white">Daily Rewards</div>
                            <div className="text-sm text-gray-500">Enable daily credit claiming</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.featureFlags?.dailyRewards ?? true}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    featureFlags: { ...settings.featureFlags, dailyRewards: e.target.checked }
                                })}
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>

                    {/* Referrals */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5">
                        <div>
                            <div className="font-semibold text-white">Referral System</div>
                            <div className="text-sm text-gray-500">Enable invite links & rewards</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.featureFlags?.referrals ?? true}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    featureFlags: { ...settings.featureFlags, referrals: e.target.checked }
                                })}
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>
                </div>
            </div >

            {/* Telegram Settings */}
            < div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm" >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-300">
                        <MessageCircle size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Telegram Notifications</h3>
                        <p className="text-gray-400 text-sm">Manage real-time alerts sent to your admin channel</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Master Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5">
                        <div>
                            <div className="font-semibold text-white">Enable Notifications</div>
                            <div className="text-sm text-gray-500">Master switch for all Telegram alerts</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.telegram?.enabled ?? true}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    telegram: { ...settings.telegram, enabled: e.target.checked }
                                })}
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {/* Event Selection */}
                    <div className={`space-y-3 transition-opacity duration-300 ${!settings.telegram?.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider pl-1">Notification Events</div>

                        <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                                checked={settings.telegram?.events?.includes('signup') ?? true}
                                onChange={(e) => {
                                    const currentEvents = settings.telegram?.events || ['signup'];
                                    const newEvents = e.target.checked
                                        ? [...currentEvents, 'signup']
                                        : currentEvents.filter(ev => ev !== 'signup');
                                    setSettings({
                                        ...settings,
                                        telegram: { ...settings.telegram, events: newEvents }
                                    });
                                }}
                            />
                            <div>
                                <div className="text-white font-medium">New User Signup</div>
                                <div className="text-xs text-gray-500">Get alerted whenever a new user registers</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                                checked={settings.telegram?.events?.includes('payment') ?? false}
                                onChange={(e) => {
                                    const currentEvents = settings.telegram?.events || ['signup'];
                                    const newEvents = e.target.checked
                                        ? [...currentEvents, 'payment']
                                        : currentEvents.filter(ev => ev !== 'payment');
                                    setSettings({
                                        ...settings,
                                        telegram: { ...settings.telegram, events: newEvents }
                                    });
                                }}
                            />
                            <div>
                                <div className="text-white font-medium">New Payment</div>
                                <div className="text-xs text-gray-500">Get notified when a user makes a purchase</div>
                            </div>
                        </label>
                    </div>

                    {/* Test Button */}
                    <div className="pt-4 border-t border-white/10">
                        <button
                            onClick={async () => {
                                try {
                                    setMessage({ type: 'info', text: 'Sending test message...' });
                                    const token = await getToken();
                                    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/test-telegram`, {
                                        method: 'POST',
                                        headers: { Authorization: `Bearer ${token}` }
                                    });
                                    if (res.ok) {
                                        setMessage({ type: 'success', text: 'Test message sent! Check your Telegram.' });
                                    } else {
                                        const err = await res.json();
                                        throw new Error(err.error || 'Failed to send test');
                                    }
                                } catch (e) {
                                    setMessage({ type: 'error', text: `Test failed: ${e.message}` });
                                }
                            }}
                            className="text-sm font-medium text-blue-400 hover:text-blue-300 flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-blue-500/10 transition-colors w-fit"
                        >
                            <span className="text-lg">🔔</span> Send Test Notification
                        </button>
                    </div>
                </div>
            </div >

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 flex gap-4">
                <div className="p-2 bg-amber-500/20 rounded-lg h-fit text-amber-500">
                    <RefreshCw size={20} />
                </div>
                <div>
                    <h4 className="font-semibold text-white mb-1">Configuration Sync</h4>
                    <p className="text-sm text-gray-400">
                        Settings are cached globally. Updates may take a few seconds to propagate to all edge nodes.
                    </p>
                </div>
            </div>
        </div >
    );
}
