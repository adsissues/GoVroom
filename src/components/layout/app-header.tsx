
"use client";
import { Bell, UserCircle, Search, LogOut, Sun, Moon, Menu } from 'lucide-react'; // Added Menu
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_NAME, SIDEBAR_NAV_ITEMS } from '@/lib/constants';
import type { NavItem } from '@/lib/constants';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from '../ui/skeleton';
import { SidebarTrigger } from '@/components/ui/sidebar'; // Import SidebarTrigger

const getPageTitle = (pathname: string): string => {
    const findTitle = (items: NavItem[], currentPath: string): string | null => {
        for (const item of items) {
            const isActive = item.matchExact
                ? currentPath === item.href
                : currentPath.startsWith(item.href);

            if (isActive) {
                 if (item.children) {
                    const childTitle = findTitle(item.children, currentPath);
                    if (childTitle) return childTitle;
                 }
                 return item.title;
            }
            if (item.children) {
                 const childTitle = findTitle(item.children, currentPath);
                 if (childTitle) return childTitle;
            }
        }
        return null;
    };

    const title = findTitle(SIDEBAR_NAV_ITEMS, pathname);

    if (pathname.startsWith('/shipments/') && pathname !== '/shipments/new' && pathname !== '/shipments') {
        return 'Shipment Details';
    }
     if (pathname.startsWith('/admin/') && pathname !== '/admin/dropdowns' && pathname !== '/admin/settings') {
         return 'Admin Dashboard';
     }

    return title || APP_NAME;
};


export default function AppHeader() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const { currentUser, signOut, loading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6 shadow-sm sticky top-0 z-30">
      <div className="flex items-center gap-2">
        {/* Sidebar Trigger - will be handled by ui/sidebar's own trigger if collapsible="icon" mode is used for desktop */}
        {/* The ui/sidebar.tsx includes a SidebarTrigger, let's use that. It can be styled or conditionally rendered. */}
        <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground" />
        
        {/* Page Title */}
        <h1 className="text-lg font-semibold text-foreground md:text-xl">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Toggle theme">
              <Sun className="h-5 w-5 rotate-0 scale-100 text-muted-foreground transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 text-muted-foreground scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notifications">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="sr-only">Toggle notifications</span>
        </Button>

        {authLoading ? (
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
              <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
             <UserCircle className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
    </header>
  );
}
