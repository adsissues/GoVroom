
"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UserCog, Save, Loader2, AlertTriangle } from "lucide-react";
import { getAppSettings, updateAppSettings } from '@/lib/firebase/settingsService';
import type { AppSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_SENDER_ADDRESS, DEFAULT_CONSIGNEE_ADDRESS } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const settingsFormSchema = z.object({
  defaultSenderAddress: z.string().min(10, "Sender address must be at least 10 characters."),
  defaultConsigneeAddress: z.string().min(10, "Consignee address must be at least 10 characters."),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      defaultSenderAddress: '', // Will be populated from Firestore or constants
      defaultConsigneeAddress: '',
    },
  });

  // Fetch current settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const settings = await getAppSettings();
        form.reset({
          defaultSenderAddress: settings?.defaultSenderAddress || DEFAULT_SENDER_ADDRESS,
          defaultConsigneeAddress: settings?.defaultConsigneeAddress || DEFAULT_CONSIGNEE_ADDRESS,
        });
      } catch (err) {
        console.error("Error fetching settings:", err);
        setError(err instanceof Error ? err.message : "Failed to load settings.");
        // Fallback to constants if fetch fails
        form.reset({
          defaultSenderAddress: DEFAULT_SENDER_ADDRESS,
          defaultConsigneeAddress: DEFAULT_CONSIGNEE_ADDRESS,
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [form.reset]); // form.reset is stable, so this runs once

  const onSubmit = async (data: SettingsFormValues) => {
    setIsSaving(true);
    setError(null);
    try {
      await updateAppSettings(data);
      toast({
        title: "Settings Updated",
        description: "Default addresses saved successfully.",
      });
    } catch (err) {
      console.error("Error saving settings:", err);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: err instanceof Error ? err.message : "Could not save settings.",
      });
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg rounded-xl border">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <UserCog className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Application Settings</CardTitle>
          </div>
          <CardDescription>Manage global application settings like default addresses.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-24 mt-4" />
            </div>
          ) : error && !isSaving ? ( // Only show main error if not in saving process error
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Loading Settings</AlertTitle>
              <AlertDescription>
                {error} Please try refreshing the page. Using hardcoded defaults for now.
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="defaultSenderAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Sender Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the default sender address"
                          {...field}
                          rows={3}
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultConsigneeAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Consignee Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the default consignee address"
                          {...field}
                          rows={3}
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSaving || isLoading}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" /> Save Settings
                      </>
                    )}
                  </Button>
                </div>
                 {error && isSaving && ( // Show error specific to saving process
                     <Alert variant="destructive" className="mt-4">
                         <AlertTriangle className="h-4 w-4" />
                         <AlertTitle>Save Error</AlertTitle>
                         <AlertDescription>{error}</AlertDescription>
                     </Alert>
                 )}
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
