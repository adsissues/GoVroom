"use client";

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Form } from '@/components/ui/form'; // Import Form provider
import { cn } from '@/lib/utils';
import { CalendarIcon, AlertCircle, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { CARRIERS, SUBCARRIERS, DEFAULT_SENDER_ADDRESS, DEFAULT_CONSIGNEE_ADDRESS } from '@/lib/constants';
import AISuggestionSection from './ai-suggestion-section';
import type { SuggestShipmentDetailsInput } from '@/ai/flows/suggest-shipment-details'; // Import type

const shipmentFormSchema = z.object({
  carrier: z.string().min(1, "Carrier is required"),
  subcarrier: z.string().min(1, "Subcarrier is required"),
  driverName: z.string().min(1, "Driver name is required"),
  departureDate: z.date({ required_error: "Departure date is required" }),
  arrivalDate: z.date({ required_error: "Arrival date is required" }),
  status: z.boolean().default(false), // false for Pending, true for Completed
  sealNumber: z.string().optional(),
  truckRegistration: z.string().optional(),
  trailerRegistration: z.string().optional(),
  senderAddress: z.string().optional().default(DEFAULT_SENDER_ADDRESS),
  consigneeAddress: z.string().optional().default(DEFAULT_CONSIGNEE_ADDRESS),
});

type ShipmentFormData = z.infer<typeof shipmentFormSchema>;

export default function ShipmentForm() {
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiInput, setAiInput] = useState<SuggestShipmentDetailsInput | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Mock admin status
  const isAdmin = true; 

  const formHook = useForm<ShipmentFormData>({ // Renamed to formHook to avoid conflict if Form component itself was named 'form' by mistake
    resolver: zodResolver(shipmentFormSchema),
    defaultValues: {
      departureDate: new Date(),
      arrivalDate: new Date(new Date().setDate(new Date().getDate() + 1)),
      status: false,
      senderAddress: DEFAULT_SENDER_ADDRESS,
      consigneeAddress: DEFAULT_CONSIGNEE_ADDRESS,
    },
  });

  const onSubmit = (data: ShipmentFormData) => {
    setIsSubmitting(true);
    console.log("Shipment Data:", data);
    // In a real app, save to Firestore here.

    const preparedAiInput: SuggestShipmentDetailsInput = {
      carrier: data.carrier,
      subcarrier: data.subcarrier,
      driverName: data.driverName,
      departureDate: format(data.departureDate, 'yyyy-MM-dd'),
      arrivalDate: format(data.arrivalDate, 'yyyy-MM-dd'),
      senderAddress: data.senderAddress || '',
      consigneeAddress: data.consigneeAddress || '',
      // previousShipmentDetails: "Optional: any historical data as a string" 
    };
    setAiInput(preparedAiInput);
    setShowAISuggestions(true);
    
    // Simulate API call
    setTimeout(() => {
        setIsSubmitting(false);
        formHook.reset(); // Reset form after submission
         // Potentially show a success toast here
    }, 1000);
  };

  return (
    <Form {...formHook}> {/* Wrap with FormProvider */}
      <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Carrier */}
          <div>
            <Label htmlFor="carrier">Carrier</Label>
            <Controller
              name="carrier"
              control={formHook.control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger id="carrier" className="mt-1">
                    <SelectValue placeholder="Select carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIERS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
            {formHook.formState.errors.carrier && <p className="text-sm text-destructive mt-1">{formHook.formState.errors.carrier.message}</p>}
          </div>

          {/* Subcarrier */}
          <div>
            <Label htmlFor="subcarrier">Subcarrier</Label>
            <Controller
              name="subcarrier"
              control={formHook.control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger id="subcarrier" className="mt-1">
                    <SelectValue placeholder="Select subcarrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBCARRIERS.map(sc => <SelectItem key={sc.value} value={sc.value}>{sc.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
            {formHook.formState.errors.subcarrier && <p className="text-sm text-destructive mt-1">{formHook.formState.errors.subcarrier.message}</p>}
          </div>
        </div>

        {/* Driver Name */}
        <div>
          <Label htmlFor="driverName">Driver Name</Label>
          <Input id="driverName" {...formHook.register("driverName")} className="mt-1" />
          {formHook.formState.errors.driverName && <p className="text-sm text-destructive mt-1">{formHook.formState.errors.driverName.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Departure Date */}
          <div>
            <Label htmlFor="departureDate">Departure Date</Label>
            <Controller
              name="departureDate"
              control={formHook.control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn("w-full justify-start text-left font-normal mt-1", !field.value && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
              )}
            />
            {formHook.formState.errors.departureDate && <p className="text-sm text-destructive mt-1">{formHook.formState.errors.departureDate.message}</p>}
          </div>

          {/* Arrival Date */}
          <div>
            <Label htmlFor="arrivalDate">Arrival Date</Label>
            <Controller
              name="arrivalDate"
              control={formHook.control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn("w-full justify-start text-left font-normal mt-1", !field.value && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
              )}
            />
            {formHook.formState.errors.arrivalDate && <p className="text-sm text-destructive mt-1">{formHook.formState.errors.arrivalDate.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Seal Number */}
          <div>
            <Label htmlFor="sealNumber">Seal Number</Label>
            <Input id="sealNumber" {...formHook.register("sealNumber")} className="mt-1" />
          </div>
          {/* Truck Registration */}
          <div>
            <Label htmlFor="truckRegistration">Truck Registration #</Label>
            <Input id="truckRegistration" {...formHook.register("truckRegistration")} className="mt-1" />
          </div>
          {/* Trailer Registration */}
          <div>
            <Label htmlFor="trailerRegistration">Trailer Registration #</Label>
            <Input id="trailerRegistration" {...formHook.register("trailerRegistration")} className="mt-1" />
          </div>
        </div>
        
        {/* Admin-only fields */}
        {isAdmin && (
          <div className="space-y-6 border-t border-border pt-6 mt-6">
              <h3 className="text-lg font-medium text-foreground flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2 text-primary" />
                  Admin Section: Addresses
              </h3>
              <div>
                  <Label htmlFor="senderAddress">Sender Address</Label>
                  <Textarea id="senderAddress" {...formHook.register("senderAddress")} className="mt-1 min-h-[80px]" />
                  <p className="text-xs text-muted-foreground mt-1">Editable by Admins only.</p>
              </div>
              <div>
                  <Label htmlFor="consigneeAddress">Consignee Address</Label>
                  <Textarea id="consigneeAddress" {...formHook.register("consigneeAddress")} className="mt-1 min-h-[80px]" />
                  <p className="text-xs text-muted-foreground mt-1">Editable by Admins only.</p>
              </div>
          </div>
        )}


        {/* Status Toggle */}
        <div className="flex items-center space-x-2 pt-4">
          <Controller
            name="status"
            control={formHook.control}
            render={({ field }) => (
              <Switch
                id="status"
                checked={field.value}
                onCheckedChange={field.onChange}
                // aria-readonly removed as it's not a standard prop for Switch and likely not the cause of parsing error
              />
            )}
          />
          <Label htmlFor="status" className="text-base">
            Mark as Completed (Status: {formHook.watch("status") ? "Completed" : "Pending"})
          </Label>
        </div>

        <div className="flex justify-end space-x-3 pt-6">
          <Button type="button" variant="outline" onClick={() => formHook.reset()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Shipment"}
          </Button>
        </div>

        {showAISuggestions && aiInput && (
          <div className="mt-8 border-t border-border pt-8">
             <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <Lightbulb className="w-6 h-6 mr-2 text-yellow-400" />
              AI Suggestions for Shipment Details
            </h3>
            <AISuggestionSection input={aiInput} />
          </div>
        )}
      </form>
    </Form>
  );
}