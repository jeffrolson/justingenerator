import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, Image as ImageIcon, Settings, LogOut, ArrowLeft, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Overview } from './admin/Overview';
import { UserManager } from './admin/UserManager';
import { PromptManager } from './admin/PromptManager';
import { Settings as SettingsComponent } from './admin/Settings';

export function AdminDashboard() {
    const { user, backendUser, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        <div className="min-h-screen bg-[#0a0a0a] flex overflow-x-hidden">
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                ${isCollapsed ? 'w-20' : 'w-64'} 
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                border-r border-white/10 bg-black/50 backdrop-blur-xl flex flex-col fixed h-full z-40 transition-all duration-300 ease-in-out
            `}>
                <div className={`p-4 border-b border-white/10 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex-shrink-0 flex items-center justify-center font-bold text-white">
                            A
                        </div>
                        {!isCollapsed && <span className="font-bold text-lg text-white whitespace-nowrap">Admin Portal</span>}
                    </div>
                    {/* Desktop Collapse Toggle */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden md:flex p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                    {/* Mobile Close Toggle */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-2 space-y-1 overflow-y-auto mt-2">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setActiveTab(item.id);
                                setIsMobileMenuOpen(false);
                            }}
                            title={isCollapsed ? item.label : ''}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group ${activeTab === item.id
                                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <item.icon size={20} className="flex-shrink-0" />
                            {!isCollapsed && <span className="font-medium whitespace-nowrap">{item.label}</span>}
                            {isCollapsed && (
                                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-white/10">
                                    {item.label}
                                </div>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="p-2 border-t border-white/10 space-y-1">
                    <button
                        onClick={() => window.location.href = '/'}
                        title={isCollapsed ? 'Back to App' : ''}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-colors relative group"
                    >
                        <ArrowLeft size={20} className="flex-shrink-0" />
                        {!isCollapsed && <span className="font-medium whitespace-nowrap">Back to App</span>}
                        {isCollapsed && (
                            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-white/10">
                                Back to App
                            </div>
                        )}
                    </button>
                    <button
                        onClick={logout}
                        title={isCollapsed ? 'Sign Out' : ''}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors relative group"
                    >
                        <LogOut size={20} className="flex-shrink-0" />
                        {!isCollapsed && <span className="font-medium whitespace-nowrap">Sign Out</span>}
                        {isCollapsed && (
                            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-red-300 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-red-500/10">
                                Sign Out
                            </div>
                        )}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 min-h-screen transition-all duration-300 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
                <header className="h-14 border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-20 px-4 md:px-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"
                        >
                            <Menu size={20} />
                        </button>
                        <h2 className="text-lg font-semibold text-white capitalize">{activeTab}</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-medium text-white max-w-[150px] truncate">{user?.email}</div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{backendUser?.role?.stringValue || 'User'}</div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-orange-500 ring-2 ring-white/5"></div>
                    </div>
                </header>

                <div className="p-4 md:p-5 lg:p-6 max-w-[1600px] mx-auto">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
}
