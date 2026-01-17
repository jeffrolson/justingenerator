import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Save, RefreshCw, Users, Gift, Share2, ArrowRight } from 'lucide-react';

export function Referrals() {
    const { getToken } = useAuth();
    const [settings, setSettings] = useState({
        referralCredits: 10,
        featureFlags: { referrals: true }
    });
    const [referrals, setReferrals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const fetchData = async () => {
        try {
            const token = await getToken();

            // Fetch settings
            const settingsRes = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/settings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const settingsJson = await settingsRes.json();
            if (settingsJson.status === 'success') {
                setSettings({
                    referralCredits: settingsJson.settings.referralCredits || 10,
                    featureFlags: settingsJson.settings.featureFlags || { referrals: true }
                });
            }

            // Fetch referral history
            const referralsRes = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/referrals`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const referralsJson = await referralsRes.json();
            if (referralsJson.status === 'success') {
                setReferrals(referralsJson.referrals || []);
            }
        } catch (e) {
            console.error("Failed to load referral data", e);
            setMessage({ type: 'error', text: 'Failed to load referral data.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
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
                setMessage({ type: 'success', text: 'Referral settings saved successfully.' });
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

    if (loading) return <div className="text-theme-text-primary text-center p-8 text-sm">Loading Referral System...</div>;

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Control Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm h-fit">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 bg-amber-500/20 rounded-lg text-amber-300">
                            <Gift size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-theme-text-primary">Referral Configuration</h3>
                            <p className="text-theme-text-secondary text-sm">Set rewards and toggle the entire system</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-theme-bg-primary/50 border border-theme-glass-border">
                            <div>
                                <div className="font-semibold text-theme-text-primary">Enable Referral System</div>
                                <div className="text-sm text-theme-text-secondary">Allow users to invite friends and earn credits</div>
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
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                            </label>
                        </div>

                        <div className="p-6 rounded-xl bg-white/5 border border-white/5 space-y-4">
                            <label className="block">
                                <span className="text-sm font-medium text-gray-300 block mb-2">Credits per Referral</span>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        className="bg-theme-bg-primary/50 border border-theme-glass-border rounded-lg px-4 py-2 text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-amber-500/50 w-32 font-mono text-lg"
                                        value={settings.referralCredits}
                                        onChange={(e) => setSettings({ ...settings, referralCredits: parseInt(e.target.value) || 0 })}
                                    />
                                    <span className="text-theme-text-secondary text-sm">Credits will be granted to both the referrer and the new user.</span>
                                </div>
                            </label>
                        </div>
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
                            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-amber-500/20"
                        >
                            {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-6 h-fit">
                        <div className="flex items-center gap-3 mb-4 text-violet-300">
                            <Users size={20} />
                            <h4 className="font-bold">Summary</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-theme-glass-border pb-3">
                                <span className="text-theme-text-secondary text-sm">Total Referrals</span>
                                <span className="text-2xl font-bold font-mono text-theme-text-primary">{referrals.length}</span>
                            </div>
                            <div className="flex justify-between items-end border-b border-theme-glass-border pb-3">
                                <span className="text-theme-text-secondary text-sm">Total Credits Awarded</span>
                                <span className="text-2xl font-bold font-mono text-violet-400">
                                    {referrals.reduce((acc, curr) => acc + (curr.amount || 0), 0) * 2}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-theme-bg-secondary/50 border border-theme-glass-border rounded-2xl p-6 h-fit text-sm text-theme-text-secondary space-y-3">
                        <p>
                            <strong className="text-theme-text-primary">Note:</strong> Disabling the system only prevents the dashboard card from showing and stops new referrals from being tracked.
                        </p>
                        <p>
                            Existing referral credits already granted will remain in user accounts.
                        </p>
                    </div>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-theme-bg-secondary/50 border border-theme-glass-border rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="px-8 py-6 border-b border-theme-glass-border flex justify-between items-center">
                    <h3 className="text-lg font-bold text-theme-text-primary flex items-center gap-2">
                        <Share2 size={18} className="text-theme-text-secondary" />
                        Referral History
                    </h3>
                    <button
                        onClick={fetchData}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-theme-bg-primary/50 text-theme-text-secondary text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-4 pl-8">Referrer (UID)</th>
                                <th className="p-4 text-center"></th>
                                <th className="p-4">Referred (UID)</th>
                                <th className="p-4 font-mono text-right">Reward</th>
                                <th className="p-4 pr-8 text-right">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {referrals.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-500 italic">No referrals recorded yet.</td>
                                </tr>
                            ) : (
                                referrals.map(ref => (
                                    <tr key={ref.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 pl-8 font-mono text-xs text-violet-300">
                                            {ref.referrerId}
                                        </td>
                                        <td className="p-4 text-center">
                                            <ArrowRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors inline-block" />
                                        </td>
                                        <td className="p-4 font-mono text-xs text-amber-300">
                                            {ref.referredId}
                                        </td>
                                        <td className="p-4 font-mono text-right text-sm">
                                            +{ref.amount} Credits
                                        </td>
                                        <td className="p-4 pr-8 text-right text-xs text-theme-text-secondary">
                                            {new Date(ref.timestamp).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
