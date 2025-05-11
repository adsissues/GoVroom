
"use client"; // Required for QueryClientProvider
import type { Metadata } from 'next'; // Metadata can still be exported from client component layouts
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

// export const metadata: Metadata = { // Metadata object cannot be exported from client component. Place in a server component parent or page.
//   title: 'GoVroom - Shipment Management',
//   description: 'Efficiently manage your shipments with GoVroom.',
// };

// Create a client
const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Metadata tags should be here or in specific page.tsx files for better SEO and granularity */}
        <title>GoVroom - Shipment Management</title>
        <meta name="description" content="Efficiently manage your shipments with GoVroom." />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster />
        </QueryClientProvider>
      </body>
    </html>
  );
}
