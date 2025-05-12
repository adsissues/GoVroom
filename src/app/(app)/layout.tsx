
"use client"; // This layout needs client-side hooks for auth and navigation
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import AppSidebar from '@/components/layout/app-sidebar';
import AppHeader from '@/components/layout/app-header';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton'; // For loading state
import { Loader2 } from 'lucide-react'; // For loading spinner

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Debug logs (optional, remove in production)
  // console.log(`AuthenticatedAppLayout: Path: ${pathname}, Auth Loading: ${authLoading}, User: ${currentUser?.email ?? 'None'}`);

  useEffect(() => {
    // console.log(`Auth Effect: Loading: ${authLoading}, User: ${!!currentUser}`);
    // If auth check is finished (!authLoading) and there's no user...
    if (!authLoading && !currentUser) {
      console.log(`Auth Effect: No user found, redirecting to login from path: ${pathname}`);
      // Store the intended path to redirect after login using query params
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
    // Dependency array: run effect when auth state or path changes
  }, [currentUser, authLoading, router, pathname]);

  // Show loading state while AuthProvider is checking the auth status
  if (authLoading) {
    // console.log("AuthenticatedAppLayout: Showing loading skeleton (auth check in progress)");
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4 p-4 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading user session...</p>
          {/* Optional detailed skeleton */}
          {/* <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-4 w-[250px] mx-auto" />
          <Skeleton className="h-4 w-[200px] mx-auto" /> */}
        </div>
      </div>
    );
  }

  // If not loading but still no user, it means the redirect is in progress.
  // Render a minimal message or loader to avoid rendering children that might depend on the user.
  if (!currentUser) {
    // console.log("AuthenticatedAppLayout: No user after loading check (redirecting). Rendering redirect message.");
     return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
     );
   }

  // If loading is done and user exists, render the main app layout
  // console.log("AuthenticatedAppLayout: User authenticated, rendering main layout.");
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto bg-secondary/50 p-4 md:p-6 lg:p-8">
          {/* Render the actual page content for the authenticated route */}
          {children}
        </main>
      </div>
    </div>
  );
}
