
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addDropdownItem, updateDropdownItem } from '@/lib/firebase/dropdownService';
import type { DropdownItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface DropdownFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  collectionName: string;
  item?: DropdownItem | null;
}

const formSchema = z.object({
  label: z.string().min(1, "Label cannot be empty."),
  value: z.string().min(1, "Value cannot be empty.").regex(/^[a-zA-Z0-9_.-]+$/, "Value can only contain letters, numbers, underscores, hyphens, and periods."),
});

type FormValues = z.infer<typeof formSchema>;

export default function DropdownFormDialog({
  isOpen,
  onClose,
  collectionId,
  collectionName,
  item,
}: DropdownFormDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!item;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: useMemo(() => ({ // Use useMemo for stable defaultValues
      label: item?.label ?? '',
      value: item?.value ?? '',
    }), [item]), // Recalculate only when item changes
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        label: item?.label ?? '',
        value: item?.value ?? '',
      });
    }
  }, [isOpen, item, form]); // form is stable from useForm

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (isEditing && item) {
        const updates: Partial<DropdownItem> = {};
        if (data.label !== item.label) updates.label = data.label;
        if (data.value !== item.value) updates.value = data.value;

        if (Object.keys(updates).length > 0) {
          await updateDropdownItem(collectionId, item.id, updates);
        } else {
          return { noChanges: true };
        }
      } else {
        await addDropdownItem(collectionId, data);
      }
      return {};
    },
    onSuccess: (result) => {
      if (result?.noChanges) {
        toast({ title: "No Changes", description: "No changes were made to the item." });
      } else {
        toast({
          title: isEditing ? "Item Updated" : "Item Added",
          description: `Item successfully ${isEditing ? 'updated in' : 'added to'} ${collectionName}.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['dropdownOptions', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['dropdownMaps'] });
      queryClient.invalidateQueries({ queryKey: [`${collectionId}FilterList`] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: `Operation Failed`,
        description: error.message || `Could not ${isEditing ? 'update' : 'add'} item.`,
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit Item in ${collectionName}` : `Add New Item to ${collectionName}`}</DialogTitle>
          <DialogDescription>
            {isEditing ? `Modify the label or value for this item.` : `Enter the label and value for the new item.`} The value is used internally and should be unique.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label (Display Text)</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g., United Parcel Service" {...field} disabled={mutation.isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value (Internal ID)</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g., ups_express (no spaces)" {...field} disabled={mutation.isPending || isEditing} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Use letters, numbers, underscores, hyphens, periods. {isEditing && "Value cannot be changed after creation."}</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending || (isEditing && Object.keys(form.formState.dirtyFields).length === 0)}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (isEditing ? 'Update Item' : 'Add Item')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
