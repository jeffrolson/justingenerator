import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { TrendingUp, Users, DollarSign, Activity, AlertCircle, Zap, Wallet, Calendar, ExternalLink, Cloud, Globe } from 'lucide-react';

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

    useEffect(() => {
        loadData();
    }, [range]);

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
        <div className={`space-y-6 max-w-[1600px] mx-auto transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
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
                    <div className="flex bg-theme-bg-secondary p-1 rounded-lg border border-theme-border">
                        {['1h', '6h', '12h', '1d', '7d', '30d', '90d', 'all'].map((r) => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${range === r
                                    ? 'bg-theme-primary text-white shadow-sm'
                                    : 'text-theme-text-muted hover:text-theme-text-primary'
                                    }`}
                            >
                                {r.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* External Tools - Compact */}
            <div className="flex flex-wrap gap-2">
                {[
                    { label: 'Analytics', href: 'https://analytics.google.com/', icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                    { label: 'GCP Console', href: 'https://console.cloud.google.com/', icon: Cloud, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Cloudflare', href: 'https://dash.cloudflare.com/', icon: Globe, color: 'text-orange-400', bg: 'bg-orange-400/10' },
                    { label: 'GitHub', href: 'https://github.com/jeffrolson/justingenerator', icon: Globe, color: 'text-slate-400', bg: 'bg-white/5' },
                    { label: 'Stripe', href: 'https://dashboard.stripe.com/', icon: DollarSign, color: 'text-indigo-400', bg: 'bg-indigo-400/10' }
                ].map(tool => (
                    <a
                        key={tool.label}
                        href={tool.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
                    >
                        <tool.icon size={14} className={tool.color} />
                        <span className="text-xs font-medium text-gray-300 group-hover:text-white">{tool.label}</span>
                        <ExternalLink size={10} className="text-gray-600" />
                    </a>
                ))}
            </div>

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
