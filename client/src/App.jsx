import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ShareView } from './components/ShareView';
import { ExploreFeed } from './components/ExploreFeed';
import { AdminDashboard } from './components/AdminDashboard';
import PricingPage from './pages/PricingPage';


function AppContent() {
  const { user, loading, backendUser } = useAuth(); // Added backendUser here
  const [remixItem, setRemixItem] = useState(null);
  const path = window.location.pathname;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

  // Track page views on route change
  useEffect(() => {
    if (typeof window.gtag === 'function') {
      window.gtag('config', 'G-F0M8GJDE9F', {
        page_path: path,
      });
    }
  }, [path]);

  // Handle post-login remix redirect
  useEffect(() => {
    if (user) {
      const pending = localStorage.getItem('redirectAction');
      if (pending) {
        const action = JSON.parse(pending);
        if (action.type === 'remix') {
          // Fetch full item details to ensure we have the image URL
          fetch(`${apiUrl}/api/public/share/${action.id}`)
            .then(res => res.json())
            .then(data => {
              if (data.status === 'success' && data.generation) {
                setRemixItem(data.generation);
              } else {
                // Fallback if not found (maybe it's a preset? Presets don't have this endpoint usually)
                // If it's a preset, we might need a different lookup or just pass ID and hope Dashboard handles it?
                // Actually, for presets, the ID is like 'cyberpunk'. 
                // Let's check if the ID looks like a preset.
                setRemixItem({ id: action.id });
              }
            })
            .catch(err => {
              console.error("Failed to restore remix item:", err);
              setRemixItem({ id: action.id });
            });
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



  // Admin Portal (Auth/Role guarded)
  if (path === '/admin') {
    if (!user) return <Login />;
    if (loading) return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

    // Strict check: must have admin role in backendUser
    if (backendUser?.role?.stringValue === 'admin') {
      return <AdminDashboard />;
    }

    // Hide existence for others
    console.warn("Unauthorized admin access attempt. Redirecting.");
    window.history.replaceState({}, '', '/');
    return user ?
      <Dashboard initialRemix={remixItem} onClearRemix={() => setRemixItem(null)} /> :
      <ExploreFeed onRemix={(item) => setRemixItem(item)} />;
  }

  // Pricing Page (Auth guarded)
  if (path === '/pricing') {
    return user ? <PricingPage /> : <Login />;
  }

  // Explicit Explore Route (Public/Private)
  if (path === '/explore') {
    return (
      <ExploreFeed
        onRemix={(item) => {
          setRemixItem(item);
          window.history.pushState({}, '', '/'); // Go to dashboard
        }}
      />
    );
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
