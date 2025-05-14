
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MANAGED_DROPDOWN_COLLECTIONS, type DropdownCollectionConfig } from '@/lib/constants';
import DropdownTable from '@/components/admin/dropdown-table';
import { List } from 'lucide-react';

export default function DropdownAdminPage() {
  const [selectedCollection, setSelectedCollection] = useState<DropdownCollectionConfig | null>(null);

  const handleCollectionChange = (value: string) => {
    const collection = MANAGED_DROPDOWN_COLLECTIONS.find(c => c.id === value) || null;
    setSelectedCollection(collection);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg rounded-xl border">
        <CardHeader>
            <div className="flex items-center gap-3 mb-2">
                 <List className="h-6 w-6 text-primary" />
                 <CardTitle className="text-2xl">Dropdown Management</CardTitle>
            </div>
          <CardDescription>
            Select a dropdown list to view, add, edit, or delete its options.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 max-w-sm space-y-2">
            <Label htmlFor="collection-select">Select Dropdown List</Label>
            <Select onValueChange={handleCollectionChange} value={selectedCollection?.id || ""}>
              <SelectTrigger id="collection-select">
                <SelectValue placeholder="Choose a list to manage..." />
              </SelectTrigger>
              <SelectContent>
                {MANAGED_DROPDOWN_COLLECTIONS.map((collection) => (
                  <SelectItem key={collection.id} value={collection.id}>
                    {collection.name} ({collection.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCollection && (
            <div className="mt-6 border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">
                Managing: {selectedCollection.name}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">{selectedCollection.description}</p>
              <DropdownTable
                key={selectedCollection.id} // Ensure re-mount when collection changes
                collectionId={selectedCollection.id}
                collectionName={selectedCollection.name}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
