
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormField, FormItem, FormMessage, FormControl } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { ShipmentDetail, SelectOption } from '@/lib/types';
import { TARE_WEIGHT_DEFAULT, BAG_WEIGHT_MULTIPLIER, SERVICES_OPTIONS, SERVICE_FORMAT_MAPPING } from '@/lib/constants';
import { getDropdownOptions } from '@/lib/firebase/dropdowns';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

const shipmentDetailFormSchema = z.object({
  numberOfPallets: z.number().min(0, "Must be non-negative").default(1),
  numberOfBags: z.number().min(0, "Must be non-negative").optional(),
  customer: z.string().min(1, "Customer is required"),
  service: z.string().min(1, "Service is required"),
  format: z.string().optional(),
  tareWeight: z.number().min(0, "Must be non-negative"),
  grossWeight: z.number().min(0, "Gross weight must be non-negative"),
  dispatchNumber: z.string().optional(),
  doe: z.string().optional(),
});

export type ShipmentDetailFormData = z.infer<typeof shipmentDetailFormSchema>;

interface ShipmentDetailFormProps {
  shipmentId: string;
  initialData?: ShipmentDetail;
  onSubmitSuccess: (detail: ShipmentDetail) => void; // Callback after successful submission
  onCancel: () => void;
}

export default function ShipmentDetailForm({ shipmentId, initialData, onSubmitSuccess, onCancel }: ShipmentDetailFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ShipmentDetailFormData>({
    resolver: zodResolver(shipmentDetailFormSchema),
    defaultValues: {
      numberOfPallets: initialData?.numberOfPallets ?? 1,
      numberOfBags: initialData?.numberOfBags ?? 0,
      customer: initialData?.customer ?? '',
      service: initialData?.service ?? '',
      format: initialData?.format ?? '',
      tareWeight: initialData?.tareWeight ?? TARE_WEIGHT_DEFAULT,
      grossWeight: initialData?.grossWeight ?? 0,
      dispatchNumber: initialData?.dispatchNumber ?? '',
      doe: initialData?.doe ?? '',
    },
  });

  const { data: customers, isLoading: isLoadingCustomers } = useQuery<SelectOption[]>({
    queryKey: ['customersDropdown'],
    queryFn: () => getDropdownOptions('customers'),
  });

  const { data: does, isLoading: isLoadingDoes } = useQuery<SelectOption[]>({ // DOE = Date of Entry or similar, assumed from context
    queryKey: ['doeDropdown'],
    queryFn: () => getDropdownOptions('doe'),
  });
  
  const services = SERVICES_OPTIONS; // Using static for now, can be fetched if dynamic

  const watchedService = form.watch('service');
  const watchedNumberOfPallets = form.watch('numberOfPallets');
  const watchedNumberOfBags = form.watch('numberOfBags');

  const formatCollectionName = useMemo(() => {
    return SERVICE_FORMAT_MAPPING[watchedService] || null;
  }, [watchedService]);

  const { data: formats, isLoading: isLoadingFormats } = useQuery<SelectOption[]>({
    queryKey: ['formatsDropdown', formatCollectionName],
    queryFn: () => formatCollectionName ? getDropdownOptions(formatCollectionName) : Promise.resolve([]),
    enabled: !!formatCollectionName, // Only fetch if a format collection is identified
  });
  
  // Auto-calculate Tare Weight
  useEffect(() => {
    if (watchedNumberOfBags !== undefined && watchedNumberOfBags > 0) {
      const calculatedTare = parseFloat((watchedNumberOfBags * BAG_WEIGHT_MULTIPLIER).toFixed(3));
      form.setValue('tareWeight', calculatedTare, { shouldValidate: true });
    } else if (watchedNumberOfBags === 0 || watchedNumberOfBags === undefined) {
       // If bags are 0 or undefined, but pallets might imply a default tare
      if (initialData?.tareWeight === undefined) { // only set default if not editing existing
          form.setValue('tareWeight', TARE_WEIGHT_DEFAULT, { shouldValidate: true });
      }
    }
  }, [watchedNumberOfBags, form, initialData?.tareWeight]);

  // Reset format if service changes and selected format is no longer valid
  useEffect(() => {
    if (watchedService && formats) {
        const currentFormatValue = form.getValues('format');
        if (currentFormatValue && !formats.find(f => f.value === currentFormatValue)) {
            form.setValue('format', '', {shouldValidate: true});
        }
    }
  }, [watchedService, formats, form]);


  const handleSubmit = async (data: ShipmentDetailFormData) => {
    setIsSubmitting(true);
    try {
      // The actual add/update logic will be in the parent component (ShipmentDetailDialog or ShipmentDetailPage)
      // This form just prepares data and calls onSubmitSuccess
      const submittedDetail: ShipmentDetail = {
        id: initialData?.id || '', // ID will be set by Firestore for new, or use existing for update
        shipmentId,
        ...data,
        numberOfBags: data.numberOfPallets > 0 ? (data.numberOfBags ?? 0) : undefined, // Only include bags if pallets > 0
      };
      onSubmitSuccess(submittedDetail); // Pass the fully formed detail data (including ID if editing)
      
      toast({
        title: initialData ? "Detail Updated" : "Detail Added",
        description: `Shipment detail has been successfully ${initialData ? 'updated' : 'added'}.`,
      });
    } catch (error) {
      console.error("Error submitting shipment detail:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save shipment detail.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="numberOfPallets"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="numberOfPallets">Number of Pallets</Label>
                <FormControl>
                  <Input id="numberOfPallets" type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} className="mt-1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {watchedNumberOfPallets > 0 && (
            <FormField
              control={form.control}
              name="numberOfBags"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="numberOfBags">Number of Bags</Label>
                  <FormControl>
                    <Input id="numberOfBags" type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} className="mt-1" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <FormField
          control={form.control}
          name="customer"
          render={({ field }) => (
            <FormItem>
              <Label htmlFor="customer">Customer</Label>
              {isLoadingCustomers ? <Skeleton className="h-10 w-full mt-1" /> : (
                <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingCustomers}>
                  <FormControl>
                    <SelectTrigger id="customer" className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {customers?.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <FormField
            control={form.control}
            name="service"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="service">Service</Label>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger id="service" className="mt-1"><SelectValue placeholder="Select service" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {services.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {formatCollectionName && ( // Only show Format if a service is selected that has formats
            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="format">Format</Label>
                  {isLoadingFormats ? <Skeleton className="h-10 w-full mt-1" /> : (
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingFormats || !formats || formats.length === 0}>
                      <FormControl>
                        <SelectTrigger id="format" className="mt-1">
                          <SelectValue placeholder={formats && formats.length > 0 ? "Select format" : "No formats for service"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {formats?.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="tareWeight"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="tareWeight">Tare Weight (kg)</Label>
                <FormControl>
                  <Input id="tareWeight" type="number" step="0.001" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="mt-1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="grossWeight"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="grossWeight">Gross Weight (kg)</Label>
                <FormControl>
                  <Input id="grossWeight" type="number" step="0.001" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="mt-1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dispatchNumber"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="dispatchNumber">Dispatch Number</Label>
                <FormControl><Input id="dispatchNumber" {...field} className="mt-1" placeholder="Optional" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="doe"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="doe">DOE</Label>
                 {isLoadingDoes ? <Skeleton className="h-10 w-full mt-1" /> : (
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingDoes}>
                    <FormControl>
                        <SelectTrigger id="doe" className="mt-1"><SelectValue placeholder="Select DOE" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {does?.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                    </Select>
                 )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (initialData ? "Saving..." : "Adding...") : (initialData ? "Save Changes" : "Add Detail")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
