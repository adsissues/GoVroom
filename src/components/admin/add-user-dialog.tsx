
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUserDocument, adminCreateAuthUser } from '@/lib/firebase/users';
import type { UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AddUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: () => void;
}

const addUserFormSchema = z.object({
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  // Password for client-side form, but not directly used to create Auth user client-side
  password: z.string().min(6, "Password must be at least 6 characters."),
  confirmPassword: z.string().min(6, "Please confirm password."),
  role: z.enum(['user', 'admin'], { required_error: "Role is required." }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AddUserFormValues = z.infer<typeof addUserFormSchema>;

export default function AddUserDialog({ isOpen, onClose, onUserAdded }: AddUserDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [backendNote, setBackendNote] = useState<string | null>(null);

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserFormSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      role: 'user',
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (data: AddUserFormValues) => {
      // Step 1: Placeholder for Firebase Auth user creation
      // In a real app, this would call a Cloud Function that uses the Admin SDK
      // to create the user in Firebase Authentication with the email and password.
      // The Cloud Function would return the new user's UID.
      let newAuthUserUid: string;
      try {
        // This is a placeholder. The actual password from the form should be sent
        // to the backend function.
        newAuthUserUid = await adminCreateAuthUser(data.email, data.password);
        setBackendNote(`Placeholder: Firebase Auth user with email ${data.email} 'created' (mock UID: ${newAuthUserUid}). Implement backend Cloud Function for actual Auth user creation.`);
      } catch (authError: any) {
        console.error("Error in placeholder adminCreateAuthUser:", authError);
        setBackendNote(`Error in placeholder adminCreateAuthUser: ${authError.message}. This step requires backend implementation.`);
        // Decide if you want to proceed with Firestore doc creation if Auth placeholder fails.
        // For now, we'll throw to stop, as a real app would likely require Auth success.
        throw new Error(`Placeholder Auth user creation failed: ${authError.message}`);
      }

      // Step 2: Create the user document in Firestore with the UID from Auth
      await createUserDocument(newAuthUserUid, data.email, data.role);
      return { email: data.email, role: data.role, uid: newAuthUserUid };
    },
    onSuccess: (data) => {
      toast({
        title: "User Document Added to Firestore",
        description: `User ${data.email} (Role: ${data.role}, UID: ${data.uid}) added to Firestore. ${backendNote || ''}`,
      });
      onUserAdded();
      onClose();
      form.reset();
      setBackendNote(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Add User Document",
        description: error.message || "Could not add user document to Firestore.",
      });
      setBackendNote(null); // Clear backend note on generic error
    },
  });

  const onSubmit = (data: AddUserFormValues) => {
    setBackendNote(null); // Clear previous notes
    addUserMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); form.reset(); setBackendNote(null); } }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Enter user details. Actual user creation in Firebase Authentication requires backend setup.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="default" className="mt-4 bg-amber-50 border-amber-200 text-amber-700">
          <AlertTriangle className="h-4 w-4 !text-amber-600" />
          <AlertTitle className="text-amber-800">Backend Implementation Required</AlertTitle>
          <AlertDescription>
            Creating a new user in Firebase Authentication (with password and assigned role)
            must be done via a secure backend (e.g., Firebase Cloud Function using the Admin SDK).
            This form will create a user document in Firestore and uses a placeholder for Auth creation.
          </AlertDescription>
        </Alert>

        {backendNote && (
          <Alert variant="default" className="mt-2 bg-blue-50 border-blue-200 text-blue-700">
            <AlertDescription>{backendNote}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="user@example.com" {...field} disabled={addUserMutation.isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} disabled={addUserMutation.isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} disabled={addUserMutation.isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={addUserMutation.isPending}>
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
                <Button type="button" variant="outline" onClick={() => { onClose(); form.reset(); setBackendNote(null); }} disabled={addUserMutation.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={addUserMutation.isPending}>
                {addUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...
                  </>
                ) : 'Add User to Firestore'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
