
"use client";

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDropdownOptions,
  deleteDropdownItem,
  deleteDropdownItemsBatch,
} from '@/lib/firebase/dropdownService';
import type { DropdownItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2, Loader2, AlertTriangle, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DropdownFormDialog from './dropdown-form-dialog';
import { Skeleton } from '../ui/skeleton';

interface DropdownTableProps {
  collectionId: string;
  collectionName: string;
}

export default function DropdownTable({ collectionId, collectionName }: DropdownTableProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DropdownItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});

  const queryKey = useMemo(() => ['dropdownOptions', collectionId], [collectionId]);

  const { data: items = [], isLoading, error, refetch } = useQuery<DropdownItem[], Error>({
    queryKey: queryKey,
    queryFn: () => getDropdownOptions(collectionId),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteDropdownItem(collectionId, itemId),
    onSuccess: (_, itemId) => {
      toast({ title: "Item Deleted", description: `Item removed successfully from ${collectionName}.` });
      queryClient.invalidateQueries({ queryKey: queryKey });
      queryClient.invalidateQueries({ queryKey: ['dropdownMaps'] });
      queryClient.invalidateQueries({ queryKey: [`${collectionId}FilterList`] }); // Invalidate specific filter list cache
      setSelectedItems(prev => {
        const newSelection = { ...prev };
        delete newSelection[itemId];
        return newSelection;
      });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Deletion Failed", description: error.message });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (itemIds: string[]) => deleteDropdownItemsBatch(collectionId, itemIds),
    onSuccess: (_, variables) => {
      toast({ title: "Items Deleted", description: `${variables.length} items removed successfully.` });
      queryClient.invalidateQueries({ queryKey: queryKey });
      queryClient.invalidateQueries({ queryKey: ['dropdownMaps'] });
      queryClient.invalidateQueries({ queryKey: [`${collectionId}FilterList`] });
      setSelectedItems({});
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Batch Deletion Failed", description: error.message });
    },
  });

  const handleAddItem = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const handleEditItem = (item: DropdownItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleDeleteItem = (itemId: string) => {
    deleteMutation.mutate(itemId);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingItem(null);
  };

  const handleSelectionChange = (itemId: string, checked: boolean | string) => {
    const isChecked = checked === true;
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: isChecked,
    }));
  };

  const handleSelectAll = (checked: boolean | string) => {
    const isChecked = checked === true;
    const newSelection: Record<string, boolean> = {};
    if (isChecked && items) {
      items.forEach(item => {
        newSelection[item.id] = true;
      });
    }
    setSelectedItems(newSelection);
  };

  const selectedItemIds = useMemo(() => {
    return Object.entries(selectedItems)
      .filter(([, isSelected]) => isSelected)
      .map(([id]) => id);
  }, [selectedItems]);

  const handleDeleteSelected = () => {
    if (selectedItemIds.length > 0) {
      batchDeleteMutation.mutate(selectedItemIds);
    } else {
      toast({ variant: "default", title: "No Items Selected", description: "Please select items to delete." });
    }
  };

  const isAllSelected = items && items.length > 0 && selectedItemIds.length === items.length;
  const isIndeterminate = selectedItemIds.length > 0 && selectedItemIds.length < (items?.length || 0);
  const selectAllState = isAllSelected ? true : (isIndeterminate ? 'indeterminate' : false);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          {selectedItemIds.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={batchDeleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({selectedItemIds.length})
                  {batchDeleteMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Selected Items?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedItemIds.length} selected items from the '{collectionName}' list? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive hover:bg-destructive/90">
                    Delete Selected
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleAddItem}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>
            {error.message || `Could not load items for ${collectionName}.`}
            <Button variant="secondary" size="sm" onClick={() => refetch()} className="ml-4">Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && items && (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectAllState}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all rows"
                    disabled={!items || items.length === 0}
                  />
                </TableHead>
                <TableHead>Label (User-facing text)</TableHead>
                <TableHead>Value (Stored identifier)</TableHead>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No items found in this list. Add items using the button above.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id} data-state={selectedItems[item.id] ? "selected" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems[item.id] || false}
                        onCheckedChange={(checked) => handleSelectionChange(item.id, checked)}
                        aria-label={`Select row ${item.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="font-mono text-xs">{item.value}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1">
                        <Button variant="ghost" size="icon" title="Edit Item" onClick={() => handleEditItem(item)}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete Item" disabled={deleteMutation.isPending && deleteMutation.variables === item.id}>
                              {(deleteMutation.isPending && deleteMutation.variables === item.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              <span className="sr-only">Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the item:
                                <br /><strong>Label:</strong> {item.label} <br /><strong>Value:</strong> {item.value}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteItem(item.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete Item
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <DropdownFormDialog
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        collectionId={collectionId}
        collectionName={collectionName}
        item={editingItem}
      />
    </div>
  );
}
