
"use client";

import type { DropdownOptionWithId } from "@/lib/firebase/dropdowns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit3, Trash2 } from "lucide-react";
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

interface DropdownItemsTableProps {
  items: DropdownOptionWithId[];
  onEdit: (item: DropdownOptionWithId) => void;
  onDelete: (itemId: string) => void;
  isLoadingDelete: boolean;
}

export default function DropdownItemsTable({ items, onEdit, onDelete, isLoadingDelete }: DropdownItemsTableProps) {
  if (!items || items.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No items in this dropdown yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="text-right w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">{item.label}</TableCell>
              <TableCell>{item.value}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(item)} title="Edit Item">
                  <Edit3 className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete Item" disabled={isLoadingDelete}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the option &quot;{item.label}&quot;.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isLoadingDelete}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(item.id)} disabled={isLoadingDelete}>
                        {isLoadingDelete ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
