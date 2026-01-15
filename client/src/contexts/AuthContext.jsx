import { createContext, useContext, useEffect, useState } from 'react';
import {
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile
} from 'firebase/auth';
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
        const timeout = setTimeout(() => {
            if (loading) {
                console.warn("Auth check timed out. Forcing loading to false.");
                setLoading(false);
            }
        }, 5000);

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            clearTimeout(timeout);
            console.log("onAuthStateChanged fired. User:", firebaseUser?.email || "null");
            setUser(firebaseUser);

            if (firebaseUser) {
                // Sync with backend
                try {
                    const token = await firebaseUser.getIdToken();
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
                    console.log("Syncing with backend at:", apiUrl);
                    const res = await fetch(`${apiUrl}/api/auth/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        console.log("Backend sync successful:", data);
                        setBackendUser(data.user);
                    } else {
                        const errData = await res.json().catch(() => ({}));
                        console.error("Backend sync failed with status:", res.status, errData);
                    }
                } catch (error) {
                    console.error("Failed to sync user with backend:", error);
                }
            } else {
                setBackendUser(null);
            }

            setLoading(false);
        });

        return () => {
            unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    const login = () => {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider);
    };

    const loginWithEmail = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const register = async (email, password, firstName, lastName) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const displayName = `${firstName} ${lastName}`.trim();
        await updateProfile(userCredential.user, { displayName });

        // Immediately sync with backend to ensure names are captured
        try {
            const token = await userCredential.user.getIdToken();
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
            await fetch(`${apiUrl}/api/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, firstName, lastName })
            });
        } catch (e) {
            console.error("Manual sync during registration failed:", e);
        }

        return userCredential;
    };

    const logout = () => {
        return signOut(auth);
    };

    const value = {
        user,
        backendUser,
        loading,
        login,
        loginWithEmail,
        register,
        logout,
        getToken: async () => user ? user.getIdToken() : null
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
