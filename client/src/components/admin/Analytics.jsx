
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, Users, Image as ImageIcon, Award, Loader2, X } from 'lucide-react';

const COLORS = ['#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#10b981'];

export function Analytics() {
    const { getToken } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [range, setRange] = useState('7d');
    const [typeFilter, setTypeFilter] = useState(null); // 'remix', 'preset', 'custom'

    const loadData = async () => {
        try {
            setLoading(true);
            const token = await getToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/analytics/popularity?range=${range}${typeFilter ? `&type=${typeFilter}` : ''}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error("Failed to load analytics", e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [range, typeFilter]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-violet-500 mr-2" size={24} />
                <span className="text-gray-400">Loading insights...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
                Error: {error}
            </div>
        );
    }

    const typeData = [
        { name: 'Remix', value: data.generationTypes.remix },
        { name: 'Preset', value: data.generationTypes.preset },
        { name: 'Custom', value: data.generationTypes.custom },
    ].filter(d => d.value > 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Filter Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <TrendingUp className="text-theme-primary" size={24} />
                    <h2 className="text-xl font-bold">Popularity Insights</h2>
                </div>
                <div className="flex bg-theme-bg-secondary p-1 rounded-lg border border-theme-border">
                    {['1h', '6h', '12h', '1d', '7d', '30d', '90d', 'all'].map((r) => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${range === r
                                ? 'bg-theme-primary text-white shadow-sm'
                                : 'text-theme-text-muted hover:text-theme-text-primary'
                                }`}
                        >
                            {r.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {typeFilter && (
                <div className="flex items-center gap-2 px-4 py-2 bg-theme-primary/10 border border-theme-primary/20 rounded-xl w-fit">
                    <span className="text-[10px] font-bold text-theme-primary uppercase">Filtering by: {typeFilter}</span>
                    <button onClick={() => setTypeFilter(null)} className="p-1 hover:bg-theme-primary/20 rounded-full">
                        <X size={12} className="text-theme-primary" />
                    </button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-black/40 backdrop-blur-md border border-white/5 p-5 rounded-2xl group hover:border-violet-500/30 transition-all">
                    <div className="flex items-center gap-3 text-violet-400 mb-2">
                        <TrendingUp size={18} />
                        <span className="text-xs uppercase tracking-wider font-bold">Trending Type</span>
                    </div>
                    <div className="text-2xl font-bold text-white capitalize">
                        {typeData.sort((a, b) => b.value - a.value)[0]?.name || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Most used generation mode</div>
                </div>

                <div className="bg-black/40 backdrop-blur-md border border-white/5 p-5 rounded-2xl group hover:border-violet-500/30 transition-all">
                    <div className="flex items-center gap-3 text-fuchsia-400 mb-2">
                        <ImageIcon size={18} />
                        <span className="text-xs uppercase tracking-wider font-bold">Total Measured</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {data.generationTypes.remix + data.generationTypes.preset + data.generationTypes.custom}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Generations in current sample</div>
                </div>

                <div className="bg-black/40 backdrop-blur-md border border-violet-500/20 p-5 rounded-2xl bg-gradient-to-br from-violet-500/5 to-transparent">
                    <div className="flex items-center gap-3 text-violet-300 mb-2">
                        <Award size={18} />
                        <span className="text-xs uppercase tracking-wider font-bold">Lifetime Tokens</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {data.financials?.totalTokens?.toLocaleString() || '0'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Total API consumption</div>
                </div>

                <div className="bg-black/40 backdrop-blur-md border border-emerald-500/20 p-5 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-transparent">
                    <div className="flex items-center gap-3 text-emerald-400 mb-2">
                        <span className="font-bold text-lg">$</span>
                        <span className="text-xs uppercase tracking-wider font-bold">Est. Platform Cost</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                        ${data.financials?.totalEstimatedCost?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Based on $0.50/1M tokens</div>
                </div>
            </div>

            {/* Usage Trend Chart (Full Width) */}
            <div className="bg-black/40 backdrop-blur-md border border-white/5 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Usage & Cost Trend</h3>
                    <div className="flex gap-4 text-[10px] uppercase font-bold tracking-widest text-gray-500">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-violet-500"></div> Requests</div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Cost</div>
                    </div>
                </div>
                <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.trend} onClick={(data) => {
                            if (data && data.activeLabel) {
                                // Potentially drill down into a specific day
                                console.log("Drill down day:", data.activeLabel);
                            }
                        }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#555"
                                fontSize={10}
                                tickFormatter={(val) => range.includes('h') ? val.split('T')[1]?.substring(0, 5) : new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            />
                            <YAxis yAxisId="left" stroke="#8b5cf6" fontSize={10} />
                            <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} tickFormatter={(val) => `$${val.toFixed(2)}`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px' }}
                                itemStyle={{ color: '#fff' }}
                                labelStyle={{ color: '#888', marginBottom: '4px' }}
                            />
                            <Bar yAxisId="left" dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Generations" />
                            <Bar yAxisId="right" dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} name="Cost ($)" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Generation Type Breakdown */}
                <div className="bg-black/40 backdrop-blur-md border border-white/5 p-6 rounded-2xl">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Generation Type</h3>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={typeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    onClick={(entry) => setTypeFilter(entry.name.toLowerCase())}
                                    className="cursor-pointer"
                                >
                                    {typeData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                            stroke={typeFilter === entry.name.toLowerCase() ? '#fff' : 'none'}
                                            strokeWidth={2}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Subscription Distribution */}
                <div className="bg-black/40 backdrop-blur-md border border-white/5 p-6 rounded-2xl">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Subscription Mix</h3>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={Object.entries(data.subscriptionStats || {}).map(([name, value]) => ({ name, value }))}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {Object.entries(data.subscriptionStats || {}).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry[0] === 'active' ? '#10b981' : '#6366f1'} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Model Distribution */}
                <div className="bg-black/40 backdrop-blur-md border border-white/5 p-6 rounded-2xl">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">AI Models</h3>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={Object.entries(data.modelStats || {}).map(([name, value]) => ({ name, value }))}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {Object.entries(data.modelStats || {}).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Presets */}
                <div className="bg-black/40 backdrop-blur-md border border-white/5 p-6 rounded-2xl">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Top 10 Presets</h3>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.topPresets} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={100}
                                    stroke="#888"
                                    fontSize={9}
                                    tickFormatter={(val) => val.length > 15 ? val.substring(0, 12) + '...' : val}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <Bar dataKey="count" fill="#884dec" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Power Users List */}
            <div className="bg-black/40 backdrop-blur-md border border-white/5 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top 10 Power Users</h3>
                    <Users size={18} className="text-gray-500" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-500">
                                <th className="pb-3 px-2">User ID</th>
                                <th className="pb-3 px-2 text-right">Generations</th>
                                <th className="pb-3 px-2 text-right">Share of Sample</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.powerUsers.map((user, idx) => (
                                <tr key={user.id} className="group hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-2">
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium">{user.email}</span>
                                            <code className="text-[10px] text-gray-500">{user.id}</code>
                                        </div>
                                    </td>
                                    <td className="py-4 px-2 text-right font-bold text-white">
                                        {user.count}
                                    </td>
                                    <td className="py-4 px-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-violet-500"
                                                    style={{ width: `${(user.count / (data.generationTypes.remix + data.generationTypes.preset + data.generationTypes.custom)) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-500">
                                                {((user.count / (data.generationTypes.remix + data.generationTypes.preset + data.generationTypes.custom)) * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
