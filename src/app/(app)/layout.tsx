
"use client"; // This layout needs to be a client component for useAuth and useRouter
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import AppSidebar from '@/components/layout/app-sidebar';
import AppHeader from '@/components/layout/app-header';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton'; // For loading state

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  console.log(`AuthenticatedAppLayout: Rendering for path: ${pathname}`);
  console.log(`AuthenticatedAppLayout: Loading state: ${loading}`);
  console.log(`AuthenticatedAppLayout: Current user: ${currentUser?.email ?? 'None'}`);

  useEffect(() => {
    console.log(`AuthenticatedAppLayout Effect: Loading: ${loading}, User: ${!!currentUser}`);
    if (!loading && !currentUser) {
      console.log(`AuthenticatedAppLayout Effect: No user found, redirecting to login for path: ${pathname}`);
      // Store the intended path to redirect after login
      // localStorage.setItem('intendedPath', pathname); // Consider security implications of localStorage
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [currentUser, loading, router, pathname]);

  if (loading) {
    console.log("AuthenticatedAppLayout: Showing loading skeleton (auth check in progress)");
    // Show a loading skeleton or a full-page loader
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="space-y-4 p-4 text-center">
           <p className="text-muted-foreground mb-4">Loading user session...</p>
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-4 w-[250px] mx-auto" />
          <Skeleton className="h-4 w-[200px] mx-auto" />
        </div>
      </div>
    );
  }

  // This check might be redundant due to the useEffect redirect, but added for clarity
  if (!currentUser) {
     console.log("AuthenticatedAppLayout: No current user after loading check (should be redirecting). Rendering redirecting message.");
     // Avoid rendering children if user is null, even if redirect hasn't happened yet
     // Displaying a minimal loader prevents potential errors in children expecting a user
     return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
     );
   }


  console.log("AuthenticatedAppLayout: User authenticated, rendering main layout and children.");
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
