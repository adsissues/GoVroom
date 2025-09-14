
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users2 } from "lucide-react";
import UserTable from "@/components/admin/user-table";

export default function UserManagementPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg rounded-xl border">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Users2 className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">User Management</CardTitle>
          </div>
          <CardDescription>
            View, add (to Firestore), edit roles, and delete users (from Firestore). Manage user roles and access.
            <br />
            <span className="text-xs text-muted-foreground">
              Note: Full user creation in Firebase Authentication and deletion from Firebase Authentication requires backend implementation (e.g., Cloud Functions with Admin SDK).
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserTable />
        </CardContent>
      </Card>
    </div>
  );
}

