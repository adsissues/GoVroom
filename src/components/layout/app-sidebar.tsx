
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME, SIDEBAR_NAV_ITEMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { PackageSearch } from 'lucide-react'; // App Logo Icon

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground p-4 shadow-md">
      <div className="flex items-center mb-8">
        <PackageSearch className="h-8 w-8 text-primary mr-2" />
        <h1 className="text-2xl font-semibold text-primary">{APP_NAME}</h1>
      </div>
      <nav>
        <ul>
          {SIDEBAR_NAV_ITEMS.map((item) => (
            <li key={item.title} className="mb-2">
              <Link
                href={item.href}
                className={cn(
                  "flex items-center p-3 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150",
                  pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard')
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground"
                )}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Optional: Footer section in sidebar */}
      {/* <div className="mt-auto pt-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {APP_NAME}</p>
      </div> */}
    </aside>
  );
}
