
"use client";

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react'; // Added Loader2
import { useToast } from '@/hooks/use-toast'; // Import useToast

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast(); // Initialize toast

  useEffect(() => {
    // console.log(`AdminLayout Effect: Loading: ${authLoading}, User: ${currentUser?.email}, Role: ${currentUser?.role}`);
    // Wait until auth loading is complete
    if (!authLoading) {
      // If not loading and user is not found OR user is not admin
      if (!currentUser || currentUser.role !== 'admin') {
        console.log("AdminLayout: Access denied, redirecting to dashboard.");
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to access this area.',
          variant: 'destructive',
        });
        router.replace('/dashboard'); // Use replace to prevent back navigation to admin area
      }
      // If user is admin, do nothing (allow access)
    }
  }, [currentUser, authLoading, router, toast]);

  // Show loading state while checking auth/role
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {/* Optional Skeleton layout */}
        {/* <div className="p-4 md:p-6 lg:p-8 space-y-4 w-full max-w-4xl">
          <Skeleton className="h-12 w-1/3 rounded-lg" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div> */}
      </div>
    );
  }

  // If loading is done, but user is not admin (this condition should be caught by useEffect redirect)
  // Render a fallback message while redirect happens, or if redirect fails.
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have the necessary permissions to view this page. Redirecting...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If loading is done and user IS admin, render the children
  // console.log("AdminLayout: Access granted, rendering admin content.");
  return <div className="space-y-6">{children}</div>;
}
