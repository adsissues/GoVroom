
"use client"; // This layout needs client-side hooks for auth and navigation
import type { ReactNode } from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import AppHeader from '@/components/layout/app-header';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getAppSettings } from '@/lib/firebase/settingsService';
import { useToast } from '@/hooks/use-toast';

const USER_ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const { currentUser, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [sessionReady, setSessionReady] = useState(false);
  const [logoutAfterMinutes, setLogoutAfterMinutes] = useState<number | undefined>(undefined);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Effect to fetch app settings, specifically logoutAfterMinutes
  useEffect(() => {
    if (currentUser) { // Only fetch if a user is logged in
      getAppSettings()
        .then(settings => {
          if (settings && typeof settings.logoutAfterMinutes === 'number') {
            setLogoutAfterMinutes(settings.logoutAfterMinutes);
            if (settings.logoutAfterMinutes > 0) {
              console.log(`[AuthLayout] Auto-logout enabled: ${settings.logoutAfterMinutes} minutes.`);
            } else {
              console.log("[AuthLayout] Auto-logout disabled (0 minutes).");
            }
          } else {
            setLogoutAfterMinutes(0); // Default to disabled if not set or invalid
            console.log("[AuthLayout] Auto-logout setting not found or invalid, defaulting to disabled.");
          }
        })
        .catch(error => {
          console.error("[AuthLayout] Error fetching app settings for auto-logout:", error);
          setLogoutAfterMinutes(0); // Default to disabled on error
        });
    } else {
      // Clear logout setting if no user
      setLogoutAfterMinutes(undefined);
    }
  }, [currentUser]);


  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (currentUser && typeof logoutAfterMinutes === 'number' && logoutAfterMinutes > 0) {
      inactivityTimerRef.current = setTimeout(() => {
        toast({
          title: 'Session Expired',
          description: `You have been logged out due to inactivity (${logoutAfterMinutes} minutes).`,
          variant: 'default',
          duration: 5000,
        });
        console.log(`[AuthLayout] Inactivity timer expired after ${logoutAfterMinutes} minutes. Signing out.`);
        signOut();
      }, logoutAfterMinutes * 60 * 1000); // Convert minutes to milliseconds
    }
  }, [currentUser, logoutAfterMinutes, signOut, toast]);


  // Effect for managing inactivity timer and event listeners
  useEffect(() => {
    if (currentUser && typeof logoutAfterMinutes === 'number' && logoutAfterMinutes > 0) {
      // Start the timer initially
      resetInactivityTimer();

      // Add event listeners for user activity
      USER_ACTIVITY_EVENTS.forEach(event => {
        window.addEventListener(event, resetInactivityTimer);
      });

      console.log(`[AuthLayout] Inactivity timer and listeners set up for ${logoutAfterMinutes} minutes.`);

      // Cleanup function
      return () => {
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
        USER_ACTIVITY_EVENTS.forEach(event => {
          window.removeEventListener(event, resetInactivityTimer);
        });
        console.log("[AuthLayout] Inactivity timer and listeners cleaned up.");
      };
    } else {
      // Ensure timer and listeners are cleared if auto-logout is disabled or no user
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      USER_ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
       if (currentUser && logoutAfterMinutes === 0) {
         console.log("[AuthLayout] Auto-logout is explicitly disabled (0 minutes). No timer active.");
       }
    }
  }, [currentUser, logoutAfterMinutes, resetInactivityTimer]);


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
      timer = setTimeout(() => {
        setSessionReady(true);
      }, 2000); 
    }
    return () => clearTimeout(timer);
  }, [authLoading, currentUser, sessionReady]);

  // Effect to reset sessionReady state if user logs out or auth is re-evaluated
  useEffect(() => {
    if ((authLoading || !currentUser) && sessionReady) {
      setSessionReady(false);
    }
  }, [authLoading, currentUser, sessionReady]);


  if (authLoading) {
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
     return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
     );
   }

  if (!sessionReady) {
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

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1 overflow-y-auto bg-secondary/50 p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
