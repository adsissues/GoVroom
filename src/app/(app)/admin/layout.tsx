
"use client";

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!currentUser || currentUser.role !== 'admin')) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access this area.',
        variant: 'destructive',
      });
      router.replace('/dashboard');
    }
  }, [currentUser, loading, router]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <Skeleton className="h-12 w-1/3 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    // This should ideally be caught by the useEffect redirect,
    // but render an explicit message as a fallback.
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have the necessary permissions to view this page.
            Redirecting to dashboard...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <div className="space-y-6">{children}</div>;
}

// Helper for toast, assuming useToast is available in a shared context or hook
// This is a simplified version. In a real app, useToast would be properly set up.
const toast = (options: { title: string, description: string, variant?: "default" | "destructive" }) => {
  if (typeof window !== 'undefined' && (window as any).toast) { // Basic check
    (window as any).toast(options);
  } else {
    console.log(`Toast: ${options.title} - ${options.description}`);
  }
};
