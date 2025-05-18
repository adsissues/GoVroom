
"use client";
import type { ReactNode } from 'react';
import { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { onAuthStateChangedListener, signOutUser as firebaseSignOut } from '@/lib/firebase/authService';
import type { User } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation'; // Use next/navigation for App Router

interface AuthContextType {
  currentUser: User | null;
  loading: boolean; // Indicates if the initial auth state check is complete
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start loading until first check completes
  const router = useRouter();
  const pathname = usePathname(); // Get current path

  useEffect(() => {
    console.log("[AuthContext] AuthProvider: Setting up Firebase auth listener...");
    setLoading(true); // Ensure loading is true when listener might trigger

    const unsubscribe = onAuthStateChangedListener((user) => {
      console.log(`[AuthContext] AuthProvider: onAuthStateChangedListener callback received user:`, user ? JSON.parse(JSON.stringify(user)) : null);
      setCurrentUser(user);
      setLoading(false); // Set loading to false ONLY after the first callback
    });

    // Cleanup function
    return () => {
        console.log("[AuthContext] AuthProvider: Cleaning up Firebase auth listener.");
        unsubscribe();
    }
  }, []); 

  // Log currentUser whenever it changes for debugging
  useEffect(() => {
    console.log(`[AuthContext] AuthProvider: currentUser state updated in context. CurrentUser:`, currentUser ? JSON.parse(JSON.stringify(currentUser)) : null, `Loading: ${loading}`);
  }, [currentUser, loading]);

  const signOut = async () => {
    console.log("[AuthContext] AuthProvider: Signing out user...");
    try {
        await firebaseSignOut();
        setCurrentUser(null); // Clear user state immediately
        console.log("[AuthContext] AuthProvider: Sign out successful, redirecting to login.");
        router.push('/login'); // Redirect to login after sign out
    } catch (error) {
        console.error("[AuthContext] AuthProvider: Error signing out:", error);
    }
  };

  const value = useMemo(() => ({
    currentUser,
    loading,
    signOut,
  }), [currentUser, loading, signOut]); // Added signOut to memo dependencies

  return (
      <AuthContext.Provider value={value}>
          {children}
      </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
