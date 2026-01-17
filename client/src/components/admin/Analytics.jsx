
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, Users, Image as ImageIcon, Award, Loader2 } from 'lucide-react';

const COLORS = ['#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#10b981'];

export function Analytics() {
    const { getToken } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadData = async () => {
        try {
            setLoading(true);
            const token = await getToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/analytics/popularity`, {
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
    }, []);

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
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-black/40 backdrop-blur-md border border-white/5 p-5 rounded-2xl">
                    <div className="flex items-center gap-3 text-violet-400 mb-2">
                        <TrendingUp size={18} />
                        <span className="text-xs uppercase tracking-wider font-bold">Trending Type</span>
                    </div>
                    <div className="text-2xl font-bold text-white capitalize">
                        {typeData.sort((a, b) => b.value - a.value)[0]?.name || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Most used generation mode</div>
                </div>

                <div className="bg-black/40 backdrop-blur-md border border-white/5 p-5 rounded-2xl">
                    <div className="flex items-center gap-3 text-fuchsia-400 mb-2">
                        <ImageIcon size={18} />
                        <span className="text-xs uppercase tracking-wider font-bold">Total Measured</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {data.generationTypes.remix + data.generationTypes.preset + data.generationTypes.custom}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Generations analyzed in sample</div>
                </div>

                <div className="bg-black/40 backdrop-blur-md border border-white/5 p-5 rounded-2xl">
                    <div className="flex items-center gap-3 text-orange-400 mb-2">
                        <Award size={18} />
                        <span className="text-xs uppercase tracking-wider font-bold">Top User Vol</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {data.powerUsers[0]?.count || 0}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Generations by top power user</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Generation Type Breakdown */}
                <div className="bg-black/40 backdrop-blur-md border border-white/5 p-6 rounded-2xl">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Generation Type Distribution</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={typeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {typeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Presets */}
                <div className="bg-black/40 backdrop-blur-md border border-white/5 p-6 rounded-2xl">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Top 10 Presets (Usage)</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.topPresets} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="id"
                                    type="category"
                                    width={120}
                                    stroke="#888"
                                    fontSize={12}
                                    tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
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
                                        <code className="text-xs text-violet-400">{user.id}</code>
                                    </td>
                                    <td className="py-4 px-2 text-right font-bold text-white">
                                        {user.count}
                                    </td>
                                    <td className="py-4 px-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-violet-500"
                                                    style={{ width: `${(user.count / data.generationTypes.remix + data.generationTypes.preset + data.generationTypes.custom) * 100}%` }}
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
