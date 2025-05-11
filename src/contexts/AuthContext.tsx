
"use client";
import type { ReactNode } from 'react';
import { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChangedListener, signOutUser as firebaseSignOut } from '@/lib/firebase/authService';
import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation'; // Use next/navigation for App Router

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe; // Cleanup subscription on unmount
  }, []);

  const signOut = async () => {
    await firebaseSignOut();
    setCurrentUser(null);
    router.push('/login'); // Redirect to login after sign out
  };

  const value = {
    currentUser,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
