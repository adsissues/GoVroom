
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Using Inter as a professional sans-serif font
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // For potential notifications

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans', // Changed from geist to inter
});

export const metadata: Metadata = {
  title: 'GoVroom - Shipment Management',
  description: 'Efficiently manage your shipments with GoVroom.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
