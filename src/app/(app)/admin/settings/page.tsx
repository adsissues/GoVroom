
"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_SENDER_ADDRESS, DEFAULT_CONSIGNEE_ADDRESS } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { getAppSettingsFromFirestore, updateAppSettingsInFirestore, type AppSettings } from '@/lib/firebase/settings';
import { AlertTriangle, Save } from 'lucide-react';


const settingsFormSchema = z.object({
  defaultSenderAddress: z.string().min(1, "Sender address is required."),
  defaultConsigneeAddress: z.string().min(1, "Consignee address is required."),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      defaultSenderAddress: '',
      defaultConsigneeAddress: '',
    },
  });

  useEffect(() => {
    async function fetchSettings() {
      setIsLoading(true);
      try {
        const settings = await getAppSettingsFromFirestore();
        if (settings) {
          form.reset(settings);
        } else {
          // Fallback to constants if no settings found in Firestore
          form.reset({
            defaultSenderAddress: DEFAULT_SENDER_ADDRESS,
            defaultConsigneeAddress: DEFAULT_CONSIGNEE_ADDRESS,
          });
        }
      } catch (error) {
        console.error("Error fetching app settings:", error);
        toast({
          title: 'Error Loading Settings',
          description: error instanceof Error ? error.message : 'Could not load app settings. Using default values.',
          variant: 'destructive',
        });
        form.reset({ // Fallback to constants on error
            defaultSenderAddress: DEFAULT_SENDER_ADDRESS,
            defaultConsigneeAddress: DEFAULT_CONSIGNEE_ADDRESS,
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, [form, toast]);

  const onSubmit = async (data: SettingsFormData) => {
    setIsSubmitting(true);
    try {
      await updateAppSettingsInFirestore(data);
      toast({
        title: 'Settings Updated',
        description: 'Application settings have been successfully saved.',
      });
    } catch (error) {
      console.error("Error updating app settings:", error);
      toast({
        title: 'Error Saving Settings',
        description: error instanceof Error ? error.message : 'Could not save app settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-4 w-3/4 mt-1" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-24 self-end" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl rounded-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Application Settings</CardTitle>
        <CardDescription>Manage default values and other application-wide settings.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="defaultSenderAddress"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="defaultSenderAddress">Default Sender Address</Label>
                  <FormControl>
                    <Textarea
                      id="defaultSenderAddress"
                      placeholder="Enter the default sender address"
                      className="min-h-[100px]"
                      {...field}
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
                  <Label htmlFor="defaultConsigneeAddress">Default Consignee Address</Label>
                  <FormControl>
                    <Textarea
                      id="defaultConsigneeAddress"
                      placeholder="Enter the default consignee address"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
