
"use client";
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Ensure FormLabel is imported
import { signInWithEmail } from '@/lib/firebase/authService';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation'; // Import useSearchParams
import { APP_NAME } from '@/lib/constants';
import { LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

const loginFormSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  password: z.string().min(6, "Password must be at least 6 characters").min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams(); // Get search params
  const { currentUser, loading: authLoading } = useAuth(); // Get auth state

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

   // Redirect if user is already logged in
   useEffect(() => {
     if (!authLoading && currentUser) {
         const redirectPath = searchParams.get('redirect') || '/dashboard';
         console.log(`User already logged in, redirecting to: ${redirectPath}`);
         router.replace(redirectPath);
     }
   }, [currentUser, authLoading, router, searchParams]);


  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await signInWithEmail(data.email, data.password);
      toast({
        title: 'Login Successful',
        description: `Welcome back to ${APP_NAME}!`,
      });
      // Get redirect path from query params or default to dashboard
      const redirectPath = searchParams.get('redirect') || '/dashboard';
      router.replace(redirectPath); // Use replace to avoid login page in history
    } catch (error: any) {
      console.error("Login failed:", error);
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid email or password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

   // Show loading indicator if auth check is in progress
   if (authLoading) {
       return (
           <div className="flex items-center justify-center min-h-screen bg-background">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
           </div>
       );
   }

   // Prevent rendering login form if user is logged in (redirect should handle this, but as a fallback)
    if (currentUser) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <p className="text-muted-foreground">Already logged in. Redirecting...</p>
            </div>
        );
    }


  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-xl rounded-xl border">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
            <LogIn className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Login to {APP_NAME}</CardTitle>
          <CardDescription>Enter your credentials to access your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    {/* Use FormLabel for accessibility */}
                    <FormLabel htmlFor="email">Email</FormLabel>
                    <FormControl>
                      <Input id="email" type="email" placeholder="you@example.com" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    {/* Use FormLabel for accessibility */}
                    <FormLabel htmlFor="password">Password</FormLabel>
                    <FormControl>
                      <Input id="password" type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : 'Login'}
              </Button>
            </form>
          </Form>
          {/* Optional: Add link to a signup page or forgot password */}
          {/* <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p> */}
        </CardContent>
      </Card>
    </div>
  );
}
