import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, Image as ImageIcon, Settings, LogOut, ArrowLeft } from 'lucide-react';
import { Overview } from './admin/Overview';
import { UserManager } from './admin/UserManager';
import { PromptManager } from './admin/PromptManager';
import { Settings as SettingsComponent } from './admin/Settings';

export function AdminDashboard() {
    const { user, backendUser, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');

    const menuItems = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'content', label: 'Templates', icon: ImageIcon },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'overview': return <Overview />;
            case 'users': return <UserManager />;
            case 'content': return <PromptManager />;
            case 'settings': return <SettingsComponent />;
            default: return <div className="text-gray-400">Functionality coming soon...</div>;
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/10 bg-black/50 backdrop-blur-xl flex flex-col fixed h-full z-20 transition-transform">
                <div className="p-6 border-b border-white/10">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center font-bold text-white">
                            A
                        </div>
                        <span className="font-bold text-lg text-white">Admin Portal</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id
                                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <item.icon size={20} />
                            <span className="font-medium">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/10 space-y-2">
                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-medium">Back to App</span>
                    </button>
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                        <LogOut size={20} />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 min-h-screen">
                <header className="h-16 border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-10 px-8 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white capitalize">{activeTab}</h2>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                            <div className="text-sm font-medium text-white">{user?.email}</div>
                            <div className="text-xs text-gray-500 uppercase">{backendUser?.role?.stringValue || 'User'}</div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-orange-500"></div>
                    </div>
                </header>

                <div className="p-8">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
}
