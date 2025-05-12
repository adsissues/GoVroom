
"use client";

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton'; // For loading state

export default function HomePage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (currentUser) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [currentUser, loading, router]);

  // Display a loading state while checking authentication
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="space-y-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
          <p className="text-muted-foreground">Loading application...</p>
        </div>
      </div>
    );
  }

  // This content will be briefly visible if redirection is slow or JS is disabled initially.
  // Or, it can be a fallback if redirection fails for some unexpected reason.
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
