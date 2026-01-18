import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, Image as ImageIcon, Settings, LogOut, ArrowLeft, Menu, X, ChevronLeft, ChevronRight, BarChart2, Gift, Palette } from 'lucide-react';
import { Overview } from './admin/Overview';
import { UserManager } from './admin/UserManager';
import { PromptManager } from './admin/PromptManager';
import { Settings as SettingsComponent } from './admin/Settings';
import { Analytics } from './admin/Analytics';
import { Referrals } from './admin/Referrals';
import { Brand } from './admin/Brand';
import { UserProfileModal } from './UserProfileModal';
import { useTheme } from '../contexts/ThemeContext';

export function AdminDashboard() {
    const { user, backendUser, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const { theme, setTheme } = useTheme();

    const credits = parseInt(backendUser?.credits?.integerValue || '0');

    const menuItems = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'analytics', label: 'Analytics', icon: BarChart2 },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'content', label: 'Templates', icon: ImageIcon },
        { id: 'brand', label: 'Brand', icon: Palette },
        { id: 'referrals', label: 'Referrals', icon: Gift },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'overview': return <Overview />;
            case 'analytics': return <Analytics />;
            case 'users': return <UserManager />;
            case 'content': return <PromptManager />;
            case 'brand': return <Brand />;
            case 'referrals': return <Referrals />;
            case 'settings': return <SettingsComponent />;
            default: return <div className="text-gray-400">Functionality coming soon...</div>;
        }
    };

    return (
        <div className="min-h-screen bg-(--bg-primary) text-(--text-primary) flex overflow-x-hidden">
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                ${isCollapsed ? 'w-20' : 'w-64'} 
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                border-r border-(--glass-border) bg-(--bg-secondary)/50 backdrop-blur-xl flex flex-col fixed h-full z-50 transition-all duration-300 ease-in-out
            `}>
                <div className={`p-4 border-b border-(--glass-border) flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex-shrink-0 flex items-center justify-center font-bold text-white">
                            A
                        </div>
                        {!isCollapsed && <span className="font-bold text-lg text-(--text-primary) whitespace-nowrap">Admin Portal</span>}
                    </div>
                    {/* Desktop Collapse Toggle */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden md:flex p-1.5 rounded-lg hover:bg-theme-glass-bg theme-text-secondary hover:text-theme-text-primary transition-colors"
                    >
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                    {/* Mobile Close Toggle */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden p-1.5 rounded-lg hover:bg-theme-glass-bg text-theme-text-secondary hover:text-theme-text-primary transition-colors"
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
                                : 'text-theme-text-secondary hover:bg-theme-glass-bg hover:text-theme-text-primary'
                                }`}
                        >
                            <item.icon size={20} className="flex-shrink-0" />
                            {!isCollapsed && <span className="font-medium whitespace-nowrap">{item.label}</span>}
                            {isCollapsed && (
                                <div className="absolute left-full ml-2 px-2 py-1 bg-theme-bg-secondary text-theme-text-primary text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-theme-glass-border">
                                    {item.label}
                                </div>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="p-2 border-t border-(--glass-border) space-y-1">
                    <button
                        onClick={() => window.location.href = '/'}
                        title={isCollapsed ? 'Back to App' : ''}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-theme-text-secondary hover:bg-theme-glass-bg hover:text-theme-text-primary transition-colors relative group"
                    >
                        <ArrowLeft size={20} className="flex-shrink-0" />
                        {!isCollapsed && <span className="font-medium whitespace-nowrap">Back to App</span>}
                        {isCollapsed && (
                            <div className="absolute left-full ml-2 px-2 py-1 bg-theme-bg-secondary text-theme-text-primary text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-theme-glass-border">
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
            <main className={`flex-1 min-h-screen transition-all duration-300 relative z-10 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
                <header className="h-14 border-b border-(--glass-border) bg-(--bg-primary)/20 backdrop-blur-md sticky top-0 z-20 px-4 md:px-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-theme-glass-bg text-theme-text-secondary transition-colors"
                        >
                            <Menu size={20} />
                        </button>
                        <h2 className="text-lg font-semibold text-(--text-primary) capitalize">{activeTab}</h2>
                    </div>

                    <button
                        onClick={() => setShowSettings(true)}
                        className="flex items-center gap-4 hover:bg-theme-glass-bg p-1 pr-2 rounded-full transition-all group"
                    >
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-medium text-(--text-primary) max-w-[150px] truncate group-hover:text-violet-400 transition-colors">{user?.email}</div>
                            <div className="text-[10px] text-(--text-secondary) uppercase tracking-wider">{backendUser?.role?.stringValue || 'User'}</div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-orange-500 ring-2 ring-(--glass-border) group-hover:scale-110 group-hover:ring-violet-500/50 transition-all"></div>
                    </button>
                </header>

                <div className="p-4 md:p-5 lg:p-6 max-w-[1600px] mx-auto">
                    {renderContent()}
                </div>
            </main>

            <UserProfileModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                user={user}
                backendUser={backendUser}
                logout={logout}
                theme={theme}
                setTheme={setTheme}
                credits={credits}
            />
        </div>
    );
}
