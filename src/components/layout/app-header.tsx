
"use client";
import { Bell, UserCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_NAME } from '@/lib/constants';
import { usePathname } from 'next/navigation';

// Helper to get page title from path
const getPageTitle = (pathname: string): string => {
  if (pathname === '/dashboard') return 'Dashboard';
  if (pathname.startsWith('/shipments/new')) return 'Add New Shipment';
  if (pathname.startsWith('/shipments')) return 'Shipments';
  return APP_NAME; // Default title
};


export default function AppHeader() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-card-foreground">{pageTitle}</h2>
      </div>
      <div className="flex items-center space-x-4">
        {/* Global Search (optional) */}
        {/* <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-10 w-64" />
        </div> */}
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="User Profile">
          <UserCircle className="h-6 w-6 text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}
