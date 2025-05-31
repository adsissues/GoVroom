
"use client"; // Required for QueryClientProvider and AuthProvider
import type { ReactNode } from 'react';
// Metadata type can be imported, but the object itself needs to be defined in Server Components (page.tsx or parent layout.tsx)
// import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/app/(app)/AuthContext'; // UPDATED IMPORT PATH
import { ThemeProvider } from '@/contexts/ThemeContext'; // Import ThemeProvider

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans', // Use CSS variable for font
});

// Metadata should be defined in specific page.tsx or a server component layout.tsx
// export const metadata: Metadata = {
//   title: 'GoVroom - Shipment Management',
//   description: 'Efficiently manage your shipments with GoVroom.',
// };

// Create a single QueryClient instance
const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/*
        <head /> will contain the components returned by the nearest parent
        head.js. Find out more at https://beta.nextjs.org/docs/api-reference/file-conventions/head
      */}
      <head>
         {/* Basic metadata here, more specific in pages */}
         <title>GoVroom</title>
         <meta name="description" content="Shipment Management Application" />
         {/* Add favicon links here if needed, or use Next.js metadata API */}
         {/* <link rel="icon" href="/favicon.ico" sizes="any" /> */}
      </head>
      <body className={cn("font-sans antialiased", inter.variable)}>
        <ThemeProvider
          defaultTheme="system"
          storageKey="govroom-theme"
        >
          {/* Provide TanStack Query client to the app */}
          <QueryClientProvider client={queryClient}>
            {/* Provide Auth context to the app */}
            <AuthProvider>
              {children}
              {/* Toaster for displaying notifications */}
              <Toaster />
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

// Helper function cn if not imported globally or from utils
// Remove this if you have it in src/lib/utils.ts and import it
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
