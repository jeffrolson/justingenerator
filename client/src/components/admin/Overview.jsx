import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { TrendingUp, Users, DollarSign, Activity, AlertCircle, Zap, Wallet, Calendar, ExternalLink, Cloud, Globe, Trash2, Edit2, X } from 'lucide-react';

const KPICard = ({ title, value, trend, icon: Icon, color, label }) => (
    <div className="bg-theme-bg-secondary/50 border border-theme-glass-border rounded-lg p-4 backdrop-blur-sm hover:bg-theme-glass-bg transition-colors">
        <div className="flex justify-between items-start mb-2">
            <div className={`p-1.5 rounded bg-opacity-20 ${color}`}>
                <Icon size={16} className={color.replace('bg-', 'text-')} />
            </div>
            {trend !== undefined && trend !== 0 && (
                <span className={`text-[11px] font-semibold ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trend > 0 ? '↑' : '↓'}{Math.abs(trend)}%
                </span>
            )}
        </div>
        <div className="text-xl font-bold text-theme-text-primary leading-tight">{value}</div>
        <div className="text-[10px] text-theme-text-secondary uppercase tracking-tighter mt-1 truncate" title={label || title}>
            {title}
        </div>
        {label && label !== title && (
            <div className="text-[9px] text-theme-text-muted mt-0.5 truncate">{label}</div>
        )}
    </div>
);

export function Overview() {
    const { getToken } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('7d');

    const loadData = async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/kpis?range=${range}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.status === 'success') {
                setData(json);
            }
        } catch (e) {
            console.error("Failed to load KPIs", e);
        } finally {
            setLoading(false);
        }
    };

    const [syncing, setSyncing] = useState(false);
    const handleSync = async () => {
        setSyncing(true);
        try {
            const token = await getToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/aggregate?last30=true&full=true`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                await loadData();
            } else {
                alert("Sync failed: " + (await res.text()));
            }
        } catch (e) {
            console.error("Sync failed", e);
            alert("Sync failed: " + e.message);
        } finally {
            setSyncing(false);
        }
    };

    const [showLinkManager, setShowLinkManager] = useState(false);
    const [editingLink, setEditingLink] = useState(null);
    const [saveLoading, setSaveLoading] = useState(false);

    const handleSaveLinks = async (updatedLinks) => {
        setSaveLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ platformLinks: updatedLinks })
            });
            if (res.ok) {
                setPlatformLinks(updatedLinks);
                setShowLinkManager(false);
            }
        } catch (e) {
            console.error("Failed to save links", e);
        } finally {
            setSaveLoading(false);
        }
    };

    if (loading && !data) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-theme-text-primary">
            <Activity size={48} className="animate-spin text-indigo-500 mb-4" />
            <div className="text-xl font-medium animate-pulse">Loading Analytics...</div>
        </div>
    );

    if (!data) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-white/50 bg-white/5 rounded-xl border border-white/10">
            <AlertCircle size={48} className="text-red-500 mb-4" />
            <div className="text-xl font-medium">Failed to load analytics data</div>
            <button onClick={loadData} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                Retry Loading
            </button>
        </div>
    );

    const { kpis, charts } = data;

    return (
        <div className={`relative space-y-6 max-w-[1600px] mx-auto transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            {/* Link Manager Modal */}
            {showLinkManager && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-[#111] border border-white/10 p-6 rounded-3xl shadow-2xl max-w-2xl w-full space-y-6 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">Manage Platform Links</h3>
                                <p className="text-theme-text-muted text-xs mt-1">Add or edit external tools displayed on the dashboard.</p>
                            </div>
                            <button onClick={() => setShowLinkManager(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-theme-text-muted hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                            {platformLinks.map((link, index) => (
                                <div key={index} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-4 group">
                                    <div className={`p-2 rounded bg-opacity-20 ${link.color.replace('text-', 'bg-')}`}>
                                        {(() => {
                                            const Icon = IconMap[link.icon] || Globe;
                                            return <div className={link.color}><Icon size={18} /></div>;
                                        })()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm">{link.label}</div>
                                        <div className="text-[10px] text-theme-text-muted truncate">{link.href}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setEditingLink({ ...link, index })}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-theme-text-muted hover:text-white"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleSaveLinks(platformLinks.filter((_, i) => i !== index))}
                                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-500/60 hover:text-red-500"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {!editingLink && (
                                <button
                                    onClick={() => setEditingLink({ label: '', href: '', icon: 'Globe', color: 'text-orange-500', isNew: true })}
                                    className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-theme-text-muted hover:border-violet-500/40 hover:text-violet-400 transition-all flex flex-col items-center justify-center gap-2"
                                >
                                    <Zap size={20} />
                                    <span className="text-xs font-bold uppercase tracking-widest">Add New Link</span>
                                </button>
                            )}
                        </div>

                        {editingLink && (
                            <div className="bg-theme-bg-secondary border border-theme-glass-border p-5 rounded-3xl space-y-4 animate-in slide-in-from-bottom-4">
                                <h4 className="font-bold text-sm text-violet-400 uppercase tracking-widest">
                                    {editingLink.isNew ? 'Create New Link' : 'Edit Link'}
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-theme-text-muted uppercase tracking-widest px-1">Label</label>
                                        <input
                                            type="text"
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                                            value={editingLink.label}
                                            onChange={e => setEditingLink({ ...editingLink, label: e.target.value })}
                                            placeholder="e.g. Analytics"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-theme-text-muted uppercase tracking-widest px-1">Icon ID</label>
                                        <select
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                                            value={editingLink.icon}
                                            onChange={e => setEditingLink({ ...editingLink, icon: e.target.value })}
                                        >
                                            {Object.keys(IconMap).map(icon => (
                                                <option key={icon} value={icon}>{icon}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-theme-text-muted uppercase tracking-widest px-1">Destination URL</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                                        value={editingLink.href}
                                        onChange={e => setEditingLink({ ...editingLink, href: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="flex gap-2 justify-end pt-2">
                                    <button onClick={() => setEditingLink(null)} className="px-4 py-2 text-xs font-bold text-theme-text-muted hover:text-white transition-colors">Cancel</button>
                                    <button
                                        onClick={() => {
                                            const newList = [...platformLinks];
                                            if (editingLink.isNew) {
                                                const { isNew, ...linkData } = editingLink;
                                                newList.push(linkData);
                                            } else {
                                                const { index, ...linkData } = editingLink;
                                                newList[index] = linkData;
                                            }
                                            handleSaveLinks(newList);
                                            setEditingLink(null);
                                        }}
                                        className="px-6 py-2 bg-violet-600 rounded-xl text-xs font-bold text-white hover:bg-violet-500 transition-colors"
                                    >
                                        Apply Changes
                                    </button>
                                </div>
                            </div>
                        )}

                        {!editingLink && (
                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={() => setShowLinkManager(false)}
                                    className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* KPI Grid - High Density */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                <KPICard
                    title="Active Users"
                    value={kpis.activeUsers.value}
                    trend={kpis.activeUsers.trend}
                    icon={Users}
                    color="bg-blue-500"
                    label={kpis.activeUsers.label}
                />
                <KPICard
                    title="Revenue (Range)"
                    value={`$${kpis.revenue.value}`}
                    trend={kpis.revenue.trend}
                    icon={DollarSign}
                    color="bg-green-500"
                    label={`All Time: $${kpis.allTime.revenue}`}
                />
                <KPICard
                    title="New Signups"
                    value={kpis.newUsers.value}
                    trend={kpis.newUsers.trend}
                    icon={TrendingUp}
                    color="bg-violet-500"
                    label={kpis.newUsers.label}
                />
                <KPICard
                    title="Tokens Used"
                    value={kpis.tokens.value}
                    trend={kpis.tokens.trend}
                    icon={Zap}
                    color="bg-amber-500"
                    label={`All Time: ${kpis.allTime.tokens}`}
                />
                <KPICard
                    title="Usage Cost"
                    value={`$${kpis.cost.value}`}
                    trend={kpis.cost.trend}
                    icon={Wallet}
                    color="bg-red-500"
                    label={`All Time: $${kpis.allTime.cost}`}
                />
                <KPICard
                    title="Net Profit"
                    value={`$${kpis.netProfit.value}`}
                    trend={kpis.netProfit.trend}
                    icon={Activity}
                    color="bg-emerald-500"
                    label={kpis.netProfit.label}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Growth Chart */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-white mb-6">User Growth & Activity</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="99%" height="100%" minHeight={300}>
                            <AreaChart data={charts.growth}>
                                <defs>
                                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="date" stroke="#666" tick={{ fill: '#999' }} tickFormatter={d => d.slice(5)} />
                                <YAxis stroke="#666" tick={{ fill: '#999' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="activeUsers" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={2} name="Active Users" />
                                <Area type="monotone" dataKey="newUsers" stroke="#10b981" fillOpacity={0} strokeWidth={2} name="New Users" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Financial Chart */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-white mb-6">Financial Performance</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="99%" height="100%" minHeight={300}>
                            <LineChart data={charts.growth}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="date" stroke="#666" tick={{ fill: '#999' }} tickFormatter={d => d.slice(5)} />
                                <YAxis stroke="#666" tick={{ fill: '#999' }} prefix="$" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value) => [`$${value}`, '']}
                                />
                                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} name="Revenue" />
                                <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} dot={false} name="Cost" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* AI Insights - Compact */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Activity size={16} className="text-violet-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">AI Observations</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-black/20 rounded p-2.5 border border-white/5">
                        <span className="text-[10px] text-green-400 font-bold block mb-1">↑ Growth</span>
                        <p className="text-gray-400 text-[11px] leading-snug">New user signups increased 15% this week.</p>
                    </div>
                    <div className="bg-black/20 rounded p-2.5 border border-white/5">
                        <span className="text-[10px] text-amber-400 font-bold block mb-1">! Cost</span>
                        <p className="text-gray-400 text-[11px] leading-snug">Token usage per generation is slightly up.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
