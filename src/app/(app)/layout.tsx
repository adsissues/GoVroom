
import type { ReactNode } from 'react';
import AppSidebar from '@/components/layout/app-sidebar';
import AppHeader from '@/components/layout/app-header';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GoVroom App', // More specific title for authenticated section
  description: 'Manage your GoVroom shipments and dashboard.',
};

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
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
