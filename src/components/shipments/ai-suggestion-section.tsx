
"use client";

import { useEffect, useState } from 'react';
import { suggestShipmentDetails, type SuggestShipmentDetailsInput, type SuggestShipmentDetailsOutput } from '@/ai/flows/suggest-shipment-details';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Package, Users, Settings2, AlertTriangle } from 'lucide-react';

interface AISuggestionSectionProps {
  input: SuggestShipmentDetailsInput;
}

export default function AISuggestionSection({ input }: AISuggestionSectionProps) {
  const [suggestions, setSuggestions] = useState<SuggestShipmentDetailsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSuggestions() {
      if (!input) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await suggestShipmentDetails(input);
        setSuggestions(result);
      } catch (err) {
        console.error("Error fetching AI suggestions:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchSuggestions();
  }, [input]);

  if (isLoading) {
    return (
      <Card className="shadow-md rounded-lg">
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-5 w-1/3" />
          </div>
          <div className="flex items-center space-x-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-5 w-1/2" />
          </div>
          <div className="flex items-center space-x-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-5 w-2/5" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="shadow-md rounded-lg">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle>Error Fetching Suggestions</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!suggestions) {
    return <p className="text-muted-foreground">No suggestions available at the moment.</p>;
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 shadow-lg rounded-xl border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg text-primary">AI Generated Suggestions</CardTitle>
        <CardDescription>Based on the provided shipment info, here are some smart suggestions for the next steps.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center p-3 bg-white rounded-lg shadow-sm border border-muted">
          <Package className="h-6 w-6 mr-3 text-blue-500" />
          <div>
            <p className="text-sm text-muted-foreground">Suggested Number of Bags</p>
            <p className="text-lg font-semibold text-foreground">{suggestions.suggestedNumberOfBags}</p>
          </div>
        </div>
        <div className="flex items-center p-3 bg-white rounded-lg shadow-sm border border-muted">
          <Users className="h-6 w-6 mr-3 text-green-500" />
          <div>
            <p className="text-sm text-muted-foreground">Suggested Customer</p>
            <p className="text-lg font-semibold text-foreground">{suggestions.suggestedCustomer}</p>
          </div>
        </div>
        <div className="flex items-center p-3 bg-white rounded-lg shadow-sm border border-muted">
          <Settings2 className="h-6 w-6 mr-3 text-purple-500" />
          <div>
            <p className="text-sm text-muted-foreground">Suggested Service</p>
            <p className="text-lg font-semibold text-foreground">{suggestions.suggestedService}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          These are AI-generated suggestions. Please review them carefully before proceeding.
        </p>
      </CardContent>
    </Card>
  );
}
