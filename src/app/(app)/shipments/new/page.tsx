
import ShipmentForm from '@/components/shipments/shipment-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewShipmentPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Create New Shipment</CardTitle>
          <CardDescription>Fill in the details below to add a new main shipment record.</CardDescription>
        </CardHeader>
        <CardContent>
          <ShipmentForm />
        </CardContent>
      </Card>
    </div>
  );
}
