
"use client"; // This layout needs to be a client component for useAuth and useRouter
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import AppSidebar from '@/components/layout/app-sidebar';
import AppHeader from '@/components/layout/app-header';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton'; // For loading state

// Metadata can't be exported from client component layout directly in App Router.
// It should be defined in parent server component layouts or pages.
// export const metadata: Metadata = {
//   title: 'GoVroom App',
//   description: 'Manage your GoVroom shipments and dashboard.',
// };

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !currentUser) {
      // Store the intended path to redirect after login
      // localStorage.setItem('intendedPath', pathname); // Consider security implications of localStorage
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [currentUser, loading, router, pathname]);

  if (loading || !currentUser) {
    // Show a loading skeleton or a full-page loader
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="space-y-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    );
  }

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
