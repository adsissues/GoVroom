'use server';
/**
 * @fileOverview Provides AI-powered suggestions for shipment details.
 *
 * - suggestShipmentDetails - A function that suggests shipment details based on input.
 * - SuggestShipmentDetailsInput - The input type for the suggestShipmentDetails function.
 * - SuggestShipmentDetailsOutput - The return type for the suggestShipmentDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestShipmentDetailsInputSchema = z.object({
  carrier: z.string().describe('The carrier for the shipment.'),
  subcarrier: z.string().describe('The subcarrier for the shipment.'),
  driverName: z.string().describe('The name of the driver.'),
  departureDate: z.string().describe('The departure date of the shipment.'),
  arrivalDate: z.string().describe('The arrival date of the shipment.'),
  senderAddress: z.string().describe('The sender address for the shipment.'),
  consigneeAddress: z.string().describe('The consignee address for the shipment.'),
  previousShipmentDetails: z.string().optional().describe('Details from previous shipments, if available.'),
});
export type SuggestShipmentDetailsInput = z.infer<typeof SuggestShipmentDetailsInputSchema>;

const SuggestShipmentDetailsOutputSchema = z.object({
  suggestedNumberOfBags: z.number().describe('Suggested number of bags for the shipment.'),
  suggestedCustomer: z.string().describe('Suggested customer for the shipment.'),
  suggestedService: z.string().describe('Suggested service for the shipment.'),
});
export type SuggestShipmentDetailsOutput = z.infer<typeof SuggestShipmentDetailsOutputSchema>;

export async function suggestShipmentDetails(input: SuggestShipmentDetailsInput): Promise<SuggestShipmentDetailsOutput> {
  return suggestShipmentDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestShipmentDetailsPrompt',
  input: {schema: SuggestShipmentDetailsInputSchema},
  output: {schema: SuggestShipmentDetailsOutputSchema},
  prompt: `You are an AI assistant that helps users fill out shipment details forms by suggesting values for certain fields.

  Based on the provided shipment information and historical data, suggest values for the following fields:

  - Number of Bags
  - Customer
  - Service

  Here is the shipment information:

  Carrier: {{{carrier}}}
  Subcarrier: {{{subcarrier}}}
  Driver Name: {{{driverName}}}
  Departure Date: {{{departureDate}}}
  Arrival Date: {{{arrivalDate}}}
  Sender Address: {{{senderAddress}}}
  Consignee Address: {{{consigneeAddress}}}

  {{#if previousShipmentDetails}}
  Here are details from previous shipments:
  {{{previousShipmentDetails}}}
  {{/if}}

  Please provide your suggestions in the following JSON format:
  { 
    "suggestedNumberOfBags": <number>,
    "suggestedCustomer": <string>,
    "suggestedService": <string>
  }
  `,
});

const suggestShipmentDetailsFlow = ai.defineFlow(
  {
    name: 'suggestShipmentDetailsFlow',
    inputSchema: SuggestShipmentDetailsInputSchema,
    outputSchema: SuggestShipmentDetailsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
