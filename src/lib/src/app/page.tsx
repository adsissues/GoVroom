"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/(app)/AuthContext'; // Corrected import path
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (currentUser) {
        // User is logged in, redirect to dashboard
        router.replace('/dashboard');
      } else {
        // User is not logged in, redirect to login
        router.replace('/login');
      }
    }
  }, [currentUser, loading, router]);

  // Show a loading indicator while checking auth state
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}
