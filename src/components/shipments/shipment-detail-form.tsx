
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { ShipmentDetail, DropdownItem } from '@/lib/types';
import { getDropdownOptions } from '@/lib/firebase/dropdownService';
import { TARE_WEIGHT_DEFAULT, BAG_WEIGHT_MULTIPLIER, SERVICE_FORMAT_MAPPING } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const detailFormSchema = z.object({
  numPallets: z.coerce.number().min(0, "Pallets cannot be negative").default(1),
  numBags: z.coerce.number().min(0, "Bags cannot be negative").default(0),
  customerId: z.string().min(1, "Customer is required"),
  serviceId: z.string().min(1, "Service is required"),
  formatId: z.string().optional(),
  tareWeight: z.coerce.number().min(0, "Tare weight cannot be negative"),
  grossWeight: z.coerce.number().min(0, "Gross weight cannot be negative"),
  dispatchNumber: z.string().optional(),
  doeId: z.string().optional().default(''),
}).refine(data => {
    const serviceKey = data.serviceId ? data.serviceId.toLowerCase() : '';
    const serviceRequiresFormat = SERVICE_FORMAT_MAPPING[serviceKey]; // This will be a string (collectionId) or null/undefined

    if (serviceRequiresFormat) { // If mapping exists and is not null/empty, format is required
        return data.formatId !== undefined && data.formatId !== null && data.formatId.trim() !== '';
    }
    return true; // If no mapping or mapping is null/empty, format is not required
}, {
    message: "Format is required for the selected service.",
    path: ["formatId"],
}).refine(data => data.grossWeight >= data.tareWeight, {
    message: "Gross weight cannot be less than tare weight.",
    path: ["grossWeight"],
});

type DetailFormValues = z.infer<typeof detailFormSchema>;

interface ShipmentDetailFormProps {
  shipmentId: string;
  detail?: ShipmentDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated'>) => Promise<void>;
}

const fetchCustomers = () => getDropdownOptions('customers');
const fetchServices = () => getDropdownOptions('services');
const fetchDoes = () => getDropdownOptions('doe');
const fetchFormats = (formatCollectionId: string | null) => {
    if (!formatCollectionId) return Promise.resolve([]);
    return getDropdownOptions(formatCollectionId);
};

