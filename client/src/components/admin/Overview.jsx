import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Users, DollarSign, Activity, AlertCircle } from 'lucide-react';

const KPICard = ({ title, value, trend, icon: Icon, color }) => (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-lg ${color} bg-opacity-20`}>
                <Icon size={24} className={color.replace('bg-', 'text-')} />
            </div>
            {trend && (
                <span className={`text-sm font-medium ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trend > 0 ? '+' : ''}{trend}%
                </span>
            )}
        </div>
        <div className="text-3xl font-bold text-white mb-1">{value}</div>
        <div className="text-sm text-gray-400">{title}</div>
    </div>
);

export function Overview() {
    const { getToken } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const token = await getToken();
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/kpis`, {
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
        loadData();
    }, []);

    if (loading) return <div className="text-white text-center p-8">Loading Dashboard...</div>;
    if (!data) return <div className="text-white text-center p-8">Failed to load data</div>;

    const { kpis, charts } = data;

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard
                    title="Active Users (7d)"
                    value={kpis.activeUsers.value}
                    trend={kpis.activeUsers.trend}
                    icon={Users}
                    color="bg-blue-500"
                />
                <KPICard
                    title="Revenue (7d)"
                    value={`$${kpis.revenue.value}`}
                    trend={kpis.revenue.trend}
                    icon={DollarSign}
                    color="bg-green-500"
                />
                <KPICard
                    title="New Signups"
                    value={kpis.newUsers.value}
                    trend={kpis.newUsers.trend}
                    icon={TrendingUp}
                    color="bg-violet-500"
                />
                <KPICard
                    title="Gen Success Rate"
                    value={`${kpis.generationSuccess.value}%`}
                    trend={kpis.generationSuccess.trend}
                    icon={Activity}
                    color="bg-sky-500"
                />
                <KPICard
                    title="Avg Latency (s)"
                    value={kpis.avgLatency.value}
                    trend={kpis.avgLatency.trend}
                    icon={AlertCircle}
                    color="bg-amber-500"
                />
                <KPICard
                    title="Conversion Rate"
                    value={`${kpis.conversionRate.value}%`}
                    trend={kpis.conversionRate.trend}
                    icon={DollarSign}
                    color="bg-pink-500"
                />
            </div>

            {/* Main Chart */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                <h3 className="text-xl font-bold text-white mb-6">Growth Trends</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={charts.growth}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="date" stroke="#666" />
                            <YAxis stroke="#666" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Line type="monotone" dataKey="activeUsers" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="newUsers" stroke="#10b981" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Insights Placeholder - To implement later */}
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
                <ul className="space-y-3">
                    <li className="flex gap-3 text-sm text-gray-300">
                        <span className="text-green-400 font-bold">Growth:</span>
                        New users are accelerating (+5%) this week compared to last week.
                    </li>
                    <li className="flex gap-3 text-sm text-gray-300">
                        <span className="text-amber-400 font-bold">Retention:</span>
                        Latency spike on Tuesday correlated with a 10% drop in session length.
                    </li>
                </ul>
            </div>
        </div>
    );
}
