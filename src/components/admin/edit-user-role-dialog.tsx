
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
  user: User;
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
      role: user.role,
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({ role: user.role });
    }
  }, [user, form]);

  const editRoleMutation = useMutation({
    mutationFn: async (data: EditUserRoleFormValues) => {
      if (user.role === data.role) {
        // If role hasn't changed, we can skip the update to avoid unnecessary writes
        return { noChanges: true };
      }
      await updateUserRole(user.uid, data.role);
      return { email: user.email, newRole: data.role };
    },
    onSuccess: (data) => {
      if (data?.noChanges) {
        toast({ title: "No Changes", description: `User ${user.email}'s role was not changed.` });
      } else {
        toast({
          title: "User Role Updated",
          description: `User ${data?.email}'s role successfully updated to ${data?.newRole}.`,
        });
      }
      onRoleUpdated();
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
    editRoleMutation.mutate(data);
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Edit User Role</DialogTitle>
          <DialogDescription>
            Change the role for user: <span className="font-semibold">{user.email}</span> (UID: <span className="font-mono text-xs">{user.uid}</span>).
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
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
