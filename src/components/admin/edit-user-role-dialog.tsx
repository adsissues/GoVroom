
"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUserRole } from '@/lib/firebase/users';
import type { User, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface EditUserRoleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null; // Allow user to be null initially
  onRoleUpdated: () => void;
}

const editUserRoleFormSchema = z.object({
  role: z.enum(['user', 'admin'], { required_error: "Role is required." }),
});

type EditUserRoleFormValues = z.infer<typeof editUserRoleFormSchema>;

export default function EditUserRoleDialog({ isOpen, onClose, user, onRoleUpdated }: EditUserRoleDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<EditUserRoleFormValues>({
    resolver: zodResolver(editUserRoleFormSchema),
    defaultValues: {
      role: user?.role || 'user', // Default to 'user' if user or user.role is undefined
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({ role: user.role });
    } else {
      form.reset({ role: 'user' }); // Reset to default if user becomes null
    }
  }, [user, form]); // form is stable

  const editRoleMutation = useMutation({
    mutationFn: async (data: EditUserRoleFormValues) => {
      if (!user) {
        throw new Error("User not available for role update.");
      }
      if (user.role === data.role) {
        return { noChanges: true, email: user.email };
      }
      await updateUserRole(user.uid, data.role);
      return { email: user.email, newRole: data.role };
    },
    onSuccess: (data) => {
      if (data?.noChanges) {
        toast({ title: "No Changes", description: `User ${data.email}'s role was not changed.` });
      } else {
        toast({
          title: "User Role Updated",
          description: `User ${data?.email}'s role successfully updated to ${data?.newRole}.`,
        });
      }
      onRoleUpdated(); // This will refetch the user list via query invalidation
      onClose();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Update Role",
        description: error.message || "Could not update user role.",
      });
    },
  });

  const onSubmit = (data: EditUserRoleFormValues) => {
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "No user selected for role update." });
      return;
    }
    editRoleMutation.mutate(data);
  };

  if (!user) return null; // Don't render if no user is provided (e.g., dialog closed)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Edit User Role</DialogTitle>
          <DialogDescription>
            Change the role for user: <span className="font-semibold">{user.email}</span>
            <br />
            <span className="text-xs text-muted-foreground">UID: <span className="font-mono">{user.uid}</span></span>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={editRoleMutation.isPending}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose} disabled={editRoleMutation.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={editRoleMutation.isPending || !form.formState.isDirty}>
                {editRoleMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating Role...
                  </>
                ) : 'Update Role'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
