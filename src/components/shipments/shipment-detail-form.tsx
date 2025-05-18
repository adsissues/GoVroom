
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
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const detailFormSchema = z.object({
  numPallets: z.coerce.number().min(0, "Pallets cannot be negative").default(1),
  numBags: z.coerce.number().min(0, "Bags cannot be negative").default(0),
  customerId: z.string().min(1, "Customer is required"),
  serviceId: z.string().min(1, "Service is required"),
  formatId: z.string().optional().default(''),
  tareWeight: z.coerce.number().min(0, "Tare weight cannot be negative"),
  grossWeight: z.coerce.number().min(0, "Gross weight cannot be negative"),
  dispatchNumber: z.string().optional(),
  doeId: z.string().optional().default(''),
}).refine(data => {
    const serviceKey = data.serviceId ? data.serviceId.toLowerCase() : '';
    const serviceRequiresFormat = serviceKey ? !!SERVICE_FORMAT_MAPPING[serviceKey] : false;
    // console.log('[ZOD REFINE] serviceKey:', serviceKey, 'serviceRequiresFormat:', serviceRequiresFormat, 'data.formatId:', data.formatId);
    if (serviceRequiresFormat) {
        const isValid = typeof data.formatId === 'string' && data.formatId.trim() !== '';
        // console.log('[ZOD REFINE] Format ID Valid:', isValid);
        return isValid;
    }
    return true;
}, {
    message: "Format is required for the selected service.",
    path: ["formatId"],
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
    // console.log(`[FETCH FORMATS] Fetching for collection: ${formatCollectionId}`);
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
  const [showPalletInputMode, setShowPalletInputMode] = useState(true); // true for Pallet, false for Bag

  const formHook = useForm<DetailFormValues>({
    resolver: zodResolver(detailFormSchema),
    defaultValues: { // Initial defaults, will be overridden by useEffect
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
  const { watch, setValue, reset, getValues, trigger, control, formState } = formHook;

  const numPalletsWatched = watch('numPallets');
  const numBagsWatched = watch('numBags');
  const watchedServiceId = watch('serviceId');
  const watchedFormatId = watch('formatId');

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

  const { data: rawFormatOptions = [], isLoading: isLoadingFormats } = useQuery<DropdownItem[]>({
      queryKey: ['formats', formatCollectionId],
      queryFn: () => fetchFormats(formatCollectionId),
      enabled: !!formatCollectionId && isOpen,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
  });

  const validCustomerOptions = useMemo(() => customerOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [customerOptions]);
  const validServiceOptions = useMemo(() => serviceOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [serviceOptions]);
  const validDoeOptions = useMemo(() => doeOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [doeOptions]);
  const validFormatOptions = useMemo(() => rawFormatOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [rawFormatOptions]);

  const dropdownsLoading = isLoadingCustomers || isLoadingServices || isLoadingDoes || (showFormatDropdown && isLoadingFormats);

  const syncPalletBagRHFValues = useCallback((isPalletMode: boolean) => {
    // console.log(`[syncPalletBagRHFValues] Called. Mode: ${isPalletMode ? 'Pallet' : 'Bag'}`);
    if (isPalletMode) {
      setValue('numBags', 0, { shouldValidate: false });
      if (getValues('numPallets') === 0) {
        setValue('numPallets', 1, { shouldValidate: false });
      }
    } else {
      setValue('numPallets', 0, { shouldValidate: false });
    }
  }, [setValue, getValues]);


  useEffect(() => {
    // console.log(`[EFFECT isOpen, detail] Fired. isOpen: ${isOpen}`);
    if (isOpen) {
        let initialModeIsPallet = true;
        if (detail) {
            const initialFormValues = {
                numPallets: detail.numPallets ?? 1,
                numBags: detail.numBags ?? 0,
                customerId: detail.customerId ?? '',
                serviceId: detail.serviceId ?? '',
                formatId: detail.formatId ?? '',
                tareWeight: detail.tareWeight ?? TARE_WEIGHT_DEFAULT,
                grossWeight: detail.grossWeight ?? 0,
                dispatchNumber: detail.dispatchNumber ?? '',
                doeId: detail.doeId ?? '',
            };
            reset(initialFormValues);
            initialModeIsPallet = (initialFormValues.numPallets > 0);
            setShowPalletInputMode(initialModeIsPallet);
            setCurrentServiceId(initialFormValues.serviceId);
            // console.log("[EFFECT isOpen, detail] Reset form with detail. Initial mode:", initialModeIsPallet ? "Pallet" : "Bag");
        } else {
            reset({
                numPallets: 1,
                numBags: 0,
                customerId: '',
                serviceId: '',
                formatId: '',
                tareWeight: TARE_WEIGHT_DEFAULT,
                grossWeight: 0,
                dispatchNumber: '',
                doeId: '',
            });
            initialModeIsPallet = true;
            setShowPalletInputMode(true);
            setCurrentServiceId('');
            // console.log("[EFFECT isOpen, !detail] Reset form for new item. Initial mode: Pallet");
        }
        // Defer RHF value sync for pallet/bags to after this render pass
        setTimeout(() => syncPalletBagRHFValues(initialModeIsPallet), 0);
    }
  }, [isOpen, detail, reset, syncPalletBagRHFValues]);


  useEffect(() => {
    let newTareWeight;
    const currentRHFPallets = getValues('numPallets');
    const currentRHFBags = getValues('numBags');

    if (showPalletInputMode) {
        newTareWeight = TARE_WEIGHT_DEFAULT;
    } else {
        if (numBagsWatched > 0) {
            newTareWeight = parseFloat((numBagsWatched * BAG_WEIGHT_MULTIPLIER).toFixed(3));
        } else {
            newTareWeight = 0;
        }
    }

    if (newTareWeight !== getValues('tareWeight')) {
        setValue('tareWeight', newTareWeight, { shouldValidate: true });
        trigger("grossWeight");
    }
  }, [showPalletInputMode, numPalletsWatched, numBagsWatched, setValue, getValues, trigger]);

  useEffect(() => {
    if (watchedServiceId !== currentServiceId) {
      setCurrentServiceId(watchedServiceId);
      setValue('formatId', '', { shouldValidate: false });
      const newFormatCollectionId = watchedServiceId ? SERVICE_FORMAT_MAPPING[watchedServiceId.toLowerCase()] || null : null;
      if (!newFormatCollectionId) {
        formHook.clearErrors('formatId');
      }
    }
  }, [watchedServiceId, currentServiceId, setValue, formHook]);

  useEffect(() => {
    const formatFieldState = formHook.getFieldState('formatId');
    if (showFormatDropdown && (formState.isSubmitted || formatFieldState.isTouched)) {
        trigger('formatId');
    }
  }, [watchedFormatId, formState.isSubmitted, formHook.getFieldState, trigger, showFormatDropdown, formHook]);


  const handleToggleInputMode = () => {
    // console.log('[handleToggleInputMode] Clicked.');
    const newModeIsPallet = !showPalletInputMode;
    setShowPalletInputMode(newModeIsPallet);
    syncPalletBagRHFValues(newModeIsPallet); // Sync RHF values immediately on button click
  };

  const onSubmit = async (data: DetailFormValues) => {
    // console.log('[SUBMIT] Form data at start of onSubmit:', JSON.parse(JSON.stringify(data)));
    setIsSaving(true);
    try {
       let finalData = { ...data };
       // Final RHF value adjustment based on mode before saving
       if (showPalletInputMode) {
           finalData.numBags = 0;
           if (finalData.numPallets <= 0) finalData.numPallets = 1; // Ensure at least 1 pallet if in pallet mode
       } else {
           finalData.numPallets = 0;
           // If in bag mode and bags are 0, it's valid.
       }
      //  console.log('[SUBMIT] Final data before onSave:', JSON.parse(JSON.stringify(finalData)));

       const saveData: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'> = {
         numPallets: finalData.numPallets,
         numBags: finalData.numBags,
         customerId: finalData.customerId,
         serviceId: finalData.serviceId,
         formatId: SERVICE_FORMAT_MAPPING[finalData.serviceId?.toLowerCase() || ''] ? (finalData.formatId || '') : '',
         tareWeight: finalData.tareWeight,
         grossWeight: finalData.grossWeight,
         dispatchNumber: finalData.dispatchNumber || undefined,
         doeId: finalData.doeId || undefined,
       };
      //  console.log('[SUBMIT] Data to be passed to onSave:', JSON.parse(JSON.stringify(saveData)));
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
                     <div className="flex justify-end mb-4">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleToggleInputMode}
                            disabled={isSaving}
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            {showPalletInputMode ? "Enter Bags Instead" : "Enter Pallets Instead"}
                        </Button>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                        {showPalletInputMode && (
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
                                        const newPalletValue = isNaN(pallets) || pallets < 0 ? 0 : pallets;
                                        field.onChange(newPalletValue); // Update RHF state for THIS field
                                        if (newPalletValue === 0) { // Current showPalletInputMode is true here
                                            // console.log("[PALLET INPUT ONCHANGE] Pallets set to 0, switching to Bag mode.");
                                            setShowPalletInputMode(false);
                                            syncPalletBagRHFValues(false); // Sync RHF values for new mode
                                        }
                                     }}
                                     />
                                  </FormControl>
                                  <FormMessage />
                               </FormItem>
                               )}
                            />
                        )}
                        {!showPalletInputMode && (
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
                                            const newBagValue = isNaN(bags) || bags < 0 ? 0 : bags;
                                            field.onChange(newBagValue); // Update RHF state for THIS field
                                            if (newBagValue === 0) { // Current showPalletInputMode is false here
                                                // console.log("[BAG INPUT ONCHANGE] Bags set to 0, switching to Pallet mode.");
                                                setShowPalletInputMode(true);
                                                syncPalletBagRHFValues(true); // Sync RHF values for new mode
                                            }
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
                                <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSaving || isLoadingCustomers}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a customer" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {validCustomerOptions.map((option) => (
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
                                    onValueChange={(value) => field.onChange(value)}
                                    value={field.value || ""}
                                    disabled={isSaving || isLoadingServices}
                                 >
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a service" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {validServiceOptions.map((option) => (
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
                                        key={formatCollectionId || 'no-format-collection'}
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            // console.log('[FORMAT SELECT] Selected value:', value);
                                            // formHook.trigger('formatId'); // Triggering here might be problematic, moved to useEffect
                                        }}
                                        value={field.value || ""}
                                        disabled={isSaving || isLoadingFormats || !showFormatDropdown}
                                    >
                                    <FormControl>
                                        <SelectTrigger>
                                        <SelectValue placeholder="Select a format" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {isLoadingFormats && <SelectItem value="___loading_formats_placeholder___" disabled>Loading formats...</SelectItem>}
                                        {!isLoadingFormats && !showFormatDropdown && <SelectItem value="___no_formats_for_service_placeholder___" disabled>N/A for this service</SelectItem>}
                                        {!isLoadingFormats && showFormatDropdown && validFormatOptions.length === 0 && <SelectItem value="___no_valid_formats_placeholder___" disabled>No formats available</SelectItem>}
                                        {showFormatDropdown && validFormatOptions.map((option) => (
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
                                           disabled={isSaving || showPalletInputMode || (!showPalletInputMode && numBagsWatched > 0) }
                                           title={
                                            showPalletInputMode ? `Default tare for pallets: ${TARE_WEIGHT_DEFAULT} kg` :
                                            (numBagsWatched > 0 ? `Auto-calculated for bags: ${numBagsWatched * BAG_WEIGHT_MULTIPLIER} kg` : "Enter tare weight (usually 0)")
                                           }
                                    />
                                 </FormControl>
                                 {showPalletInputMode && <p className="text-xs text-muted-foreground pt-1">Default for pallets.</p>}
                                 {!showPalletInputMode && numBagsWatched > 0 && <p className="text-xs text-muted-foreground pt-1">Auto-calculated ({numBagsWatched} bags × {BAG_WEIGHT_MULTIPLIER} kg/bag)</p>}
                                 {!showPalletInputMode && numBagsWatched === 0 && <p className="text-xs text-muted-foreground pt-1">Enter tare or defaults to 0.</p>}
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
                                       {validDoeOptions.map((option) => (
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

    