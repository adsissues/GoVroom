
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
import { Label as ShadcnLabel } from "@/components/ui/label"; // Renamed to avoid conflict

import { useToast } from '@/hooks/use-toast';
import type { ShipmentDetail, DropdownItem } from '@/lib/types';
import { getDropdownOptions } from '@/lib/firebase/dropdownService';
import { ASENDIA_CUSTOMER_VALUE, BAG_WEIGHT_MULTIPLIER, SERVICE_FORMAT_MAPPING, DEFAULT_PRIOR_SERVICE_ID, TARE_WEIGHT_DEFAULT } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';


const detailFormSchema = z.object({
  numPallets: z.coerce.number().min(0, "Pallets cannot be negative").default(1),
  numBags: z.coerce.number().min(0, "Bags cannot be negative").default(0),
  customerId: z.string().min(1, "Customer is required."),
  serviceId: z.string().min(1, "Service is required."),
  formatId: z.string().optional().default(''),
  tareWeight: z.coerce.number().min(0, "Tare weight cannot be negative."),
  grossWeight: z.coerce.number().min(0, "Gross weight cannot be negative."),
  dispatchNumber: z.string().optional().refine(val => val === undefined || val === '' || /^[0-9]+$/.test(val), {
    message: "Dispatch Number must contain only digits.",
  }),
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

// Fetch functions for TanStack Query
const fetchCustomers = () => getDropdownOptions('customers');
const fetchServices = () => getDropdownOptions('services');
const fetchDoes = () => getDropdownOptions('doe'); // For DOE options
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
  const [currentServiceId, setCurrentServiceId] = useState<string>(DEFAULT_PRIOR_SERVICE_ID);
  const [showPalletInputMode, setShowPalletInputMode] = useState(true); // true for Pallet, false for Bag


  const { data: customerOptions = [], isLoading: isLoadingCustomers, error: errorCustomers } = useQuery<DropdownItem[]>({
      queryKey: ['customers'], queryFn: fetchCustomers, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });
  const { data: serviceOptions = [], isLoading: isLoadingServices, error: errorServices } = useQuery<DropdownItem[]>({
      queryKey: ['services'], queryFn: fetchServices, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });
  const { data: doeOptions = [], isLoading: isLoadingDoes, error: errorDoes } = useQuery<DropdownItem[]>({ // Fetch DOE options
      queryKey: ['doe'], queryFn: fetchDoes, staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 });


  const newFormDefaults = useMemo(() => ({
    numPallets: 1,
    numBags: 0,
    customerId: ASENDIA_CUSTOMER_VALUE, // Default to Asendia UK
    serviceId: DEFAULT_PRIOR_SERVICE_ID,  // Default to Prior
    formatId: '',
    tareWeight: TARE_WEIGHT_DEFAULT, // Will be adjusted by effect
    grossWeight: 0,
    dispatchNumber: '',
    doeId: '',
  }), []);

  const formHook = useForm<DetailFormValues>({
    resolver: zodResolver(detailFormSchema),
    defaultValues: newFormDefaults,
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
      enabled: !!formatCollectionId && isOpen, // Only fetch if a collectionId is determined and dialog is open
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  const serviceLabelForFormat = useMemo(() => {
    if (isLoadingServices || serviceOptions.length === 0) return "FORMAT";
    const selectedService = serviceOptions.find(s => s.value === currentServiceId);
    return selectedService ? selectedService.label.toUpperCase() : "FORMAT";
  }, [currentServiceId, serviceOptions, isLoadingServices]);


  const showFormatRadioGroup = !!formatCollectionId;

  // Filter out options with empty string values before passing to SelectItem or RadioGroupItem
  const validCustomerOptions = useMemo(() => customerOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [customerOptions]);
  const validServiceOptions = useMemo(() => serviceOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [serviceOptions]);
  const validDoeOptions = useMemo(() => doeOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== ''), [doeOptions]);
  const validFormatOptions = useMemo(() => {
    // console.log(`[FORMAT OPTIONS DEBUG] Raw formatOptions for ${formatCollectionId}:`, rawFormatOptions);
    const filtered = rawFormatOptions.filter(option => option && typeof option.value === 'string' && option.value.trim() !== '');
    // console.log(`[FORMAT OPTIONS DEBUG] Filtered validFormatOptions for ${formatCollectionId}:`, filtered);
    return filtered;
  }, [rawFormatOptions]);


  const dropdownsLoading = isLoadingCustomers || isLoadingServices || isLoadingDoes || (showFormatRadioGroup && isLoadingFormats);

  // Effect for initializing or resetting the form when dialog opens or detail changes
  useEffect(() => {
    // console.log('[FORM INIT EFFECT] isOpen:', isOpen, 'Detail ID:', detail?.id, 'isLoadingCust:', isLoadingCustomers, 'isLoadingServ:', isLoadingServices);
    if (isOpen) {
      if (detail) { // Editing existing detail
        // console.log('[FORM INIT EFFECT] Editing existing detail. Resetting form with detail:', detail);
        const initialPallets = detail.numPallets ?? 0;
        const initialBags = detail.numBags ?? 0;
        
        reset({
          numPallets: initialPallets,
          numBags: initialBags,
          customerId: detail.customerId ?? ASENDIA_CUSTOMER_VALUE,
          serviceId: detail.serviceId ?? DEFAULT_PRIOR_SERVICE_ID,
          formatId: detail.formatId ?? '',
          tareWeight: detail.tareWeight ?? TARE_WEIGHT_DEFAULT,
          grossWeight: detail.grossWeight ?? 0,
          dispatchNumber: detail.dispatchNumber ?? '',
          doeId: detail.doeId ?? '',
        });
        setCurrentServiceId(detail.serviceId ?? DEFAULT_PRIOR_SERVICE_ID);
        setShowPalletInputMode(initialPallets > 0 || (initialPallets === 0 && initialBags === 0)); // Default to pallet mode if both are 0 or pallets > 0
      } else if (!isLoadingCustomers && !isLoadingServices) { // Adding new item and dropdown options have loaded
        // console.log('[FORM INIT EFFECT] Adding new item. Resetting form to defaults (post-options load):', newFormDefaults);
        reset(newFormDefaults);
        setCurrentServiceId(DEFAULT_PRIOR_SERVICE_ID);
        setShowPalletInputMode(true); // Default to pallet mode for new items
      }
    }
  }, [isOpen, detail, reset, newFormDefaults, isLoadingCustomers, isLoadingServices]);


  // Effect to synchronize RHF numPallets/numBags based on showPalletInputMode
  const syncPalletBagRHFValues = useCallback((isPalletMode: boolean) => {
    // console.log('[SYNC RHF] Mode isPalletMode:', isPalletMode, 'Current numPallets:', getValues('numPallets'), 'Current numBags:', getValues('numBags'));
    if (isPalletMode) {
      setValue('numBags', 0, { shouldValidate: false });
      if (getValues('numPallets') === 0) { // If pallets were 0 (e.g., switching from bag mode where bags became 0)
        setValue('numPallets', 1, { shouldValidate: false }); // Default to 1 pallet
      }
    } else { // Bag mode
      setValue('numPallets', 0, { shouldValidate: false });
      // If numBags is 0 when switching to bag mode, it remains 0 for user input
    }
  }, [setValue, getValues]);

  useEffect(() => {
    // console.log('[MODE SYNC EFFECT] showPalletInputMode changed to:', showPalletInputMode);
    // Defer the RHF value sync slightly to ensure mode state update has propagated
    const timer = setTimeout(() => syncPalletBagRHFValues(showPalletInputMode), 0);
    return () => clearTimeout(timer);
  }, [showPalletInputMode, syncPalletBagRHFValues]);


  // Effect for calculating Tare Weight
  useEffect(() => {
    // console.log('[TARE EFFECT] showPalletInputMode:', showPalletInputMode, 'numBagsWatched:', numBagsWatched);
    let newTareWeight;
    if (showPalletInputMode) { // Pallet mode
        newTareWeight = TARE_WEIGHT_DEFAULT;
    } else { // Bag mode
        if (numBagsWatched > 0) { // Bags have a count
            newTareWeight = parseFloat((numBagsWatched * BAG_WEIGHT_MULTIPLIER).toFixed(3));
        } else { // Bags are 0 (editable Tare Weight state)
            if (detail && detail.numPallets === 0 && detail.numBags === 0 && typeof detail.tareWeight === 'number') {
                 // If editing an item that was specifically saved in "0 pallets, 0 bags" state with a manual tare weight
                newTareWeight = detail.tareWeight;
            } else {
                // For new items, or items transitioning to "0 bags" state in bag mode, default Tare Weight
                newTareWeight = TARE_WEIGHT_DEFAULT;
            }
        }
    }

    if (newTareWeight !== getValues('tareWeight')) {
        // console.log('[TARE EFFECT] Setting tareWeight to:', newTareWeight);
        setValue('tareWeight', newTareWeight, { shouldValidate: true });
    }
  }, [showPalletInputMode, numBagsWatched, setValue, getValues, detail]);


  // Effect for handling service changes and resetting formatId
  useEffect(() => {
    // console.log(`[SERVICE CHANGE DEBUG] watchedServiceId: ${watchedServiceId}, currentServiceId: ${currentServiceId}`);
    if (watchedServiceId !== currentServiceId) {
      setCurrentServiceId(watchedServiceId);
      setValue('formatId', '', { shouldValidate: false }); // Reset formatId and avoid immediate validation
      const serviceKey = watchedServiceId ? watchedServiceId.toLowerCase() : '';
      const newFormatCollectionId = serviceKey ? SERVICE_FORMAT_MAPPING[serviceKey] || null : null;
      // console.log(`[SERVICE CHANGE DEBUG] Service changed. New currentServiceId: ${watchedServiceId}, New formatCollectionId: ${newFormatCollectionId}`);
      if (!newFormatCollectionId) {
        // console.log('[SERVICE CHANGE DEBUG] New service does not require format. Clearing formatId errors.');
        formHook.clearErrors('formatId');
      }
    }
  }, [watchedServiceId, currentServiceId, setValue, formHook]);


  // Effect for validating formatId when it changes or form is submitted (if required)
  useEffect(() => {
    const formatFieldState = formHook.getFieldState('formatId');
    if (showFormatRadioGroup && (formState.isSubmitted || formatFieldState.isTouched) ) {
        // console.log('[FORMAT VALIDATION EFFECT] Triggering validation for formatId. WatchedFormatId:', watchedFormatId, 'IsTouched:', formatFieldState.isTouched, 'IsSubmitted:', formState.isSubmitted);
        trigger('formatId');
    }
  }, [watchedFormatId, formState.isSubmitted, trigger, showFormatRadioGroup, formHook]);


  const handleToggleInputMode = () => {
    // console.log('[TOGGLE MODE] Current showPalletInputMode:', showPalletInputMode);
    setShowPalletInputMode(prev => !prev);
    // RHF value sync (numPallets/numBags) will be handled by the useEffect listening to showPalletInputMode
  };


  const onSubmit = async (data: DetailFormValues) => {
    // console.log('[SUBMIT] Form data at start of onSubmit:', JSON.parse(JSON.stringify(data)));
    setIsSaving(true);
    try {
       let finalData = { ...data }; // Create a mutable copy

       if (showPalletInputMode) {
           finalData.numBags = 0; // Ensure bags are 0 if in pallet mode
           if (finalData.numPallets <= 0 && !detail) finalData.numPallets = 1; // Default to 1 pallet if new and 0
       } else {
           finalData.numPallets = 0; // Ensure pallets are 0 if in bag mode
       }
       // console.log('[SUBMIT] Final data before creating saveData object:', JSON.parse(JSON.stringify(finalData)));

       const serviceKeyForSave = finalData.serviceId ? finalData.serviceId.toLowerCase() : '';
       const formatRequiredForSave = serviceKeyForSave ? !!SERVICE_FORMAT_MAPPING[serviceKeyForSave] : false;

       const saveData: Omit<ShipmentDetail, 'id' | 'shipmentId' | 'createdAt' | 'lastUpdated' | 'netWeight'> = {
         numPallets: finalData.numPallets,
         numBags: finalData.numBags,
         customerId: finalData.customerId,
         serviceId: finalData.serviceId,
         formatId: formatRequiredForSave ? (finalData.formatId || '') : '', // Ensure formatId is empty string if not required or not set
         tareWeight: finalData.tareWeight,
         grossWeight: finalData.grossWeight,
         dispatchNumber: finalData.dispatchNumber || undefined, // Store as undefined if empty
         doeId: finalData.doeId || undefined, // Store as undefined if empty
       };
      // console.log('[SUBMIT] Data being sent to onSave:', JSON.parse(JSON.stringify(saveData)));
      await onSave(saveData);
      onClose(); // Close dialog on successful save
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
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-0"> {/* Allow content to scroll */}
        <DialogHeader className="p-6 pb-4 border-b sticky top-0 bg-card z-10">
          <DialogTitle>{detail ? 'Edit Shipment Item' : 'Add Shipment Item'}</DialogTitle>
          <DialogDescription>
            Fill in the details for this item. Required fields are marked with an asterisk (*).
          </DialogDescription>
        </DialogHeader>

         {/* Loading Skeletons */}
         {dropdownsLoading && isOpen ? (
             <div className="space-y-4 p-6">
                 {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
             </div>
         ) : (
             <Form {...formHook}>
                 <form onSubmit={formHook.handleSubmit(onSubmit)} className="overflow-y-auto"> {/* Form itself can scroll if content overflows */}
                    <div className="space-y-6 p-6 max-h-[calc(90vh-180px)] overflow-y-auto"> {/* Inner content area scroll */}

                     {/* Toggle Button */}
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

                     {/* Pallet/Bag Inputs */}
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
                                        field.onChange(newPalletValue); // Update RHF
                                        if (newPalletValue <= 0 && showPalletInputMode) { // If pallets become 0, switch mode
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
                                            field.onChange(newBagValue); // Update RHF
                                            if (newBagValue <= 0 && !showPalletInputMode) { // If bags become 0, switch mode
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

                         {/* Customer Dropdown */}
                         <FormField
                            control={control}
                            name="customerId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Customer *</FormLabel>
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value || ""} // Ensure value is always a string for Select
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

                        {/* Service Radio Buttons */}
                        <FormField
                            control={control}
                            name="serviceId"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>Service *</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                    onValueChange={(value) => {
                                        field.onChange(value);
                                        // setCurrentServiceId(value); // Let the watch effect handle this
                                    }}
                                    value={field.value || ""} // Handle case where field.value might be null/undefined
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

                        {/* Format Radio Buttons (Conditional) */}
                        {showFormatRadioGroup && (
                            <FormField
                                control={control}
                                name="formatId"
                                render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Format {serviceLabelForFormat} *</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            key={currentServiceId + (field.value || 'empty')} // Add key to help React re-render if options change drastically
                                            onValueChange={(value) => {
                                                field.onChange(value);
                                                // formHook.trigger('formatId'); // Re-added trigger here
                                            }}
                                            value={field.value || ""} // Handle null/undefined
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

                        {/* Tare, Gross, Dispatch, DOE */}
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
                                               disabled={isSaving} // Always editable now
                                        />
                                     </FormControl>
                                     {showPalletInputMode && <p className="text-xs text-muted-foreground pt-1">Default for pallets: {TARE_WEIGHT_DEFAULT} kg.</p>}
                                     {!showPalletInputMode && numBagsWatched > 0 && <p className="text-xs text-muted-foreground pt-1">Auto-calculated ({numBagsWatched} bags × {BAG_WEIGHT_MULTIPLIER} kg/bag). Editable.</p>}
                                     {!showPalletInputMode && numBagsWatched === 0 && <p className="text-xs text-muted-foreground pt-1">Defaults to {TARE_WEIGHT_DEFAULT} kg. Editable.</p>}
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
                                     <Input
                                        type="text"
                                        pattern="[0-9]*"
                                        inputMode="numeric"
                                        placeholder="Enter dispatch number (digits only)"
                                        {...field}
                                        value={field.value || ''}
                                        disabled={isSaving}
                                    />
                                  </FormControl>
                                  <FormMessage />
                               </FormItem>
                               )}
                            />
                            <FormField
                                control={control}
                                name="doeId"
                                render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>DOE</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                        onValueChange={field.onChange}
                                        value={field.value || ""}
                                        className="flex flex-wrap gap-2"
                                        disabled={isSaving || isLoadingDoes}
                                        >
                                        {isLoadingDoes && <Skeleton className="h-10 w-24" />}
                                        {!isLoadingDoes && validDoeOptions.length === 0 && <p className="text-sm text-muted-foreground">No DOE options available.</p>}
                                        {validDoeOptions.map((option) => (
                                            <FormItem key={option.id} className="flex items-center space-x-0 space-y-0">
                                                <FormControl>
                                                    <RadioGroupItem value={option.value} id={`doe-${option.id}-${option.value}`} className="peer sr-only" />
                                                </FormControl>
                                                <ShadcnLabel htmlFor={`doe-${option.id}-${option.value}`} className={radioButtonStyle(field.value === option.value)}>
                                                    {option.label}
                                                </ShadcnLabel>
                                            </FormItem>
                                        ))}
                                        </RadioGroup>
                                    </FormControl>
                                    {errorDoes && <p className="text-xs text-destructive">Error loading DOE options.</p>}
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                    </div>

                      {/* Footer with action buttons */}
                      <DialogFooter className="p-6 border-t mt-0 sticky bottom-0 bg-card z-10">
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

