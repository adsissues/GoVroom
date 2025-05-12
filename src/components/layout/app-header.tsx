
"use client";
import { Bell, UserCircle, Search, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_NAME, SIDEBAR_NAV_ITEMS } from '@/lib/constants';
import type { NavItem } from '@/lib/constants';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from '../ui/skeleton'; // For loading state

// Helper to get page title from path, searching through NavItems
const getPageTitle = (pathname: string): string => {
    const findTitle = (items: NavItem[], currentPath: string): string | null => {
        for (const item of items) {
            // Exact match or prefix match for parent items
            const isActive = item.matchExact
                ? currentPath === item.href
                : currentPath.startsWith(item.href);

            if (isActive) {
                 // If it's a parent, prefer child match if available
                 if (item.children) {
                    const childTitle = findTitle(item.children, currentPath);
                    if (childTitle) return childTitle;
                 }
                 return item.title; // Return parent title if no specific child matches
            }
            // Check children recursively even if parent isn't active (for nested paths)
            if (item.children) {
                 const childTitle = findTitle(item.children, currentPath);
                 if (childTitle) return childTitle;
            }
        }
        return null;
    };

    const title = findTitle(SIDEBAR_NAV_ITEMS, pathname);

    // Specific overrides if needed
    if (pathname.startsWith('/shipments/') && pathname !== '/shipments/new' && pathname !== '/shipments') {
        return 'Shipment Details';
    }
     if (pathname.startsWith('/admin/') && pathname !== '/admin/dropdowns' && pathname !== '/admin/settings') {
         return 'Admin Dashboard'; // Default admin title
     }


    return title || APP_NAME; // Fallback to App Name
};


export default function AppHeader() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const { currentUser, signOut, loading } = useAuth(); // Get loading state

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6 shadow-sm sticky top-0 z-30">
      {/* Page Title */}
      <div>
        <h1 className="text-lg font-semibold text-foreground md:text-xl">
          {pageTitle}
        </h1>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Global Search (Optional - Placeholder) */}
        {/* <form className="ml-auto flex-1 sm:flex-initial">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
            />
          </div>
        </form> */}

        {/* Notification Bell */}
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notifications">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="sr-only">Toggle notifications</span>
        </Button>

        {/* User Profile Dropdown */}
        {loading ? (
             <Skeleton className="h-8 w-8 rounded-full" />
        ) : currentUser ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="User menu">
                <UserCircle className="h-6 w-6 text-muted-foreground hover:text-primary" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">My Account</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">
                    {currentUser.email}
                  </p>
                   <p className="text-xs leading-none text-muted-foreground capitalize">
                     Role: {currentUser.role}
                   </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* Add more items like Profile, Settings if needed */}
              {/* <DropdownMenuItem>Profile</DropdownMenuItem> */}
              {/* <DropdownMenuItem>Settings</DropdownMenuItem> */}
              {/* <DropdownMenuSeparator /> */}
              <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
             // Render something if loading is done but user is still null (shouldn't happen in protected layout)
             <UserCircle className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
    </header>
  );
}
