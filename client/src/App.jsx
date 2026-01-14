import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ShareView } from './components/ShareView';

function AppContent() {
  const { user, loading } = useAuth();
  const path = window.location.pathname;

  if (path.startsWith('/share/')) {
    const genId = path.split('/share/')[1];
    return <ShareView genId={genId} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-background flex flex-col items-center justify-center p-4">
      {user ? <Dashboard /> : <Login />}
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
