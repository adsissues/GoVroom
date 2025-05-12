
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
    console.log("AuthProvider: Setting up auth listener...");
    setLoading(true); // Ensure loading is true when listener might trigger

    const unsubscribe = onAuthStateChangedListener((user) => {
      console.log("AuthProvider: Auth state changed. User:", user?.email ?? 'null');
      setCurrentUser(user);
      setLoading(false); // Set loading to false ONLY after the first callback
    });

    // Cleanup function
    return () => {
        console.log("AuthProvider: Cleaning up auth listener.");
        unsubscribe();
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  const signOut = async () => {
    console.log("AuthProvider: Signing out user...");
    try {
        await firebaseSignOut();
        setCurrentUser(null); // Clear user state immediately
        console.log("AuthProvider: Sign out successful, redirecting to login.");
        router.push('/login'); // Redirect to login after sign out
    } catch (error) {
        console.error("AuthProvider: Error signing out:", error);
        // Optionally show a toast message here
    }
  };

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    currentUser,
    loading,
    signOut,
  }), [currentUser, loading]); // Include signOut if its definition could change, though unlikely here

  // Render children only after the initial loading is complete.
  // This prevents rendering protected routes before auth state is known.
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
