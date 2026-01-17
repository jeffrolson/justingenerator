import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ShareView } from './components/ShareView';
import { ExploreFeed } from './components/ExploreFeed';
import { AdminDashboard } from './components/AdminDashboard';
import PricingPage from './pages/PricingPage';


function AppContent() {
  const { user, loading, backendUser } = useAuth();
  const [remixItem, setRemixItem] = useState(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

  // Listen for navigation events
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Custom navigate function
  const navigate = (to, replace = false) => {
    if (replace) {
      window.history.replaceState({}, '', to);
    } else {
      window.history.pushState({}, '', to);
    }
    setCurrentPath(to);
  };

  // Track page views on route change
  useEffect(() => {
    if (typeof window.gtag === 'function') {
      window.gtag('config', 'G-F0M8GJDE9F', {
        page_path: currentPath,
      });
    }
  }, [currentPath]);

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

  if (currentPath.startsWith('/share/')) {
    const genId = currentPath.split('/share/')[1];
    return <ShareView genId={genId} />;
  }

  if (currentPath === '/login') {
    if (user) {
      // If we have a pending redirect (e.g. from /pricing), go there, else go home
      const pendingRedirect = localStorage.getItem('loginRedirect');
      const target = pendingRedirect || '/';
      localStorage.removeItem('loginRedirect');
      navigate(target, true);
      return null; // Let the next render handle it
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
  if (currentPath === '/' && !user) {
    return <ExploreFeed onRemix={(item) => setRemixItem(item)} />;
  }

  // Admin Portal (Auth/Role guarded)
  if (currentPath === '/admin') {
    if (!user) {
      localStorage.setItem('loginRedirect', '/admin');
      return <Login />;
    }

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    // Wait for backendUser if we have a user
    if (user && !backendUser) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="ml-4 text-violet-400 font-bold">Verifying Admin Access...</p>
        </div>
      );
    }

    // Strict check: must have admin role in backendUser
    if (backendUser?.role?.stringValue === 'admin') {
      return <AdminDashboard />;
    }

    // Hide existence for others
    console.warn("Unauthorized admin access attempt. Redirecting.");
    navigate('/', true);
    return null;
  }

  // Pricing Page (Auth guarded)
  if (currentPath === '/pricing') {
    if (!user) {
      localStorage.setItem('loginRedirect', '/pricing');
      return <Login />;
    }
    return <PricingPage />;
  }

  // Explicit Explore Route (Public/Private)
  if (currentPath === '/explore') {
    return (
      <ExploreFeed
        onRemix={(item) => {
          setRemixItem(item);
          navigate('/');
        }}
      />
    );
  }

  // Dashboard (Auth guarded)
  if (user) {
    return <Dashboard initialRemix={remixItem} onClearRemix={() => setRemixItem(null)} />;
  }

  return (
    <div className={`min-h-screen ${currentPath.startsWith('/admin') ? 'bg-[#0a0a0a]' : 'app-background'}`}>
      <ExploreFeed onRemix={(item) => setRemixItem(item)} />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
