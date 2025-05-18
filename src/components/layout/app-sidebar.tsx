
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME, SIDEBAR_NAV_ITEMS, type NavItem } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { PackageSearch } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Skeleton } from '../ui/skeleton';
import {
  SidebarHeader as UiSidebarHeader, // Using an alias for clarity
  SidebarContent as UiSidebarContent, // Using an alias for clarity
  // We might use SidebarMenu, SidebarMenuItem from ui/sidebar later for a more integrated look
} from '@/components/ui/sidebar';

export default function AppSidebar() {
  const pathname = usePathname();
  const { currentUser, loading: authLoading } = useAuth();
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([]);

  const isLinkActive = (href: string, isParent = false, matchExact?: boolean): boolean => {
    if (matchExact) {
      return pathname === href;
    }
    if (isParent) {
      return pathname.startsWith(href);
    }
    return pathname === href;
  };

  useEffect(() => {
      const activeParent = SIDEBAR_NAV_ITEMS.find(item => item.children && pathname.startsWith(item.href));
      if (activeParent) {
          setOpenSubmenus([activeParent.href]);
      } else {
          // Check if a non-parent link is active and its parent should be open
          const currentActiveItem = SIDEBAR_NAV_ITEMS.flatMap(i => i.children || i).find(subItem => pathname === subItem.href);
          if (currentActiveItem) {
            const parent = SIDEBAR_NAV_ITEMS.find(p => p.children?.some(c => c.href === currentActiveItem.href));
            if (parent) {
              setOpenSubmenus([parent.href]);
            } else {
              setOpenSubmenus([]);
            }
          } else {
             setOpenSubmenus([]);
          }
      }
  }, [pathname]);


  const handleAccordionChange = (value: string[]) => {
    setOpenSubmenus(value);
  };

  // This component now returns the content for the Sidebar defined in ui/sidebar.tsx
  return (
    <>
      <UiSidebarHeader className="flex h-16 items-center border-b border-sidebar-border px-4 shrink-0 sticky top-0 bg-sidebar z-10">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
            <PackageSearch className="h-7 w-7" />
            {/* Text span will be hidden by ui/sidebar when collapsed to icon mode */}
            <span className="text-xl group-data-[collapsible=icon]:hidden">{APP_NAME}</span>
        </Link>
      </UiSidebarHeader>

      <UiSidebarContent className="flex-1 overflow-y-auto p-0 group-data-[collapsible=icon]:px-2"> {/* Remove padding p-4 if items handle it */}
         {authLoading ? (
             <div className="space-y-2 p-4 group-data-[collapsible=icon]:hidden">
                 <Skeleton className="h-10 w-full rounded-lg" />
                 <Skeleton className="h-10 w-full rounded-lg" />
                 <Skeleton className="h-10 w-full rounded-lg" />
                 <Skeleton className="h-10 w-full rounded-lg" />
             </div>
             // Icon-only skeletons for collapsed state
         ) : (
             <Accordion
                 type="multiple"
                 value={openSubmenus}
                 onValueChange={handleAccordionChange}
                 className="w-full space-y-1 p-2 group-data-[collapsible=icon]:hidden" // Padding for expanded
             >
             {SIDEBAR_NAV_ITEMS.map((item: NavItem) => {
                 if (item.adminOnly && currentUser?.role !== 'admin') {
                 return null;
                 }

                 if (item.children && item.children.length > 0) {
                 const isActiveParent = isLinkActive(item.href, true);
                 return (
                     <AccordionItem key={item.href} value={item.href} className="border-b-0">
                     <AccordionTrigger
                         className={cn(
                         "flex items-center justify-between w-full p-3 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150 text-base font-medium",
                         isActiveParent ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-inner" : "text-sidebar-foreground hover:text-sidebar-accent-foreground",
                         "hover:no-underline [&[data-state=open]>svg]:rotate-180"
                         )}
                     >
                         <div className="flex items-center gap-3">
                            <item.icon className="h-5 w-5" />
                            <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                         </div>
                     </AccordionTrigger>
                     <AccordionContent className="pl-5 pt-1 pb-0 mt-1 space-y-1 group-data-[collapsible=icon]:hidden">
                         {item.children.map(childItem => {
                              if (childItem.adminOnly && currentUser?.role !== 'admin') {
                                 return null;
                              }
                             return (
                             <Link
                                 key={childItem.href}
                                 href={childItem.href}
                                 className={cn(
                                 "flex items-center p-2.5 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150 text-sm",
                                 isLinkActive(childItem.href, false, childItem.matchExact)
                                     ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                                     : "text-sidebar-foreground/80 hover:text-sidebar-accent-foreground"
                                 )}
                             >
                                 <span className="ml-8">{childItem.title}</span>
                             </Link>
                             );
                         })}
                     </AccordionContent>
                     </AccordionItem>
                 );
                 }

                 return (
                 <div key={item.href} className="px-1.5"> {/* Wrapper for padding consistency */}
                     <Link
                        href={item.href}
                        className={cn(
                            "flex items-center p-3 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150 text-base font-medium",
                            isLinkActive(item.href, false, item.matchExact)
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
                        )}
                        title={item.title} // Tooltip for icon-only mode
                     >
                        <item.icon className="mr-3 h-5 w-5 group-data-[collapsible=icon]:mr-0" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                     </Link>
                 </div>
                 );
             })}
             </Accordion>
         )}
         {/* Minimal version for icon-only (collapsed) state */}
         {!authLoading && (
            <div className="hidden group-data-[collapsible=icon]:flex flex-col space-y-1 p-2 items-center">
                {SIDEBAR_NAV_ITEMS.map((item: NavItem) => {
                    if (item.adminOnly && currentUser?.role !== 'admin') return null;
                     // In icon mode, don't show children or accordion, just top-level icons
                     return (
                        <Link
                            key={`${item.href}-icon`}
                            href={item.children && item.children.length > 0 ? item.children[0].href : item.href} // Link to first child or self
                            className={cn(
                                "flex items-center justify-center p-3 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150",
                                (item.children ? item.children.some(c => isLinkActive(c.href, false, c.matchExact)) : isLinkActive(item.href, false, item.matchExact))
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
                            )}
                            title={item.title}
                        >
                            <item.icon className="h-5 w-5" />
                        </Link>
                     );
                })}
            </div>
         )}
      </UiSidebarContent>
    </>
  );
}
