
"use client"; // This layout needs client-side hooks for auth and navigation
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import AppHeader from '@/components/layout/app-header';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sessionReady, setSessionReady] = useState(false); // New state for welcome animation

  // Effect for redirection if user is not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [currentUser, authLoading, router, pathname]);

  // Effect for the "Welcome back" delay
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!authLoading && currentUser && !sessionReady) {
      // User is authenticated, auth loading is done, but session isn't marked as fully ready yet.
      // This is when we want to show the "Welcome back..." message.
      // The actual UI display is handled in the return statement.
      // We start a timer to transition to the main app content.
      timer = setTimeout(() => {
        setSessionReady(true);
      }, 2000); // 2-second delay for the welcome message
    }
    // Cleanup timer if component unmounts or dependencies change before timer fires
    return () => clearTimeout(timer);
  }, [authLoading, currentUser, sessionReady]);

  // Effect to reset sessionReady state if user logs out or auth is re-evaluated
  useEffect(() => {
    if ((authLoading || !currentUser) && sessionReady) {
      // If auth is loading again, or user becomes null, and session was previously ready,
      // reset sessionReady to allow the welcome message for a potential new session.
      setSessionReady(false);
    }
  }, [authLoading, currentUser, sessionReady]);


  if (authLoading) {
    // Initial authentication check is in progress
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4 p-4 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading user session...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    // Auth check is done, but no user is authenticated.
    // The redirection effect above will handle navigation. This is a fallback UI.
     return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
     );
   }

  // At this point, authLoading is false and currentUser is true.
  // Now, we check if the sessionReady (welcome animation phase) is complete.
  if (!sessionReady) {
    // User is authenticated, but we're in the "Welcome back" animation phase.
    const userName = currentUser.email?.split('@')[0] || 'User';
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4 p-4 text-center">
          <h1 className="text-xl md:text-2xl font-semibold">Welcome back, {userName}!</h1>
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Preparing your dashboard...</p>
        </div>
      </div>
    );
  }

  // authLoading is false, currentUser is true, and sessionReady is true.
  // Render the main application layout.
  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1 overflow-y-auto bg-secondary/50 p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
