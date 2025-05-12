
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME, SIDEBAR_NAV_ITEMS, type NavItem } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { PackageSearch, ChevronDown, ChevronRight } from 'lucide-react'; // App Logo Icon + Accordion Icons
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Skeleton } from '../ui/skeleton'; // For loading state

export default function AppSidebar() {
  const pathname = usePathname();
  const { currentUser, loading: authLoading } = useAuth();
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([]); // Store hrefs of open submenus

  // Function to check if a link (or its parent) is active
  const isLinkActive = (href: string, isParent = false): boolean => {
    if (isParent) {
      // Parent is active if the current path starts with the parent's href
      return pathname.startsWith(href);
    }
    // Exact match for non-parent items or specified exact match items
    return pathname === href;
  };

  // Determine initially open submenus based on current path
  useEffect(() => {
      const activeParent = SIDEBAR_NAV_ITEMS.find(item => item.children && pathname.startsWith(item.href));
      if (activeParent) {
          setOpenSubmenus([activeParent.href]);
      } else {
          setOpenSubmenus([]); // Close all if no parent matches
      }
  }, [pathname]); // Re-run when path changes


  // Handle Accordion open/close state
  const handleAccordionChange = (value: string[]) => {
    setOpenSubmenus(value);
  };


  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-md h-screen sticky top-0">
      {/* Logo/Header */}
      <div className="flex h-16 items-center border-b px-4 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
            <PackageSearch className="h-7 w-7" />
            <span className="text-xl">{APP_NAME}</span>
        </Link>
      </div>

       {/* Navigation */}
       <nav className="flex-1 overflow-y-auto p-4">
         {authLoading ? (
             // Skeleton Loading State for Sidebar Items
             <div className="space-y-2">
                 <Skeleton className="h-10 w-full rounded-lg" />
                 <Skeleton className="h-10 w-full rounded-lg" />
                 <Skeleton className="h-10 w-full rounded-lg" />
                 <Skeleton className="h-10 w-full rounded-lg" />
             </div>
         ) : (
             <Accordion
                 type="multiple" // Allow multiple sections open
                 value={openSubmenus}
                 onValueChange={handleAccordionChange}
                 className="w-full space-y-1"
             >
             {SIDEBAR_NAV_ITEMS.map((item: NavItem) => {
                 // Hide admin items if user is not admin
                 if (item.adminOnly && currentUser?.role !== 'admin') {
                 return null;
                 }

                 // Render items with children as AccordionItems
                 if (item.children && item.children.length > 0) {
                 const isActiveParent = isLinkActive(item.href, true);
                 return (
                     <AccordionItem key={item.href} value={item.href} className="border-b-0">
                     <AccordionTrigger
                         className={cn(
                         "flex items-center justify-between w-full p-3 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150 text-base font-medium",
                         isActiveParent ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-inner" : "text-sidebar-foreground hover:text-sidebar-accent-foreground",
                         // Remove default chevron and padding adjustments for custom icon placement
                         "hover:no-underline [&[data-state=open]>svg]:rotate-180"
                         )}
                     >
                         <div className="flex items-center gap-3">
                            <item.icon className="h-5 w-5" />
                            {item.title}
                         </div>
                         {/* Custom Chevron replacement moved outside the main div */}
                         {/* <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" /> */}
                     </AccordionTrigger>
                     <AccordionContent className="pl-5 pt-1 pb-0 mt-1 space-y-1">
                         {item.children.map(childItem => {
                             // Hide admin children if user is not admin
                              if (childItem.adminOnly && currentUser?.role !== 'admin') {
                                 return null;
                              }
                             return (
                             <Link
                                 key={childItem.href}
                                 href={childItem.href}
                                 className={cn(
                                 "flex items-center p-2.5 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150 text-sm",
                                 isLinkActive(childItem.href, childItem.matchExact === false) // Use matchExact flag
                                     ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                                     : "text-sidebar-foreground/80 hover:text-sidebar-accent-foreground"
                                 )}
                             >
                                 {/* Optional: Add child icon */}
                                 {/* <childItem.icon className="mr-3 h-4 w-4" /> */}
                                 <span className="ml-8">{childItem.title}</span> {/* Indent child items */}
                             </Link>
                             );
                         })}
                     </AccordionContent>
                     </AccordionItem>
                 );
                 }

                 // Render regular items (without children) as simple Links
                 return (
                 <div key={item.href}> {/* Changed from li to div as AccordionItem is the li now */}
                     <Link
                     href={item.href}
                     className={cn(
                         "flex items-center p-3 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150 text-base font-medium",
                         isLinkActive(item.href, item.matchExact) // Use matchExact flag
                         ? "bg-primary text-primary-foreground shadow-sm"
                         : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
                     )}
                     >
                     <item.icon className="mr-3 h-5 w-5" />
                     {item.title}
                     </Link>
                 </div>
                 );
             })}
             </Accordion>
         )}
       </nav>

       {/* Optional Footer */}
       {/* <div className="mt-auto p-4 border-t">
           <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} {APP_NAME}</p>
       </div> */}
    </aside>
  );
}
