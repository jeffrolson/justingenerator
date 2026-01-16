import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { TrendingUp, Users, DollarSign, Activity, AlertCircle, Zap, Wallet, Calendar, ExternalLink, Cloud, Globe } from 'lucide-react';

const KPICard = ({ title, value, trend, icon: Icon, color, label }) => (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm hover:bg-white/10 transition-colors">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-lg ${color} bg-opacity-20`}>
                <Icon size={24} className={color.replace('bg-', 'text-')} />
            </div>
            {trend !== undefined && trend !== 0 && (
                <span className={`text-sm font-medium ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trend > 0 ? '+' : ''}{trend}%
                </span>
            )}
        </div>
        <div className="text-3xl font-bold text-white mb-1">{value}</div>
        <div className="text-sm text-gray-400">{label || title}</div>
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

    useEffect(() => {
        loadData();
    }, [range]);

    if (loading && !data) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-white">
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
        <div className={`space-y-8 max-w-7xl mx-auto transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            {loading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
                    <div className="bg-[#1a1a1a] border border-white/10 p-4 rounded-xl shadow-2xl flex items-center gap-3">
                        <Activity size={20} className="animate-spin text-indigo-500" />
                        <span className="text-white font-medium">Updating...</span>
                    </div>
                </div>
            )}
            {/* Controls */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Platform Overview</h2>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className={`px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2 ${syncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Activity size={16} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync Data'}
                    </button>
                    <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                        {['7d', '30d', '90d', 'all'].map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${range === r ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {r.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* External Tools */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer" className="relative z-10 group flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:border-orange-500/30 cursor-pointer">
                    <div className="p-3 bg-orange-500/20 rounded-lg text-orange-500 group-hover:scale-110 transition-transform">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div className="font-bold text-white flex items-center gap-2">
                            Google Analytics
                            <ExternalLink size={14} className="text-gray-500" />
                        </div>
                        <div className="text-sm text-gray-400">Traffic & User Behavior</div>
                    </div>
                </a>

                <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="relative z-10 group flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:border-blue-500/30 cursor-pointer">
                    <div className="p-3 bg-blue-500/20 rounded-lg text-blue-500 group-hover:scale-110 transition-transform">
                        <Cloud size={24} />
                    </div>
                    <div>
                        <div className="font-bold text-white flex items-center gap-2">
                            Google Cloud
                            <ExternalLink size={14} className="text-gray-500" />
                        </div>
                        <div className="text-sm text-gray-400">Infrastructure & Logs</div>
                    </div>
                </a>

                <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer" className="relative z-10 group flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:border-orange-500/30 cursor-pointer">
                    <div className="p-3 bg-orange-500/20 rounded-lg text-orange-500 group-hover:scale-110 transition-transform">
                        <Globe size={24} />
                    </div>
                    <div>
                        <div className="font-bold text-white flex items-center gap-2">
                            Cloudflare
                            <ExternalLink size={14} className="text-gray-500" />
                        </div>
                        <div className="text-sm text-gray-400">CDN & Edge Workers</div>
                    </div>
                </a>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard
                    title="Avg Daily Users"
                    value={kpis.activeUsers.value}
                    trend={kpis.activeUsers.trend}
                    icon={Users}
                    color="bg-blue-500"
                    label={kpis.activeUsers.label}
                />
                <KPICard
                    title="Revenue"
                    value={`$${kpis.revenue.value}`}
                    trend={kpis.revenue.trend}
                    icon={DollarSign}
                    color="bg-green-500"
                    label={`${kpis.revenue.label} (All Time: $${kpis.allTime.revenue})`}
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
                    label={`${kpis.tokens.label} (All Time: ${kpis.allTime.tokens})`}
                />
                <KPICard
                    title="Est. Usage Cost"
                    value={`$${kpis.cost.value}`}
                    trend={kpis.cost.trend}
                    icon={Wallet}
                    color="bg-red-500"
                    label={`${kpis.cost.label} (All Time: $${kpis.allTime.cost})`}
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
                        <ResponsiveContainer width="100%" height="100%">
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
                        <ResponsiveContainer width="100%" height="100%">
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

            {/* AI Insights (Static for now, but placeholder for future) */}
            <div className="bg-gradient-to-r from-violet-900/20 to-fuchsia-900/20 border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-violet-500/20 rounded-lg text-violet-300">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h4 className="font-semibold text-white">AI Insights</h4>
                        <p className="text-sm text-gray-400">Automated observations from your data</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-lg p-4">
                        <span className="text-green-400 font-bold text-sm block mb-1">Growth Opportunity</span>
                        <p className="text-gray-300 text-sm">New user signups have increased by 15% this week. Consider running a retention campaign.</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                        <span className="text-amber-400 font-bold text-sm block mb-1">Cost Alert</span>
                        <p className="text-gray-300 text-sm">Token usage per generation is slightly up. Check if newer prompts are more complex.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
