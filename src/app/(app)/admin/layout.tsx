
"use client";

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    console.log(
      `[AdminLayout Effect Triggered] Auth Loading: ${authLoading}, User Email: ${currentUser?.email ?? 'N/A'}, User Role: ${currentUser?.role ?? 'N/A'}`
    );

    if (!authLoading) {
      console.log('[AdminLayout Effect] Auth loading is complete. Checking user role...');
      const isUserPresent = !!currentUser;
      const userRole = currentUser?.role;
      console.log(`[AdminLayout Effect] User Present: ${isUserPresent}, User Role (from context): ${userRole}`);

      if (!currentUser || currentUser.role !== 'admin') {
        console.warn(
          `[AdminLayout Effect] Access Denied. User: ${currentUser?.email ?? 'None'}, Role: ${currentUser?.role ?? 'None'}. Redirecting to /dashboard.`
        );
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to access this area. Redirecting.',
          variant: 'destructive',
        });
        router.replace('/dashboard');
      } else {
        console.log(`[AdminLayout Effect] Access Granted. User: ${currentUser.email}, Role: ${currentUser.role}`);
      }
    } else {
      console.log('[AdminLayout Effect] Auth still loading...');
    }
  }, [currentUser, authLoading, router, toast]);

  if (authLoading) {
    console.log('[AdminLayout Rendering] Auth is loading, showing Loader...');
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // This part primarily handles the UI display while the redirect from useEffect might be happening.
  // The useEffect is the main gatekeeper for access.
  if (!currentUser || currentUser.role !== 'admin') {
    console.log(`[AdminLayout Rendering] No current user or user is not admin after auth load. User Email: ${currentUser?.email}, Role: ${currentUser?.role}. Showing Access Denied message.`);
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have the necessary permissions to view this page. You might be redirected shortly.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  console.log(`[AdminLayout Rendering] User is admin (${currentUser.email}), rendering children.`);
  return <div className="space-y-6">{children}</div>;
}
