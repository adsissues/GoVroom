
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminRootPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Admin Section</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Welcome to the Admin Area.</p>
          <p className="mt-2">Use the sidebar to navigate to different admin management pages once they are implemented.</p>
        </CardContent>
      </Card>
    </div>
  );
}
