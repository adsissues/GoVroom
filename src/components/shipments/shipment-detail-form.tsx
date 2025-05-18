"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label as ShadcnLabel } from "@/components/ui/label";

import { useToast } from '@/hooks/use-toast';
import type { ShipmentDetail, DropdownItem } from '@/lib/types';
import { getDropdownOptions } from '@/lib/firebase/dropdownService';
import { TARE_WEIGHT_DEFAULT, BAG_WEIGHT_MULTIPLIER, SERVICE_FORMAT_MAPPING, ASENDIA_CUSTOMER_VALUE, DEFAULT_PRIOR_SERVICE_ID } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// This should match the 'value' field in your /services Firestore for the "Prior" service
// const DEFAULT_PRIOR_SERVICE_VALUE = "prior"; // Now using DEFAULT_PRIOR_SERVICE_ID from constants

const detailFormSchema = z.object({
  numPallets: z.coerce.number().min(0, "Pallets cannot be negative").default(1),
  numBags: z.coerce.number().min(0, "Bags cannot be negative").default(0),
  customerId: z.string().min(1, "Customer is required."),
  serviceId: z.string().min(1, "Service is required."),
  formatId: z.string().optional().default(''), // Optional at base, refined below
  tareWeight: z.coerce.number().min(0, "Tare weight cannot be negative."),
  grossWeight: z.coerce.number().min(0, "Gross weight cannot be negative."),
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
  onSave: (data: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'>) => Promise<void>;
}

const fetchCustomers = () => getDropdownOptions('customers');
const fetchServices = () => getDropdownOptions('services');
const fetchDoes = () => getDropdownOptions('doe');
const fetchFormats = (formatCollectionId: string | null) => {
    if (!formatCollectionId) return Promise.resolve([]);
    // console.log('[fetchFormats] Fetching formats for collection:', formatCollectionId);
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
  
  const [currentServiceId, setCurrentServiceId] = useState<string>(
    detail?.serviceId ?? DEFAULT_PRIOR_SERVICE_ID
  );
  const [showPalletInputMode, setShowPalletInputMode] = useState(true);

  const { data: customerOptions = [], isLoading: isLoadingCustomers, error: errorCustomers } = useQuery<DropdownItem[]>({
      queryKey: ['customers'], queryFn: fetchCustomers, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });
  const { data: serviceOptions = [], isLoading: isLoadingServices, error: errorServices } = useQuery<DropdownItem[]>({
      queryKey: ['services'], queryFn: fetchServices, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });
  const { data: doeOptions = [], isLoading: isLoadingDoes, error: errorDoes } = useQuery<DropdownItem[]>({
      queryKey: ['doe'], queryFn: fetchDoes, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });

  const formHook = useForm<DetailFormValues>({
    resolver: zodResolver(detailFormSchema),
    defaultValues: { // Set defaults here for initial form state
        numPallets: 1,
        numBags: 0,
        customerId: ASENDIA_CUSTOMER_VALUE,
        serviceId: DEFAULT_PRIOR_SERVICE_ID,
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
    const mappedCollection = serviceKey ? SERVICE_FORMAT_MAPPING[serviceKey] || null : null;
    // console.log('[FORMAT COLLECTION DEBUG] currentServiceId:', currentServiceId, 'serviceKey:', serviceKey, 'Mapped Collection:', mappedCollection);
    return mappedCollection;
  }, [currentServiceId]);

  const { data: rawFormatOptions = [], isLoading: isLoadingFormats, error: errorFormats } = useQuery<DropdownItem[]>({
      queryKey: ['formats', formatCollectionId],
      queryFn: () => fetchFormats(formatCollectionId),
      enabled: !!formatCollectionId && isOpen,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
  });
  // console.log('[FORMAT OPTIONS DEBUG] Raw formatOptions:', rawFormatOptions, 'isLoading:', isLoadingFormats);


  const serviceLabelForFormat = useMemo(() => {
    if (isLoadingServices || serviceOptions.length === 0) return "FORMAT";
    const selectedService = serviceOptions.find(s => s.value === currentServiceId);
    return selectedService ? selectedService.label.toUpperCase() : "FORMAT";
  }, [currentServiceId, serviceOptions, isLoadingServices]);

  const showFormatRadioGroup = !!formatCollectionId;

  const validCustomerOptions = useMemo(() => customerOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [customerOptions]);
  const validServiceOptions = useMemo(() => serviceOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [serviceOptions]);
  const validDoeOptions = useMemo(() => doeOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [doeOptions]);
  const validFormatOptions = useMemo(() => {
    const filtered = rawFormatOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== '');
    // console.log('[FORMAT OPTIONS DEBUG] Filtered validFormatOptions:', filtered);
    return filtered;
  }, [rawFormatOptions]);

  const dropdownsLoading = isLoadingCustomers || isLoadingServices || isLoadingDoes || (showFormatRadioGroup && isLoadingFormats);

  const newFormDefaults = useMemo(() => ({
    numPallets: 1,
    numBags: 0,
    customerId: ASENDIA_CUSTOMER_VALUE,
    serviceId: DEFAULT_PRIOR_SERVICE_ID,
    formatId: '',
    tareWeight: TARE_WEIGHT_DEFAULT,
    grossWeight: 0,
    dispatchNumber: '',
    doeId: '',
  }), []);


  useEffect(() => {
    // console.log('[FORM INIT EFFECT] isOpen:', isOpen, 'Detail:', detail ? detail.id : 'New', 'isLoadingCustomers:', isLoadingCustomers, 'isLoadingServices:', isLoadingServices);
    if (isOpen) {
      if (detail) {
        // console.log('[FORM INIT EFFECT] Editing existing detail. Resetting form with detail:', detail);
        const initialFormValues = {
          numPallets: detail.numPallets ?? 0,
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
        setCurrentServiceId(initialFormValues.serviceId || DEFAULT_PRIOR_SERVICE_ID);
        setShowPalletInputMode((initialFormValues.numPallets > 0) || (initialFormValues.numPallets === 0 && initialFormValues.numBags === 0));
      } else if (!isLoadingCustomers && !isLoadingServices) { // Only reset for new form if options are loaded
        // console.log('[FORM INIT EFFECT] Adding new item. Options loaded. Resetting form to defaults:', newFormDefaults);
        reset(newFormDefaults);
        setCurrentServiceId(DEFAULT_PRIOR_SERVICE_ID);
        setShowPalletInputMode(true);
      }
    }
  }, [isOpen, detail, reset, isLoadingCustomers, isLoadingServices, newFormDefaults]);


  const syncPalletBagRHFValues = useCallback((isPalletMode: boolean) => {
    // console.log('[SYNC RHF] Mode isPalletMode:', isPalletMode, 'Current numPallets:', getValues('numPallets'), 'Current numBags:', getValues('numBags'));
    if (isPalletMode) {
      setValue('numBags', 0, { shouldValidate: false });
      if (getValues('numPallets') === 0) { // If switching to pallet mode and pallets were 0 (e.g., from bag mode)
        setValue('numPallets', 1, { shouldValidate: false });
      }
    } else { // Bag mode
      setValue('numPallets', 0, { shouldValidate: false });
      // If numBags is 0 when switching to bag mode, it will stay 0, allowing user input
    }
  }, [setValue, getValues]);

  useEffect(() => {
    // This effect ensures RHF values are synced after mode change.
    // Using setTimeout to defer execution slightly, ensuring state updates from setShowPalletInputMode have propagated.
    const timer = setTimeout(() => {
        syncPalletBagRHFValues(showPalletInputMode);
    }, 0);
    return () => clearTimeout(timer);
  }, [showPalletInputMode, syncPalletBagRHFValues]);

  useEffect(() => {
    let newTareWeight;
    if (showPalletInputMode) {
        newTareWeight = TARE_WEIGHT_DEFAULT;
    } else { // Bag mode
        if (numBagsWatched > 0) {
            newTareWeight = parseFloat((numBagsWatched * BAG_WEIGHT_MULTIPLIER).toFixed(3));
        } else {
            newTareWeight = 0; // If bags are 0 in bag mode, tare is 0
        }
    }
    if (newTareWeight !== getValues('tareWeight')) {
        setValue('tareWeight', newTareWeight, { shouldValidate: true });
    }
  }, [showPalletInputMode, numBagsWatched, setValue, getValues]);

  useEffect(() => {
    // console.log(`[SERVICE CHANGE DEBUG] watchedServiceId: ${watchedServiceId}, currentServiceId: ${currentServiceId}`);
    if (watchedServiceId !== currentServiceId) {
      setCurrentServiceId(watchedServiceId);
      setValue('formatId', '', { shouldValidate: false }); // Reset format when service changes
      const serviceKey = watchedServiceId ? watchedServiceId.toLowerCase() : '';
      const newFormatCollectionId = serviceKey ? SERVICE_FORMAT_MAPPING[serviceKey] || null : null;
      // console.log(`[SERVICE CHANGE DEBUG] Service changed. New currentServiceId: ${watchedServiceId}, New formatCollectionId: ${newFormatCollectionId}`);
      if (!newFormatCollectionId) {
        formHook.clearErrors('formatId'); // Clear format errors if new service doesn't require format
      }
    }
  }, [watchedServiceId, currentServiceId, setValue, formHook]);

  useEffect(() => {
    const formatFieldState = formHook.getFieldState('formatId');
    if (showFormatRadioGroup && (formState.isSubmitted || formatFieldState.isTouched) ) {
        trigger('formatId');
    }
  }, [watchedFormatId, formState.isSubmitted, trigger, showFormatRadioGroup, formHook]);


  const handleToggleInputMode = () => {
    // console.log('[TOGGLE MODE] Current showPalletInputMode:', showPalletInputMode);
    setShowPalletInputMode(prev => !prev);
    // RHF value sync will be handled by the useEffect listening to showPalletInputMode
  };

  const onSubmit = async (data: DetailFormValues) => {
    // console.log('[SUBMIT] Form data at start of onSubmit:', JSON.parse(JSON.stringify(data)));
    setIsSaving(true);
    try {
       let finalData = { ...data };
       if (showPalletInputMode) {
           finalData.numBags = 0;
           if (finalData.numPallets <= 0 && !detail) finalData.numPallets = 1; // Ensure at least 1 pallet if new & in pallet mode
       } else { // Bag mode
           finalData.numPallets = 0;
           // numBags already holds the correct value
       }
       // console.log('[SUBMIT] Final data before creating saveData object:', JSON.parse(JSON.stringify(finalData)));

       const serviceKeyForSave = finalData.serviceId ? finalData.serviceId.toLowerCase() : '';
       const formatRequiredForSave = serviceKeyForSave ? !!SERVICE_FORMAT_MAPPING[serviceKeyForSave] : false;

       const saveData: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'> = {
         numPallets: finalData.numPallets,
         numBags: finalData.numBags,
         customerId: finalData.customerId,
         serviceId: finalData.serviceId,
         formatId: formatRequiredForSave ? (finalData.formatId || '') : '', // Save empty string if format not required or not selected
         tareWeight: finalData.tareWeight,
         grossWeight: finalData.grossWeight,
         dispatchNumber: finalData.dispatchNumber || undefined,
         doeId: finalData.doeId || undefined,
       };
      // console.log('[SUBMIT] Data being sent to onSave:', JSON.parse(JSON.stringify(saveData)));
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

  const radioButtonStyle = (checked: boolean) =>
    cn(
      "flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium cursor-pointer transition-colors shadow-sm",
      "hover:bg-accent hover:text-accent-foreground",
      checked
        ? "bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-primary ring-offset-2"
        : "bg-muted text-muted-foreground hover:bg-muted/80"
    );

  return (
     <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>{detail ? 'Edit Shipment Item' : 'Add Shipment Item'}</DialogTitle>
          <DialogDescription>
            Fill in the details for this item. Required fields are marked with an asterisk (*).
          </DialogDescription>
        </DialogHeader>
         {dropdownsLoading && isOpen ? (
             <div className="space-y-4 p-6">
                 {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
             </div>
         ) : (
             <Form {...formHook}>
                 <form onSubmit={formHook.handleSubmit(onSubmit)} className="overflow-y-auto">
                    <div className="space-y-6 p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
                     <div className="flex justify-end mb-4">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleToggleInputMode}
                            disabled={isSaving}
                            className="shadow-sm"
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
                                  <FormLabel>Pallet Number</FormLabel>
                                  <FormControl>
                                     <Input type="number" min="0" {...field} disabled={isSaving}
                                     onChange={e => {
                                        const pallets = parseInt(e.target.value, 10);
                                        const newPalletValue = isNaN(pallets) || pallets < 0 ? 0 : pallets;
                                        field.onChange(newPalletValue);
                                        if (newPalletValue <= 0 && showPalletInputMode) { // If pallets become 0, switch to bag mode
                                            setShowPalletInputMode(false);
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
                                    <FormLabel>Number of Bags</FormLabel>
                                    <FormControl>
                                       <Input type="number" min="0" {...field}
                                        onChange={e => {
                                            const bags = parseInt(e.target.value, 10);
                                            const newBagValue = isNaN(bags) || bags < 0 ? 0 : bags;
                                            field.onChange(newBagValue);
                                            if (newBagValue <= 0 && !showPalletInputMode) { // If bags become 0, switch to pallet mode
                                                 setShowPalletInputMode(true);
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
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value || ""} // Ensure value is not undefined
                                    disabled={isSaving || isLoadingCustomers}
                                >
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
                                {errorCustomers && <p className="text-xs text-destructive">Error loading customers.</p>}
                                <FormMessage />
                                </FormItem>
                            )}
                         />
                        </div>

                        <FormField
                            control={control}
                            name="serviceId"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>Service *</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                    onValueChange={(value) => {
                                        // console.log('[SERVICE SELECT] Selected service value:', value);
                                        field.onChange(value);
                                        // setCurrentServiceId(value); // This is handled by useEffect on watchedServiceId
                                    }}
                                    value={field.value || ""}
                                    className="flex flex-wrap gap-2"
                                    disabled={isSaving || isLoadingServices}
                                    >
                                    {validServiceOptions.map((option) => (
                                        <FormItem key={option.id} className="flex items-center space-x-0 space-y-0">
                                            <FormControl>
                                                <RadioGroupItem value={option.value} id={`serv-${option.id}-${option.value}`} className="peer sr-only" />
                                            </FormControl>
                                            <ShadcnLabel htmlFor={`serv-${option.id}-${option.value}`} className={radioButtonStyle(field.value === option.value)}>
                                                {option.label}
                                            </ShadcnLabel>
                                        </FormItem>
                                    ))}
                                    </RadioGroup>
                                </FormControl>
                                {errorServices && <p className="text-xs text-destructive">Error loading services.</p>}
                                <FormMessage />
                                </FormItem>
                            )}
                        />

                        {showFormatRadioGroup && (
                            <FormField
                                control={control}
                                name="formatId"
                                render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Format {serviceLabelForFormat} *</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            key={currentServiceId} // Re-mount when service (and thus options) change
                                            onValueChange={(value) => {
                                                // console.log('[FORMAT SELECT] Selected format value:', value);
                                                field.onChange(value);
                                                // No need to trigger validation here directly, useEffect will handle it
                                            }}
                                            value={field.value || ""}
                                            className="flex flex-wrap gap-2"
                                            disabled={isSaving || isLoadingFormats}
                                        >
                                        {isLoadingFormats && <Skeleton className="h-10 w-24" />}
                                        {!isLoadingFormats && validFormatOptions.length === 0 && <p className="text-sm text-muted-foreground">No formats available for this service.</p>}
                                        {validFormatOptions.map((option) => (
                                            <FormItem key={option.id} className="flex items-center space-x-0 space-y-0">
                                                <FormControl>
                                                    <RadioGroupItem value={option.value} id={`fmt-${currentServiceId}-${option.id}-${option.value}`} className="peer sr-only" />
                                                </FormControl>
                                                <ShadcnLabel htmlFor={`fmt-${currentServiceId}-${option.id}-${option.value}`} className={radioButtonStyle(field.value === option.value)}>
                                                    {option.label}
                                                </ShadcnLabel>
                                            </FormItem>
                                        ))}
                                        </RadioGroup>
                                    </FormControl>
                                    {errorFormats && <p className="text-xs text-destructive">Error loading formats.</p>}
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                          )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                            <FormField
                               control={control}
                               name="tareWeight"
                               render={({ field }) => (
                                  <FormItem>
                                     <FormLabel>Tare Weight *</FormLabel>
                                     <FormControl>
                                        <Input type="number" step="0.001" min="0" {...field}
                                               onChange={e => {
                                                const weight = parseFloat(e.target.value);
                                                field.onChange(isNaN(weight) || weight < 0 ? 0 : weight);
                                               }}
                                               disabled={isSaving || showPalletInputMode || (!showPalletInputMode && numBagsWatched > 0) }
                                               title={
                                                showPalletInputMode ? `Default tare for pallets: ${TARE_WEIGHT_DEFAULT} kg` :
                                                (numBagsWatched > 0 ? `Auto-calculated for bags: ${(numBagsWatched * BAG_WEIGHT_MULTIPLIER).toFixed(3)} kg` : "Enter tare weight (usually 0)")
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
                                  <FormLabel>Gross Weight *</FormLabel>
                                  <FormControl>
                                     <Input type="number" step="0.001" min="0" {...field}
                                        onChange={e => {
                                            const weight = parseFloat(e.target.value);
                                            field.onChange(isNaN(weight) || weight < 0 ? 0 : weight);
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
                                  <FormLabel>Dispatch Number *</FormLabel>
                                  <FormControl>
                                     <Input type="text" {...field} value={field.value || ''} disabled={isSaving} placeholder="Enter dispatch number"/>
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
                                     {errorDoes && <p className="text-xs text-destructive">Error loading DOE options.</p>}
                                     <FormMessage />
                                  </FormItem>
                               )}
                             />
                        </div>
                    </div>
                      <DialogFooter className="p-6 border-t mt-0 sticky bottom-0 bg-card">
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
