
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MANAGED_DROPDOWN_COLLECTIONS, DROPDOWN_COLLECTION_ICONS, type DropdownCollectionConfig } from "@/lib/constants";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, AlertTriangle } from "lucide-react";

export default function DropdownAdminPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!currentUser || currentUser.role !== 'admin')) {
      router.replace('/dashboard'); // Or a dedicated unauthorized page
    }
  }, [currentUser, loading, router]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="shadow-lg rounded-xl animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2 mt-1"></div>
          </CardHeader>
          <CardContent>
            <div className="h-4 bg-muted rounded w-full"></div>
          </CardContent>
          <CardFooter>
            <div className="h-10 bg-muted rounded w-24"></div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md p-6 shadow-xl rounded-xl text-center">
          <CardHeader>
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <CardTitle className="text-2xl">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-lg">
              You do not have permission to view this page.
            </CardDescription>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Dropdown Management</CardTitle>
          <CardDescription>
            Select a category below to manage its dropdown options. These options are used throughout the application.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MANAGED_DROPDOWN_COLLECTIONS.map((collection: DropdownCollectionConfig) => {
          const IconComponent = DROPDOWN_COLLECTION_ICONS[collection.id] || DROPDOWN_COLLECTION_ICONS.default;
          return (
            <Card key={collection.id} className="shadow-lg rounded-xl hover:shadow-2xl transition-shadow duration-200 flex flex-col">
              <CardHeader>
                <div className="flex items-center space-x-3 mb-2">
                  <IconComponent className="h-7 w-7 text-primary" />
                  <CardTitle className="text-xl">{collection.name}</CardTitle>
                </div>
                <CardDescription>{collection.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                {/* Additional info can be placed here if needed */}
              </CardContent>
              <CardFooter>
                <Link href={`/admin/dropdowns/${collection.id}`} passHref legacyBehavior>
                  <Button className="w-full" aria-label={`Manage ${collection.name}`}>
                    Manage {collection.name} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
