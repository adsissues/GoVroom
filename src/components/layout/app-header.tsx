
"use client";
import Link from 'next/link';
import { Bell, UserCircle, Search, LogOut, Sun, Moon, Menu, PackageSearch, LayoutDashboard, ListChecks, Eye, PlusCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_NAME } from '@/lib/constants'; // SIDEBAR_NAV_ITEMS no longer used here directly
import { usePathname, useRouter } from 'next/navigation';
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
  DropdownMenuGroup, // Added for grouping
} from "@/components/ui/dropdown-menu";
import { Skeleton } from '../ui/skeleton';
// SidebarTrigger is no longer needed as the sidebar is removed

// const getPageTitle = (pathname: string): string => {
//   // This function might need adjustment if page titles were heavily reliant on sidebar structure
//   // For now, we'll simplify or use a direct approach based on current path.
//   if (pathname.startsWith('/dashboard')) return 'Dashboard';
//   if (pathname.startsWith('/shipments/new')) return 'Add New Shipment';
//   if (pathname.startsWith('/shipments/')) return 'Shipment Details';
//   if (pathname.startsWith('/shipments')) return 'Shipments';
//   if (pathname.startsWith('/admin/dropdowns')) return 'Dropdown Management';
//   if (pathname.startsWith('/admin/settings')) return 'Application Settings';
//   if (pathname.startsWith('/admin/users')) return 'User Management';
//   if (pathname.startsWith('/admin')) return 'Admin Dashboard';
//   return APP_NAME;
// };


export default function AppHeader() {
  const pathname = usePathname();
  // const pageTitle = getPageTitle(pathname); // Simplified title logic for now
  const { currentUser, signOut, loading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6 shadow-sm sticky top-0 z-30">
      {/* App Name and Logo */}
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
          <PackageSearch className="h-7 w-7" />
          <span className="text-xl hidden sm:inline">{APP_NAME}</span>
        </Link>
      </div>

      {/* Page Title - Can be more dynamic if needed, or removed if redundant with header context */}
      {/* <h1 className="text-lg font-semibold text-foreground md:text-xl">
        {pageTitle}
      </h1> */}

      <div className="flex items-center gap-1 md:gap-2">
        {/* Main Navigation Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open navigation menu">
              <Menu className="h-5 w-5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Navigation</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/dashboard')} className="cursor-pointer">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </DropdownMenuItem>
            <DropdownMenuGroup> {/* Grouping shipment related items */}
              <DropdownMenuItem onClick={() => handleNavigation('/dashboard')} className="cursor-pointer">
                <ListChecks className="mr-2 h-4 w-4" /> {/* Icon for Pending/Completed */}
                <span>Pending Shipments</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/dashboard')} className="cursor-pointer">
                <ListChecks className="mr-2 h-4 w-4" />
                <span>Completed Shipments</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/shipments')} className="cursor-pointer">
                <Eye className="mr-2 h-4 w-4" />
                <span>View All Shipments</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/shipments/new')} className="cursor-pointer">
                <PlusCircle className="mr-2 h-4 w-4" />
                <span>Add New Shipment</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {currentUser?.role === 'admin' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNavigation('/admin')} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Admin Section</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
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

        {/* Notifications Button - kept for consistency, functionality can be added later */}
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notifications">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="sr-only">Toggle notifications</span>
        </Button>

        {/* User Menu */}
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
