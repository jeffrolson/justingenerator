import { createContext, useContext, useEffect, useState } from 'react';
import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
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
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                try {
                    const token = await firebaseUser.getIdToken();
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

                    const res = await fetch(`${apiUrl}/api/auth/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            token,
                            displayName: firebaseUser.displayName
                        })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        setBackendUser(data.user);
                    }
                } catch (error) {
                    console.error("Backend sync error:", error);
                }
            } else {
                setBackendUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = () => {
        const provider = new GoogleAuthProvider();
        // Return the promise directly to ensure the browser sees a direct user interaction
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
            const token = await userCredential.user.getIdToken(true);
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
