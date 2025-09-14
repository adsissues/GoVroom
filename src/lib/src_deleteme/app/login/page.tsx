
"use client";

import React from 'react'; // Removed Suspense as dynamic import handles loading
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamically import LoginFormCore with SSR turned off
const LoginFormCore = dynamic(() => import('@/components/auth/LoginFormCore'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
      <div className="flex flex-col items-center space-y-2">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading Login...</p>
      </div>
    </div>
  ),
});

export default function LoginPage() {
  // The dynamic import itself acts as a Suspense boundary with its 'loading' prop
  return <LoginFormCore />;
}
