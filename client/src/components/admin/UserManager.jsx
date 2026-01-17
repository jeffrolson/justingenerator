import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Trash2, ArrowUp, ArrowDown, History, X, ExternalLink, Shield, ShieldAlert, RefreshCw } from 'lucide-react';

export function UserManager() {
    const { getToken } = useAuth();
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [sortField, setSortField] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('DESC');
    const [selectedUser, setSelectedUser] = useState(null);
    const [userGenerations, setUserGenerations] = useState([]);
    const [loadingGenerations, setLoadingGenerations] = useState(false);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const token = await getToken();
            const query = new URLSearchParams({
                q: search,
                sortField,
                sortOrder
            }).toString();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users?${query}`, {
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

    const fetchUserGenerations = async (userId) => {
        try {
            setLoadingGenerations(true);
            const token = await getToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${userId}/generations`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setUserGenerations(data.generations || []);
        } catch (e) {
            console.error("Failed to fetch generations", e);
        } finally {
            setLoadingGenerations(false);
        }
    };

    const handleToggleRole = async (user) => {
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        const confirmMsg = user.role === 'admin'
            ? `Are you sure you want to demote ${user.name || user.email} to a regular user?`
            : `Are you sure you want to promote ${user.name || user.email} to an admin?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const token = await getToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${user.id}/role`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: newRole })
            });

            if (res.ok) {
                setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u));
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update role');
            }
        } catch (e) {
            console.error("Failed to toggle role", e);
            alert('An error occurred while updating the role');
        }
    };

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setSortField(field);
            setSortOrder('DESC');
        }
    };

    useEffect(() => {
        const debounce = setTimeout(fetchUsers, 500);
        return () => clearTimeout(debounce);
    }, [search, sortField, sortOrder]);

    return (
        <div className="max-w-[1600px] mx-auto text-white">
            <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between w-full">
                    <h2 className="text-2xl font-bold hidden md:block">User Management</h2>
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                        <input
                            type="search"
                            placeholder="Search by name or email..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={fetchUsers}
                            className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                            title="Refresh List"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <select
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all cursor-pointer"
                            value={sortField}
                            onChange={(e) => setSortField(e.target.value)}
                        >
                            <option value="createdAt">Newest Joined</option>
                            <option value="name">Name</option>
                            <option value="email">Email</option>
                            <option value="credits">Credits</option>
                            <option value="generationsCount">Generations</option>
                            <option value="totalSpent">Total Spent</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-black/20 text-gray-400 text-sm">
                        <tr>
                            <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('name')}>
                                <div className="flex items-center gap-2">
                                    User {sortField === 'name' && (sortOrder === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                            </th>
                            <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('role')}>
                                <div className="flex items-center gap-2">
                                    Role {sortField === 'role' && (sortOrder === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                            </th>
                            <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('credits')}>
                                <div className="flex items-center gap-2">
                                    Credits {sortField === 'credits' && (sortOrder === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                            </th>
                            <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('generationsCount')}>
                                <div className="flex items-center gap-2">
                                    Generations {sortField === 'generationsCount' && (sortOrder === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                            </th>
                            <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('totalSpent')}>
                                <div className="flex items-center gap-2">
                                    Spent {sortField === 'totalSpent' && (sortOrder === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                            </th>
                            <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('createdAt')}>
                                <div className="flex items-center gap-2">
                                    Joined {sortField === 'createdAt' && (sortOrder === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                            </th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-gray-500">No users found</td></tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <div className="font-medium">{user.name || 'Anonymous'}</div>
                                        <div className="text-xs text-gray-500">
                                            {user.email || <span className="text-orange-500/70" title="Missing Email">UID: {user.id}</span>}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-xs px-2 py-1 rounded-full ${user.role === 'admin' ? 'bg-violet-500/20 text-violet-300' : 'bg-gray-500/20 text-gray-300'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4 font-mono">{user.credits}</td>
                                    <td
                                        className="p-4 font-mono text-center cursor-pointer hover:text-violet-400 underline underline-offset-4 decoration-white/10"
                                        onClick={() => {
                                            setSelectedUser(user);
                                            fetchUserGenerations(user.id);
                                        }}
                                    >
                                        {user.generationsCount || 0}
                                    </td>
                                    <td className="p-4 font-mono text-green-400">${(user.totalSpent || 0).toFixed(2)}</td>
                                    <td className="p-4 text-xs text-gray-400">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleString() : <span className="text-gray-600 italic">Unknown</span>}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedUser(user);
                                                    fetchUserGenerations(user.id);
                                                }}
                                                className="p-2 text-gray-400 hover:text-indigo-400 transition-colors"
                                                title="View History"
                                            >
                                                <History size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleToggleRole(user)}
                                                className={`p-2 transition-colors ${user.role === 'admin' ? 'text-violet-400 hover:text-gray-400' : 'text-gray-400 hover:text-violet-400'}`}
                                                title={user.role === 'admin' ? "Demote to User" : "Promote to Admin"}
                                            >
                                                {user.role === 'admin' ? <ShieldAlert size={18} /> : <Shield size={18} />}
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm('Are you sure you want to delete this user? This cannot be undone.')) {
                                                        try {
                                                            const token = await getToken();
                                                            await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${user.id}`, {
                                                                method: 'DELETE',
                                                                headers: { Authorization: `Bearer ${token}` }
                                                            });
                                                            setUsers(users.filter(u => u.id !== user.id));
                                                        } catch (e) {
                                                            alert('Failed to delete user');
                                                        }
                                                    }
                                                }}
                                                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                                                title="Delete User"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* User History Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
                            <div>
                                <h3 className="text-xl font-bold text-white">{selectedUser.name}</h3>
                                <p className="text-sm text-gray-400">{selectedUser.email}</p>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingGenerations ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                    <div className="animate-spin mb-4">
                                        <History size={32} />
                                    </div>
                                    <p>Loading history...</p>
                                </div>
                            ) : userGenerations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                    <p>No generations found for this user.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {userGenerations.map(gen => (
                                        <div key={gen.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden group">
                                            <div className="aspect-square relative">
                                                <img
                                                    src={import.meta.env.VITE_API_URL + gen.imageUrl}
                                                    alt={gen.summary || 'Generation'}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                                                    <p className="text-sm text-gray-200 line-clamp-3 mb-2">{gen.prompt}</p>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(gen.createdAt).toLocaleString()}
                                                        </span>
                                                        <a
                                                            href={import.meta.env.VITE_API_URL + gen.imageUrl}
                                                            target="_blank"
                                                            className="text-white hover:text-indigo-400 p-1"
                                                        >
                                                            <ExternalLink size={16} />
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
