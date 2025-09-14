
"use client";
import Link from 'next/link';
import { Bell, UserCircle, LogOut, Sun, Moon, Menu, PackageSearch, LayoutDashboard, Eye, PlusCircle, Settings, ListChecks, UserCog, Users2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/(app)/AuthContext'; // Corrected import path
import { useTheme, type Theme } from '@/contexts/ThemeContext';
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


export default function AppHeader() {
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
            <DropdownMenuItem onClick={() => handleNavigation('/shipments')} className="cursor-pointer">
              <Eye className="mr-2 h-4 w-4" />
              <span>View All Shipments</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/shipments/new')} className="cursor-pointer">
              <PlusCircle className="mr-2 h-4 w-4" />
              <span>Add New Shipment</span>
            </DropdownMenuItem>
            
            {currentUser?.role === 'admin' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Admin</DropdownMenuLabel>
                {/* Removed: Admin Dashboard link to /admin */}
                <DropdownMenuItem onClick={() => handleNavigation('/admin/dropdowns')} className="cursor-pointer">
                  <ListChecks className="mr-2 h-4 w-4" />
                  <span>Manage Dropdowns</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('/admin/settings')} className="cursor-pointer">
                  <UserCog className="mr-2 h-4 w-4" />
                  <span>App Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('/admin/users')} className="cursor-pointer">
                  <Users2 className="mr-2 h-4 w-4" />
                  <span>User Management</span>
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
            <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

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

