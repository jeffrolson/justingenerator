import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Search, MoreVertical } from 'lucide-react';

export function UserManager() {
    const { getToken } = useAuth();
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const token = await getToken();
            const query = search ? `?q=${search}` : '';
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setUsers(data.users || []);
        } catch (e) {
            console.error("Failed to fetch users", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const debounce = setTimeout(fetchUsers, 500);
        return () => clearTimeout(debounce);
    }, [search]);

    return (
        <div className="max-w-6xl mx-auto text-white">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">User Management</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 w-64 focus:outline-none focus:border-violet-500 transition-colors"
                    />
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-black/20 text-gray-400 text-sm">
                        <tr>
                            <th className="p-4">User</th>
                            <th className="p-4">Role</th>
                            <th className="p-4">Credits</th>
                            <th className="p-4">Generations</th>
                            <th className="p-4">Spent</th>
                            <th className="p-4">Joined</th>
                            <th className="p-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-500">No users found</td></tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <div className="font-medium">{user.name || 'Anonymous'}</div>
                                        <div className="text-xs text-gray-500">{user.email}</div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-xs px-2 py-1 rounded-full ${user.role === 'admin' ? 'bg-violet-500/20 text-violet-300' : 'bg-gray-500/20 text-gray-300'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4 font-mono">{user.credits}</td>
                                    <td className="p-4 font-mono text-center">{user.generationsCount || 0}</td>
                                    <td className="p-4 font-mono text-green-400">${(user.totalSpent || 0).toFixed(2)}</td>
                                    <td className="p-4 text-sm text-gray-400">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className="text-gray-500 hover:text-white">
                                            <MoreVertical size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
