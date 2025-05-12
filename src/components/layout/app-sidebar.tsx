
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME, SIDEBAR_NAV_ITEMS, type NavItem } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { PackageSearch, ChevronDown, ChevronRight } from 'lucide-react'; // App Logo Icon
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"


export default function AppSidebar() {
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const [openAdminSubmenu, setOpenAdminSubmenu] = useState(false);

  useEffect(() => {
    // Open admin submenu if current path is an admin path
    if (pathname.startsWith('/admin')) {
      setOpenAdminSubmenu(true);
    }
  }, [pathname]);

  const isLinkActive = (href: string, isParent = false) => {
    if (isParent) {
      return pathname.startsWith(href);
    }
    return pathname === href || (pathname.startsWith(href) && href !== '/dashboard');
  };


  return (
    <aside className="w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground p-4 shadow-md">
      <div className="flex items-center mb-8">
        <PackageSearch className="h-8 w-8 text-primary mr-2" />
        <h1 className="text-2xl font-semibold text-primary">{APP_NAME}</h1>
      </div>
      <nav>
        <ul className="space-y-1">
          {SIDEBAR_NAV_ITEMS.map((item: NavItem) => {
            if (item.adminOnly && currentUser?.role !== 'admin') {
              return null; 
            }

            if (item.children && item.children.length > 0) {
              // This is a parent item with a submenu
              const isActiveParent = isLinkActive(item.href, true);
              return (
                <li key={item.title}>
                  <Accordion type="single" collapsible defaultValue={isActiveParent ? item.href : undefined}>
                    <AccordionItem value={item.href} className="border-b-0">
                      <AccordionTrigger 
                        className={cn(
                          "flex items-center justify-between w-full p-3 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150",
                          isActiveParent ? "bg-primary text-primary-foreground shadow-sm" : "text-sidebar-foreground"
                        )}
                      >
                        <div className="flex items-center">
                          <item.icon className="mr-3 h-5 w-5" />
                          {item.title}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pl-4 pt-1 pb-0">
                        <ul className="space-y-1">
                          {item.children.map(childItem => (
                             <li key={childItem.title}>
                               <Link
                                 href={childItem.href}
                                 className={cn(
                                   "flex items-center p-2.5 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150 text-sm",
                                   isLinkActive(childItem.href)
                                     ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                     : "text-sidebar-foreground"
                                 )}
                               >
                                 <childItem.icon className="mr-3 h-4 w-4" />
                                 {childItem.title}
                               </Link>
                             </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </li>
              );
            }

            // Regular item without submenu
            return (
              <li key={item.title}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center p-3 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150",
                    isLinkActive(item.href)
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground"
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
