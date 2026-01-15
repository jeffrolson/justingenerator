import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ShareView } from './components/ShareView';
import { ExploreFeed } from './components/ExploreFeed';
import { AdminDashboard } from './components/AdminDashboard';

function AppContent() {
  const { user, loading } = useAuth();
  const [remixItem, setRemixItem] = useState(null);
  const path = window.location.pathname;

  // Handle post-login remix redirect
  useEffect(() => {
    if (user) {
      const pending = localStorage.getItem('redirectAction');
      if (pending) {
        const action = JSON.parse(pending);
        if (action.type === 'remix') {
          // In a real app we'd fetch the full item here, but for now we'll just pass the ID
          // Dashboard will handle fetching details if needed, or we just pass the ID.
          setRemixItem({ id: action.id });
        }
        localStorage.removeItem('redirectAction');
      }
    }
  }, [user]);

  if (path.startsWith('/share/')) {
    const genId = path.split('/share/')[1];
    return <ShareView genId={genId} />;
  }

  if (path === '/login') {
    if (user) {
      window.history.pushState({}, '', '/');
      // No return here, let it fall through to the user check below
    } else {
      return <Login />;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Root path /
  if (path === '/' && !user) {
    return <ExploreFeed onRemix={(item) => setRemixItem(item)} />;
  }

  // Admin Portal (Auth guarded)
  if (path === '/admin') {
    return user ? <AdminDashboard /> : <Login />;
  }

  // Dashboard (Auth guarded)
  if (user) {
    return <Dashboard initialRemix={remixItem} onClearRemix={() => setRemixItem(null)} />;
  }

  // Default fallback to Explore (guest view)
  return <ExploreFeed onRemix={(item) => setRemixItem(item)} />;
}

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen app-background">
        <AppContent />
      </div>
    </AuthProvider>
  );
}

export default App;
