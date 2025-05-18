
"use client"; // This layout needs client-side hooks for auth and navigation
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import AppSidebar from '@/components/layout/app-sidebar';
import AppHeader from '@/components/layout/app-header';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar as UiConfigurableSidebar,
  SidebarInset,
} from '@/components/ui/sidebar';

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const renderStartTime = useRef(Date.now());
  const effectExecutionCount = useRef(0);
  // Store previous values of dependencies to log changes
  const prevCurrentUser = useRef(useAuth().currentUser);
  const prevAuthLoading = useRef(useAuth().loading);
  const prevPathname = useRef(usePathname());


  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // console.log(`[AuthenticatedAppLayout] Render START. Path: ${pathname}, Auth Loading: ${authLoading}, User: ${currentUser?.email ?? 'None'}`);

  useEffect(() => {
    const effectId = effectExecutionCount.current++;
    const effectStartTime = Date.now();
    console.log(`[AuthenticatedAppLayout EFFECT #${effectId} START] Path: ${pathname}, Auth Loading: ${authLoading}, User Email: ${currentUser?.email ?? 'None'}, User changed: ${currentUser !== prevCurrentUser.current}, AuthLoading changed: ${authLoading !== prevAuthLoading.current}, Pathname changed: ${pathname !== prevPathname.current}`);

    if (!authLoading && !currentUser) {
      console.log(`[AuthenticatedAppLayout EFFECT #${effectId}] No user found after auth check, redirecting to login from path: ${pathname}`);
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (!authLoading && currentUser) {
      console.log(`[AuthenticatedAppLayout EFFECT #${effectId}] User authenticated. Email: ${currentUser.email}, Role: ${currentUser.role}`);
    } else if (authLoading) {
      console.log(`[AuthenticatedAppLayout EFFECT #${effectId}] Auth is still loading.`);
    }

    // Update refs for next effect run
    prevCurrentUser.current = currentUser;
    prevAuthLoading.current = authLoading;
    prevPathname.current = pathname;

    console.log(`[AuthenticatedAppLayout EFFECT #${effectId} END] Duration: ${Date.now() - effectStartTime}ms`);
  }, [currentUser, authLoading, router, pathname]);

  useEffect(() => {
    const currentRenderTime = Date.now();
    console.log(`[AuthenticatedAppLayout] Render END. Total component render duration: ${currentRenderTime - renderStartTime.current}ms. Path: ${pathname}`);
    renderStartTime.current = currentRenderTime; // Reset for the next render cycle measurement
  });

  if (authLoading) {
    console.log("[AuthenticatedAppLayout] Rendering: Auth is loading, showing Loader component...");
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
    console.log("[AuthenticatedAppLayout] Rendering: No current user after auth load (redirect should be in progress). Showing redirect message.");
     return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
     );
   }

  console.log(`[AuthenticatedAppLayout] Rendering: User authenticated (${currentUser.email}, Role: ${currentUser.role}), rendering main layout with children. Path: ${pathname}`);
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex h-screen bg-background"> {/* Full screen height flex container */}
        <UiConfigurableSidebar> {/* Sidebar component */}
          <AppSidebar /> {/* Sidebar content */}
        </UiConfigurableSidebar>
        
        {/* SidebarInset is a <main> tag, styled as flex-col, flex-1 (horizontally) */}
        <SidebarInset> 
          <AppHeader /> {/* Header, fixed height. This is the first flex child of SidebarInset. */}
          {/* This div is the second flex child and should take remaining vertical space and be scrollable */}
          <div className="flex-1 overflow-y-auto bg-secondary/50 p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