export default function ShipmentDetailForm({
  shipmentId,
  detail,
  isOpen,
  onClose,
  onSave,
}: ShipmentDetailFormProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [currentServiceId, setCurrentServiceId] = useState<string>(detail?.serviceId ?? '');

  const formatCollectionId = useMemo(() => {
    const serviceKey = currentServiceId ? currentServiceId.toLowerCase() : '';
    return serviceKey ? SERVICE_FORMAT_MAPPING[serviceKey] || null : null;
  }, [currentServiceId]);

  const showFormatDropdown = !!formatCollectionId;

  const { data: customerOptions = [], isLoading: isLoadingCustomers } = useQuery<DropdownItem[]>({
      queryKey: ['customers'], queryFn: fetchCustomers, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });
  const { data: serviceOptions = [], isLoading: isLoadingServices } = useQuery<DropdownItem[]>({
      queryKey: ['services'], queryFn: fetchServices, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });
  const { data: doeOptions = [], isLoading: isLoadingDoes } = useQuery<DropdownItem[]>({
      queryKey: ['doe'], queryFn: fetchDoes, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });

  const { data: formatOptions = [], isLoading: isLoadingFormats } = useQuery<DropdownItem[]>({
      queryKey: ['formats', formatCollectionId],
      queryFn: () => fetchFormats(formatCollectionId),
      enabled: !!formatCollectionId && isOpen,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
  });

  const validFormatOptions = useMemo(() => {
    return formatOptions.filter(option => option.value && option.value.trim() !== '');
  }, [formatOptions]);

  const dropdownsLoading = isLoadingCustomers || isLoadingServices || isLoadingDoes || (showFormatDropdown && isLoadingFormats);

  const formHook = useForm<DetailFormValues>({
    resolver: zodResolver(detailFormSchema),
    defaultValues: {
        numPallets: 1,
        numBags: 0,
        customerId: '',
        serviceId: '',
        formatId: '',
        tareWeight: TARE_WEIGHT_DEFAULT,
        grossWeight: 0,
        dispatchNumber: '',
        doeId: '',
    },
  });
  const { watch, setValue, reset, getValues, trigger, control } = formHook;

  const numPallets = watch('numPallets');
  const numBags = watch('numBags');
  const watchedServiceId = watch('serviceId');

  useEffect(() => {
    if (isOpen) {
      const initialValues = {
        numPallets: detail?.numPallets ?? 1,
        numBags: detail?.numBags ?? 0,
        customerId: detail?.customerId ?? '',
        serviceId: detail?.serviceId ?? '',
        formatId: detail?.formatId ?? '',
        tareWeight: detail?.tareWeight ?? TARE_WEIGHT_DEFAULT,
        grossWeight: detail?.grossWeight ?? 0,
        dispatchNumber: detail?.dispatchNumber ?? '',
        doeId: detail?.doeId ?? '',
      };
      reset(initialValues);
      setCurrentServiceId(initialValues.serviceId);
      if (initialValues.numPallets === 0) {
        setValue('numBags', 0, { shouldValidate: true });
      }
    }
  }, [isOpen, detail, reset, setValue]);

  useEffect(() => {
    if (watchedServiceId !== currentServiceId) {
        setCurrentServiceId(watchedServiceId);
        setValue('formatId', '', { shouldValidate: true });
    }
  }, [watchedServiceId, currentServiceId, setValue]);

  useEffect(() => {
    let newTareWeight;
    if (numPallets === 0) {
        newTareWeight = 0;
        if (getValues('numBags') !== 0) {
            setValue('numBags', 0, { shouldValidate: true });
        }
    } else if (numBags > 0) {
        newTareWeight = parseFloat((numBags * BAG_WEIGHT_MULTIPLIER).toFixed(3));
    } else {
        newTareWeight = TARE_WEIGHT_DEFAULT;
    }

    if (newTareWeight !== getValues('tareWeight')) {
        setValue('tareWeight', newTareWeight, { shouldValidate: true });
        trigger("grossWeight");
    }
  }, [numPallets, numBags, setValue, getValues, trigger]);

  const onSubmit = async (data: DetailFormValues) => {
    setIsSaving(true);
    try {
       const finalNumBags = data.numPallets === 0 ? 0 : data.numBags;
       const serviceKeyForSubmit = data.serviceId ? data.serviceId.toLowerCase() : '';
       const finalFormatId = SERVICE_FORMAT_MAPPING[serviceKeyForSubmit] ? (data.formatId || '') : '';

       const saveData: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'> = {
         numPallets: data.numPallets,
         numBags: finalNumBags,
         customerId: data.customerId,
         serviceId: data.serviceId,
         formatId: finalFormatId,
         tareWeight: data.tareWeight,
         grossWeight: data.grossWeight,
         dispatchNumber: data.dispatchNumber || undefined,
         doeId: data.doeId || undefined,
       };
      await onSave(saveData);
      onClose();
    } catch (error) {
      console.error("Error saving shipment detail:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save item.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
     <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>{detail ? 'Edit Shipment Item' : 'Add Shipment Item'}</DialogTitle>
          <DialogDescription>
            Fill in the details for this item. Required fields are marked with an asterisk (*).
          </DialogDescription>
        </DialogHeader>
         {dropdownsLoading && isOpen ? (
             <div className="space-y-4 p-6">
                 {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
             </div>
         ) : (
             <Form {...formHook}>
                 <form onSubmit={formHook.handleSubmit(onSubmit)} className="overflow-y-auto max-h-[calc(90vh-180px)]">
                    <div className="space-y-6 p-6">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                        <FormField
                           control={control}
                           name="numPallets"
                           render={({ field }) => (
                           <FormItem>
                              <FormLabel>Number of Pallets *</FormLabel>
                              <FormControl>
                                 <Input type="number" min="0" {...field} disabled={isSaving}
                                 onChange={e => {
                                    const pallets = parseInt(e.target.value, 10);
                                    field.onChange(isNaN(pallets) ? 0 : pallets);
                                    if (pallets === 0) {
                                        setValue('numBags', 0, { shouldValidate: true });
                                    }
                                 }}
                                 />
                              </FormControl>
                              <FormMessage />
                           </FormItem>
                           )}
                        />
                         {numPallets > 0 && (
                           <FormField
                              control={control}
                              name="numBags"
                              render={({ field }) => (
                                 <FormItem>
                                    <FormLabel>Number of Bags *</FormLabel>
                                    <FormControl>
                                       <Input type="number" min="0" {...field}
                                        onChange={e => {
                                            const bags = parseInt(e.target.value, 10);
                                            field.onChange(isNaN(bags) ? 0 : bags);
                                        }}
                                       disabled={isSaving} />
                                    </FormControl>
                                    <FormMessage />
                                 </FormItem>
                              )}
                           />
                         )}
                         <FormField
                            control={control}
                            name="customerId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Customer *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={isSaving || isLoadingCustomers}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a customer" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {customerOptions.filter(opt => opt.value && opt.value.trim() !== '').map((option) => (
                                        <SelectItem key={option.id} value={option.value}>
                                        {option.label}
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                         />
                         <FormField
                            control={control}
                            name="serviceId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Service *</FormLabel>
                                <Select
                                    onValueChange={(value) => {
                                        field.onChange(value);
                                    }}
                                    value={field.value}
                                    disabled={isSaving || isLoadingServices}
                                 >
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a service" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {serviceOptions.filter(opt => opt.value && opt.value.trim() !== '').map((option) => (
                                        <SelectItem key={option.id} value={option.value}>
                                        {option.label}
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                         />
                         {showFormatDropdown && (
                            <FormField
                                control={control}
                                name="formatId"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Format *</FormLabel>
                                    <Select
                                        key={formatCollectionId || 'no-format-collection'} // Add key here
                                        onValueChange={field.onChange}
                                        value={field.value || ""}
                                        disabled={isSaving || isLoadingFormats}
                                    >
                                    <FormControl>
                                        <SelectTrigger>
                                        <SelectValue placeholder="Select a format" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {isLoadingFormats && <SelectItem value="___loading_formats_placeholder___" disabled>Loading formats...</SelectItem>}
                                        {!isLoadingFormats && validFormatOptions.length === 0 && <SelectItem value="___no_formats_placeholder___" disabled>No formats for this service</SelectItem>}
                                        {validFormatOptions.map((option) => (
                                        <SelectItem key={option.id} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                        ))}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                          )}

                        <FormField
                           control={control}
                           name="tareWeight"
                           render={({ field }) => (
                              <FormItem>
                                 <FormLabel>Tare Weight (kg) *</FormLabel>
                                 <FormControl>
                                    <Input type="number" step="0.001" min="0" {...field}
                                           onChange={e => {
                                            const weight = parseFloat(e.target.value);
                                            field.onChange(isNaN(weight) ? 0 : weight);
                                           }}
                                           disabled={isSaving || (numPallets > 0 && numBags > 0)}
                                           title={(numPallets > 0 && numBags > 0) ? "Auto-calculated based on number of bags" : "Enter tare weight"}
                                    />
                                 </FormControl>
                                 {(numPallets > 0 && numBags > 0) && <p className="text-xs text-muted-foreground pt-1">Auto-calculated ({numBags} bags × {BAG_WEIGHT_MULTIPLIER} kg/bag)</p>}
                                 {(numPallets > 0 && numBags === 0) && <p className="text-xs text-muted-foreground pt-1">Default tare for pallets without bags.</p>}
                                 {(numPallets === 0) && <p className="text-xs text-muted-foreground pt-1">Tare weight is 0 if no pallets.</p>}
                                 <FormMessage />
                              </FormItem>
                           )}
                        />

                        <FormField
                           control={control}
                           name="grossWeight"
                           render={({ field }) => (
                           <FormItem>
                              <FormLabel>Gross Weight (kg) *</FormLabel>
                              <FormControl>
                                 <Input type="number" step="0.001" min="0" {...field}
                                    onChange={e => {
                                        const weight = parseFloat(e.target.value);
                                        field.onChange(isNaN(weight) ? 0 : weight);
                                    }}
                                 disabled={isSaving} />
                              </FormControl>
                              <FormMessage />
                           </FormItem>
                           )}
                        />
                         <FormField
                           control={control}
                           name="dispatchNumber"
                           render={({ field }) => (
                           <FormItem>
                              <FormLabel>Dispatch Number</FormLabel>
                              <FormControl>
                                 <Input type="text" {...field} value={field.value || ''} disabled={isSaving} placeholder="Optional"/>
                              </FormControl>
                              <FormMessage />
                           </FormItem>
                           )}
                        />
                         <FormField
                           control={control}
                           name="doeId"
                           render={({ field }) => (
                              <FormItem>
                                 <FormLabel>DOE</FormLabel>
                                 <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSaving || isLoadingDoes}>
                                    <FormControl>
                                       <SelectTrigger>
                                          <SelectValue placeholder="Select DOE (optional)" />
                                       </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                       {doeOptions.filter(opt => opt.value && opt.value.trim() !== '').map((option) => (
                                          <SelectItem key={option.id} value={option.value}>
                                             {option.label}
                                          </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                                 <FormMessage />
                              </FormItem>
                           )}
                         />
                     </div>
                    </div>
                      <DialogFooter className="p-6 border-t mt-0 sticky bottom-0 bg-background">
                         <DialogClose asChild>
                            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
                         </DialogClose>
                         <Button type="submit" disabled={isSaving || dropdownsLoading}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                </>
                               ) : (detail ? 'Update Item' : 'Add Item')
                            }
                         </Button>
                     </DialogFooter>
                 </form>
             </Form>
          )}
      </DialogContent>
    </Dialog>
  );
}

