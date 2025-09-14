"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UserCog, Save, Loader2, AlertTriangle, Clock, Mail, Trash2 } from "lucide-react";
import { getAppSettings, updateAppSettings, getRecipients, updateRecipients } from '@/lib/firebase/settingsService';
import type { AppSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_SENDER_ADDRESS, DEFAULT_CONSIGNEE_ADDRESS } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const settingsFormSchema = z.object({
  defaultSenderAddress: z.string().min(10, "Sender address must be at least 10 characters."),
  defaultConsigneeAddress: z.string().min(10, "Consignee address must be at least 10 characters."),
  logoutAfterMinutes: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .min(0, "Logout duration must be 0 or greater (0 to disable).")
    .optional()
    .default(0), // Default to 0 (disabled) if not provided
  emailSubjectTemplate: z.string().optional(),
  emailBodyTemplate: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState("");
  const [isRecipientsLoading, setIsRecipientsLoading] = useState(true);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      defaultSenderAddress: '',
      defaultConsigneeAddress: '',
      logoutAfterMinutes: 0, // Initialize with 0
      emailSubjectTemplate: '',
      emailBodyTemplate: '',
    },
  });

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const settings = await getAppSettings();
        if (isMounted) {
          form.reset({
            defaultSenderAddress: settings?.defaultSenderAddress || DEFAULT_SENDER_ADDRESS,
            defaultConsigneeAddress: settings?.defaultConsigneeAddress || DEFAULT_CONSIGNEE_ADDRESS,
            logoutAfterMinutes: settings?.logoutAfterMinutes ?? 0, // Use ?? 0 to ensure a number
            emailSubjectTemplate: settings?.emailSubjectTemplate || '',
            emailBodyTemplate: settings?.emailBodyTemplate || '',
          });
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load settings.");
          form.reset({ // Fallback to constants and 0 for logout on error
            defaultSenderAddress: DEFAULT_SENDER_ADDRESS,
            defaultConsigneeAddress: DEFAULT_CONSIGNEE_ADDRESS,
            logoutAfterMinutes: 0,
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    fetchSettings();
    return () => { isMounted = false; };
  }, [form]);

  useEffect(() => {
    const fetchRecipients = async () => {
      setIsRecipientsLoading(true);
      const fetchedRecipients = await getRecipients();
      setRecipients(fetchedRecipients);
      setIsRecipientsLoading(false);
    };
    fetchRecipients();
  }, []);

  const handleAddRecipient = () => {
    if (newRecipient && !recipients.includes(newRecipient)) {
      const updatedRecipients = [...recipients, newRecipient];
      setRecipients(updatedRecipients);
      updateRecipients(updatedRecipients);
      setNewRecipient("");
    }
  };

  const handleRemoveRecipient = (recipientToRemove: string) => {
    const updatedRecipients = recipients.filter(
      (recipient) => recipient !== recipientToRemove
    );
    setRecipients(updatedRecipients);
    updateRecipients(updatedRecipients);
  };

  const onSubmit = async (data: SettingsFormValues) => {
    setIsSaving(true);
    setError(null);
    try {
      // Ensure logoutAfterMinutes is treated as a number, even if form sends it as string after coerce
      const dataToSave: Partial<AppSettings> = {
        ...data,
        logoutAfterMinutes: Number(data.logoutAfterMinutes),
      };
      await updateAppSettings(dataToSave);
      toast({
        title: "Settings Updated",
        description: "Application settings saved successfully.",
      });
    } catch (err) {
      console.error("Error saving settings:", err);
      const errorMessage = err instanceof Error ? err.message : "Could not save settings.";
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: errorMessage,
      });
      setError(errorMessage);
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
          <CardDescription>Manage global application settings like default addresses and session timeout.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-24 mt-4" />
            </div>
          ) : error && !isSaving ? (
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
                <FormField
                  control={form.control}
                  name="logoutAfterMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Auto-logout After (minutes)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="e.g., 30"
                          {...field}
                          value={field.value ?? 0} // Ensure value is not undefined for input
                          onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormDescription>
                        User will be logged out after this many minutes of inactivity. Set to 0 to disable auto-logout.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emailSubjectTemplate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Subject Template</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Dispatch Pre-Alert – Truck {seal}"
                          {...field}
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormDescription>
                        Supported placeholders: `consignee`, `date`, `seal`
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emailBodyTemplate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Body Template</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. Please find attached the Pre-Alert and CMR for this dispatch."
                          {...field}
                          rows={5}
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormDescription>
                        Supported placeholders: `consignee`, `date`, `seal`
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSaving || isLoading || !form.formState.isDirty}>
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
                {error && isSaving && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Save Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </form>
            </Form>
          )}

          {/* Email Recipients Section */}
<div className="space-y-4 pt-6">
  <h3 className="text-lg font-medium">Email Recipients for Completed Shipments</h3>
  <div className="flex w-full max-w-sm items-center space-x-2">
    <Input
      type="email"
      placeholder="Enter recipient's email"
      value={newRecipient}
      onChange={(e) => setNewRecipient(e.target.value)}
    />
    <Button type="button" onClick={handleAddRecipient}>Add Recipient</Button>
  </div>
  <div className="space-y-2">
    {isRecipientsLoading ? (
      <p>Loading recipients...</p>
    ) : (
      recipients.map((recipient) => (
        <div key={recipient} className="flex items-center justify-between p-2 border rounded-md">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{recipient}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleRemoveRecipient(recipient)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))
    )}
  </div>
</div>
        </CardContent>
      </Card>
    </div>
  );
}