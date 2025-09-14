
"use client"; // Keep as client component if it needs interaction or hooks later

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings } from "lucide-react"; // Example icon

export default function AdminRootPage() {
  // This page assumes it's rendered within AdminLayout, which handles authentication/authorization.
  return (
    <div className="space-y-6">
      <Card className="shadow-lg rounded-xl border">
        <CardHeader>
           <div className="flex items-center gap-3 mb-2">
               <Settings className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl">Admin Dashboard</CardTitle>
           </div>
          <CardDescription>Welcome to the administration area. Use the main navigation menu (top-right) to manage application settings and data.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            Select an option like &quot;Dropdowns&quot;, &quot;Settings&quot;, or &quot;User Management&quot; from the &quot;Admin&quot; section of the main navigation menu to manage administrative tasks.
          </p>
          {/* Add links or quick actions here later if needed */}
          {/* Example:
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/admin/dropdowns"><Button variant="outline">Manage Dropdowns</Button></Link>
            <Link href="/admin/settings"><Button variant="outline">Application Settings</Button></Link>
          </div>
          */}
        </CardContent>
      </Card>
    </div>
  );
}
