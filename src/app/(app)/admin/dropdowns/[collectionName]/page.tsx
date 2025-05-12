
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDropdownOptionsWithIds, addDropdownOption, updateDropdownOption, deleteDropdownOption, type DropdownOptionWithId } from '@/lib/firebase/dropdowns';
import { MANAGED_DROPDOWN_COLLECTIONS, type DropdownCollectionConfig } from '@/lib/constants';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle as UiAlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, AlertTriangle, UploadCloud, DownloadCloud, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import DropdownItemsTable from '@/components/admin/dropdowns/DropdownItemsTable';
import DropdownItemForm, { type DropdownItemFormData } from '@/components/admin/dropdowns/DropdownItemForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';

export default function ManageDropdownCollectionPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentUser, loading: authLoading } = useAuth();

  const collectionName = typeof params.collectionName === 'string' ? params.collectionName : '';

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DropdownOptionWithId | undefined>(undefined);

  const collectionConfig = useMemo<DropdownCollectionConfig | undefined>(
    () => MANAGED_DROPDOWN_COLLECTIONS.find(c => c.id === collectionName),
    [collectionName]
  );

  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'admin')) {
      router.replace('/dashboard');
    }
    if (!authLoading && currentUser?.role === 'admin' && !collectionConfig) {
      // If collectionName is invalid, redirect to dropdowns admin home
      toast({ title: "Invalid Collection", description: `The dropdown collection "${collectionName}" is not recognized.`, variant: "destructive" });
      router.replace('/admin/dropdowns');
    }
  }, [currentUser, authLoading, router, collectionName, collectionConfig, toast]);

  const queryKey = ['dropdownItems', collectionName];

  const { data: items = [], isLoading: isLoadingItems, error: itemsError } = useQuery<DropdownOptionWithId[]>({
    queryKey: queryKey,
    queryFn: () => getDropdownOptionsWithIds(collectionName),
    enabled: !!collectionName && !!currentUser && currentUser.role === 'admin' && !!collectionConfig,
  });

  const addMutation = useMutation({
    mutationFn: (data: DropdownItemFormData) => addDropdownOption(collectionName, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Option Added", description: "The new dropdown option has been successfully added." });
      setIsFormOpen(false);
    },
    onError: (err) => {
      toast({ title: "Error Adding Option", description: err instanceof Error ? err.message : "Could not add option.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { item: DropdownOptionWithId, formData: DropdownItemFormData }) => updateDropdownOption(collectionName, data.item.id, data.formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Option Updated", description: "The dropdown option has been successfully updated." });
      setIsFormOpen(false);
      setEditingItem(undefined);
    },
    onError: (err) => {
      toast({ title: "Error Updating Option", description: err instanceof Error ? err.message : "Could not update option.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteDropdownOption(collectionName, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Option Deleted", description: "The dropdown option has been successfully deleted." });
    },
    onError: (err) => {
      toast({ title: "Error Deleting Option", description: err instanceof Error ? err.message : "Could not delete option.", variant: "destructive" });
    },
  });

  const handleFormSubmit = async (formData: DropdownItemFormData) => {
    if (editingItem) {
      await updateMutation.mutateAsync({ item: editingItem, formData });
    } else {
      await addMutation.mutateAsync(formData);
    }
  };

  const handleOpenForm = (item?: DropdownOptionWithId) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };
  
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingItem(undefined);
  };

  if (authLoading || (currentUser?.role === 'admin' && !collectionConfig && collectionName)) {
    // Show loading skeleton or a generic loading message while auth or config is resolving
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-12 w-1/4 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
     // This case should ideally be handled by redirection in useEffect,
     // but as a fallback, render an access denied message.
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <UiAlertTitle>Access Denied</UiAlertTitle>
        <AlertDescription>You do not have permission to manage this page.</AlertDescription>
      </Alert>
    );
  }
  
  if (!collectionConfig) {
    // Should have been redirected, but handle defensively
    return <p>Invalid collection selected.</p>;
  }


  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push('/admin/dropdowns')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dropdown Categories
      </Button>

      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Manage: {collectionConfig.name}</CardTitle>
          <CardDescription>{collectionConfig.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) handleCloseForm(); else setIsFormOpen(true); }}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenForm()}>
                  <PlusCircle className="mr-2 h-5 w-5" /> Add New Option
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "Edit Option" : "Add New Option"}</DialogTitle>
                  <DialogDescription>
                    {editingItem ? `Update the details for this option in ${collectionConfig.name}.` : `Add a new option to the ${collectionConfig.name} dropdown.`}
                  </DialogDescription>
                </DialogHeader>
                <DropdownItemForm
                  initialData={editingItem}
                  onSubmit={handleFormSubmit}
                  onCancel={handleCloseForm}
                  isSubmitting={addMutation.isPending || updateMutation.isPending}
                />
              </DialogContent>
            </Dialog>
            <div className="space-x-2">
              <Button variant="outline" disabled> {/* Placeholder for CSV Import */}
                <UploadCloud className="mr-2 h-4 w-4" /> Import CSV
              </Button>
              <Button variant="outline" disabled> {/* Placeholder for CSV Export */}
                <DownloadCloud className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </div>
          </div>

          {isLoadingItems && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {itemsError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <UiAlertTitle>Error Loading Options</UiAlertTitle>
              <AlertDescription>{itemsError.message}</AlertDescription>
            </Alert>
          )}
          {!isLoadingItems && !itemsError && (
            <DropdownItemsTable
              items={items}
              onEdit={handleOpenForm}
              onDelete={(id) => deleteMutation.mutate(id)}
              isLoadingDelete={deleteMutation.isPending}
            />
          )}
        </CardContent>
      </Card>
      <Card className="mt-4 shadow-sm rounded-lg">
        <CardHeader>
            <CardTitle className="text-md">CSV Import/Export</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
                CSV import/export functionality is planned for a future update. This will allow bulk management of dropdown options.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
