
"use client";

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllUsers, deleteUserDocument, adminDeleteAuthUser } from '@/lib/firebase/users';
import type { User, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
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
import { PlusCircle, Edit, Trash2, Loader2, AlertTriangle, UserX, ShieldCheck, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AddUserDialog from './add-user-dialog';
import EditUserRoleDialog from './edit-user-role-dialog';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';

const formatDate = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return 'N/A';
    try {
        return format(timestamp.toDate(), "PPpp"); // Example: Sep 24, 2023, 10:30 AM
    } catch (error) {
        return 'Invalid Date';
    }
};

export default function UserTable() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data: users = [], isLoading, error, refetch } = useQuery<User[], Error>({
    queryKey: ['allUsers'],
    queryFn: getAllUsers,
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (uid: string) => {
      // Step 1: Attempt to delete Firebase Auth user (placeholder for backend call)
      try {
        await adminDeleteAuthUser(uid);
        toast({ title: "Auth User Deletion (Placeholder)", description: "Placeholder for Auth user deletion succeeded. Implement backend function." });
      } catch (authError: any) {
        // Even if Auth deletion fails (or is just a placeholder), proceed to delete Firestore doc
        // Log the error, but don't necessarily stop the Firestore doc deletion
        console.warn(`Placeholder Auth deletion for UID ${uid} 'failed' (this is expected for placeholder): ${authError.message}`);
        // toast({ variant: "default", title: "Auth Deletion Skipped (Placeholder)", description: `Auth user ${uid} not deleted (placeholder function).` });
      }
      // Step 2: Delete Firestore user document
      await deleteUserDocument(uid);
    },
    onSuccess: (_, uid) => {
      toast({ title: "User Document Deleted", description: `User document for ${uid} removed from Firestore.` });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    },
    onError: (error: Error, uid) => {
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: `Could not delete user document for ${uid} from Firestore: ${error.message}`,
      });
    },
  });

  const handleAddUser = () => {
    setIsAddUserOpen(true);
  };

  const handleEditUserRole = (user: User) => {
    setEditingUser(user);
    setIsEditRoleOpen(true);
  };

  const handleDeleteUser = (uid: string) => {
    if (!uid) return;
    // Ideally, check if this user is the only admin, etc. before allowing deletion.
    // For now, direct deletion.
    deleteUserMutation.mutate(uid);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-32 self-end" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Users</AlertTitle>
        <AlertDescription>
          {error.message || "Could not load user data."}
          <Button variant="secondary" size="sm" onClick={() => refetch()} className="ml-4 mt-2 sm:mt-0 sm:ml-2">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAddUser}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New User
        </Button>
      </div>

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>UID</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell className="font-medium">{user.email || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}
                           className={user.role === 'admin' ? 'bg-primary/80 hover:bg-primary text-primary-foreground' : ''}
                    >
                      {user.role === 'admin' ? <ShieldCheck className="mr-1 h-3.5 w-3.5" /> : <Shield className="mr-1 h-3.5 w-3.5" />}
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{user.uid}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(user.lastLogin)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button variant="ghost" size="icon" title="Edit Role" onClick={() => handleEditUserRole(user)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit Role</span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete User"
                            disabled={deleteUserMutation.isPending && deleteUserMutation.variables === user.uid}
                          >
                            {(deleteUserMutation.isPending && deleteUserMutation.variables === user.uid) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserX className="h-4 w-4" />
                            )}
                            <span className="sr-only">Delete User</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User: {user.email}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will remove the user's document from Firestore.
                              <br />
                              <strong className="text-destructive">Deleting the Firebase Authentication user requires backend implementation (Admin SDK / Cloud Function) and is currently a placeholder.</strong>
                              <br />
                              Are you sure you want to proceed with deleting the Firestore document? This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteUser(user.uid)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete User Document
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

      <AddUserDialog
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        onUserAdded={() => queryClient.invalidateQueries({ queryKey: ['allUsers'] })}
      />

      {editingUser && (
        <EditUserRoleDialog
          isOpen={isEditRoleOpen}
          onClose={() => { setIsEditRoleOpen(false); setEditingUser(null); }}
          user={editingUser}
          onRoleUpdated={() => queryClient.invalidateQueries({ queryKey: ['allUsers'] })}
        />
      )}
    </div>
  );
}

