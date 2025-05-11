
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
import { Form, FormField, FormItem, FormMessage, FormControl } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { CalendarIcon, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { CARRIERS, SUBCARRIERS, DEFAULT_SENDER_ADDRESS, DEFAULT_CONSIGNEE_ADDRESS } from '@/lib/constants';
import AISuggestionSection from './ai-suggestion-section';
import type { SuggestShipmentDetailsInput } from '@/ai/flows/suggest-shipment-details';
import { addShipmentToFirestore } from '@/lib/firebase/shipments';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';


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
  totalWeight: z.number().optional(),
});

type ShipmentFormData = z.infer<typeof shipmentFormSchema>;

export default function ShipmentForm() {
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiInput, setAiInput] = useState<SuggestShipmentDetailsInput | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { currentUser } = useAuth(); // Get current user for role check

  const isAdmin = currentUser?.role === 'admin';
  
  const formHook = useForm<ShipmentFormData>({
    resolver: zodResolver(shipmentFormSchema),
    defaultValues: {
      departureDate: new Date(),
      arrivalDate: new Date(new Date().setDate(new Date().getDate() + 1)),
      status: false,
      senderAddress: DEFAULT_SENDER_ADDRESS,
      consigneeAddress: DEFAULT_CONSIGNEE_ADDRESS,
    },
  });

  const onSubmit = async (data: ShipmentFormData) => {
    setIsSubmitting(true);
    try {
      const shipmentDataForFirestore = {
        ...data,
        departureDate: new Date(data.departureDate),
        arrivalDate: new Date(data.arrivalDate),
      };
      await addShipmentToFirestore(shipmentDataForFirestore);
      toast({
        title: "Shipment Created",
        description: "The new shipment has been saved successfully.",
        variant: "default",
      });
      formHook.reset();
      setShowAISuggestions(false); 
      router.push('/shipments'); 
    } catch (error) {
      console.error("Error saving shipment:", error);
      toast({
        title: "Error",
        description: "Failed to save the shipment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }

    const preparedAiInput: SuggestShipmentDetailsInput = {
      carrier: data.carrier,
      subcarrier: data.subcarrier,
      driverName: data.driverName,
      departureDate: format(data.departureDate, 'yyyy-MM-dd'),
      arrivalDate: format(data.arrivalDate, 'yyyy-MM-dd'),
      senderAddress: data.senderAddress || '',
      consigneeAddress: data.consigneeAddress || '',
    };
    setAiInput(preparedAiInput);
    setShowAISuggestions(true);
  };

  return (
    <Form {...formHook}>
      <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={formHook.control}
            name="carrier"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="carrier">Carrier</Label>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger id="carrier" className="mt-1">
                      <SelectValue placeholder="Select carrier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CARRIERS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formHook.control}
            name="subcarrier"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="subcarrier">Subcarrier</Label>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger id="subcarrier" className="mt-1">
                      <SelectValue placeholder="Select subcarrier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SUBCARRIERS.map(sc => <SelectItem key={sc.value} value={sc.value}>{sc.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={formHook.control}
          name="driverName"
          render={({ field }) => (
            <FormItem>
              <Label htmlFor="driverName">Driver Name</Label>
              <FormControl>
                <Input id="driverName" {...field} className="mt-1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={formHook.control}
            name="departureDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <Label htmlFor="departureDate">Departure Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal mt-1", !field.value && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formHook.control}
            name="arrivalDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <Label htmlFor="arrivalDate">Arrival Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal mt-1", !field.value && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={formHook.control}
            name="sealNumber"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="sealNumber">Seal Number</Label>
                <FormControl>
                  <Input id="sealNumber" {...field} className="mt-1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formHook.control}
            name="truckRegistration"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="truckRegistration">Truck Registration #</Label>
                <FormControl>
                  <Input id="truckRegistration" {...field} className="mt-1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formHook.control}
            name="trailerRegistration"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="trailerRegistration">Trailer Registration #</Label>
                <FormControl>
                  <Input id="trailerRegistration" {...field} className="mt-1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {isAdmin && (
          <div className="space-y-6 border-t border-border pt-6 mt-6">
              <h3 className="text-lg font-medium text-foreground">
                  Address Information (Admin)
              </h3>
              <FormField
                control={formHook.control}
                name="senderAddress"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="senderAddress">Sender Address</Label>
                    <FormControl>
                      <Textarea id="senderAddress" {...field} className="mt-1 min-h-[80px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formHook.control}
                name="consigneeAddress"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="consigneeAddress">Consignee Address</Label>
                    <FormControl>
                      <Textarea id="consigneeAddress" {...field} className="mt-1 min-h-[80px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </div>
        )}

        <FormField
            control={formHook.control}
            name="totalWeight"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="totalWeight">Total Weight (kg)</Label>
                <FormControl>
                  <Input id="totalWeight" type="number" {...field} onChange={event => field.onChange(+event.target.value)} className="mt-1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        <FormField
          control={formHook.control}
          name="status"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-4">
              <FormControl>
                <Switch
                  id="status"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <Label htmlFor="status" className="text-base">
                Mark as Completed (Status: {formHook.watch("status") ? "Completed" : "Pending"})
              </Label>
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-3 pt-6">
          <Button type="button" variant="outline" onClick={() => {formHook.reset(); setShowAISuggestions(false);}}>
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
