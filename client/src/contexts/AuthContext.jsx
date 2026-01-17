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
        // Handle redirect result for mobile logins
        const handleRedirect = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result) {
                    console.log("[AuthContext] Redirect login success:", result.user.email);
                    // User state will be updated by onAuthStateChanged
                }
            } catch (error) {
                console.error("[AuthContext] Error getting redirect result:", error);
            }
        };
        handleRedirect();

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
                try {
                    const token = await firebaseUser.getIdToken();
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
                    console.log(`[AuthContext] Syncing with backend: ${apiUrl}/api/auth/verify`);

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
                        console.log("[AuthContext] Backend sync success. Role:", data.user?.role?.stringValue);
                        setBackendUser(data.user);
                    } else {
                        const errData = await res.json().catch(() => ({}));
                        console.error(`[AuthContext] Backend sync failed (${res.status}):`, errData);
                    }
                } catch (error) {
                    console.error("[AuthContext] Error during backend sync:", error.message);
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

        // Use redirect for mobile devices, popup for desktop
        // Improved detection: UA check + Screen width check (small devices under 1024px)
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isSmallScreen = window.innerWidth < 1024;
        const isMobile = isMobileUA || isSmallScreen;

        console.log(`[AuthContext] Login triggered. isMobile: ${isMobile} (UA: ${isMobileUA}, SmallScreen: ${isSmallScreen})`);

        if (isMobile) {
            console.log("[AuthContext] Initiating signInWithRedirect...");
            return signInWithRedirect(auth, provider);
        } else {
            console.log("[AuthContext] Initiating signInWithPopup...");
            return signInWithPopup(auth, provider);
        }
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
