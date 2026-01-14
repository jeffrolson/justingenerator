import { createContext, useContext, useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [backendUser, setBackendUser] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                // Sync with backend
                try {
                    const token = await firebaseUser.getIdToken();
                    // Use config for API URL or default to worker path
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
                    const res = await fetch(`${apiUrl}/api/auth/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setBackendUser(data.user);
                    }
                } catch (error) {
                    console.error("Failed to sync user with backend:", error);
                }
            } else {
                setBackendUser(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const login = () => {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider);
    };

    const logout = () => {
        return signOut(auth);
    };

    const value = {
        user,
        backendUser,
        loading,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
