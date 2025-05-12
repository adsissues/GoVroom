
"use client";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { currentUser } = useAuth();

  return (
    <div className="space-y-6">
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to {currentUser?.role === 'admin' ? 'Admin ' : ''}Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Hello, {currentUser?.email}! This is your dashboard.
          </p>
          <p className="mt-4">
            More features will be added here soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
