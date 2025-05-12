
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function HomePage() {
  // Temporary static content to test the root route
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <h1 className="text-3xl font-bold mb-4">Welcome to GoVroom</h1>
      <p className="text-muted-foreground mb-6">This is the temporary root page.</p>
      <div className="space-x-4">
         <Link href="/login">
             <Button>Go to Login</Button>
         </Link>
          <Link href="/dashboard">
             <Button variant="outline">Go to Dashboard (if logged in)</Button>
          </Link>
      </div>
    </div>
  );
}
