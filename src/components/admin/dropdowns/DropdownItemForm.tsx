
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import type { DropdownOptionWithId } from "@/lib/firebase/dropdowns";

const dropdownItemSchema = z.object({
  label: z.string().min(1, "Label is required"),
  value: z.string().min(1, "Value is required"),
});

export type DropdownItemFormData = z.infer<typeof dropdownItemSchema>;

interface DropdownItemFormProps {
  initialData?: DropdownOptionWithId;
  onSubmit: (data: DropdownItemFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function DropdownItemForm({ initialData, onSubmit, onCancel, isSubmitting }: DropdownItemFormProps) {
  const form = useForm<DropdownItemFormData>({
    resolver: zodResolver(dropdownItemSchema),
    defaultValues: initialData ? { label: initialData.label, value: initialData.value } : { label: "", value: "" },
  });

  const handleSubmit = async (data: DropdownItemFormData) => {
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <Label htmlFor="label">Label</Label>
              <FormControl>
                <Input id="label" placeholder="Enter display label" {...field} />
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
              <Label htmlFor="value">Value</Label>
              <FormControl>
                <Input id="value" placeholder="Enter stored value" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (initialData ? "Saving..." : "Adding...") : (initialData ? "Save Changes" : "Add Option")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
