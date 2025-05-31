
"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { signInWithEmail } from '@/lib/firebase/authService';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { APP_NAME } from '@/lib/constants';
import { LogIn, Loader2, CheckCircle2 } from 'lucide-react'; // Added CheckCircle2
import { useAuth } from '@/contexts/AuthContext';

const loginFormSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  password: z.string().nonempty("Password is required").min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function LoginFormCore() {
  const [loginStatus, setLoginStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, loading: authLoading } = useAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    // Redirect if user is already logged in, but not if we are in the 'success' animation phase
    if (loginStatus !== 'success' && !authLoading && currentUser) {
      const redirectPath = searchParams.get('redirect') || '/dashboard';
      router.replace(redirectPath);
    }
  }, [currentUser, authLoading, router, searchParams, loginStatus]);

  const onSubmit = async (data: LoginFormValues) => {
    setLoginStatus('submitting');
    try {
      await signInWithEmail(data.email, data.password);
      toast({
        title: 'Login Successful',
        description: `Welcome back to ${APP_NAME}!`,
      });
      setLoginStatus('success');
      const redirectPath = searchParams.get('redirect') || '/dashboard';
      setTimeout(() => {
        router.replace(redirectPath);
      }, 1500); // 1.5 second delay for the animation
    } catch (error: any) {
      console.error("Login failed:", error);
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid email or password. Please try again.',
        variant: 'destructive',
      });
      setLoginStatus('idle'); // Reset to idle on error
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // This case should be handled by the useEffect above, but as a fallback:
  if (loginStatus !== 'success' && currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
        <p className="text-muted-foreground">Already logged in. Redirecting...</p>
      </div>
    );
  }

  if (loginStatus === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
        <Card className="w-full max-w-md shadow-xl rounded-xl border">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto bg-green-100 dark:bg-green-900/30 p-3 rounded-full w-fit">
              <CheckCircle2 className="h-10 w-10 text-green-500 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold">Login Successful!</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4 py-6">
            <p className="text-muted-foreground">Preparing your dashboard...</p>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </CardContent>
        </Card>
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
                    <FormLabel htmlFor="email">Email</FormLabel>
                    <FormControl>
                      <Input id="email" type="email" placeholder="you@example.com" {...field} disabled={loginStatus === 'submitting'} />
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
                    <FormLabel htmlFor="password">Password</FormLabel>
                    <FormControl>
                      <Input id="password" type="password" placeholder="••••••••" {...field} disabled={loginStatus === 'submitting'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loginStatus === 'submitting'}>
                {loginStatus === 'submitting' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : 'Login'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
