
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
import { useRouter, useSearchParams, } from 'next/navigation';
import { APP_NAME } from '@/lib/constants';
import { LogIn, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/app/(app)/AuthContext';

const loginFormSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  password: z.string().nonempty("Password is required").min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function LoginFormCore() {
  const [loginStatus, setLoginStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [showPassword, setShowPassword] = useState(false);
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
      }, 3000);
    } catch (error: any) {
      console.error("Login failed:", error);
      let description = 'An unexpected error occurred. Please try again.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        description = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.message) {
        description = error.message;
      }
      toast({
        title: 'Login Failed',
        description: description,
        variant: 'destructive',
      });
      setLoginStatus('idle');
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

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
                  <div className="relative">
 <FormControl>
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...field} disabled={loginStatus === 'submitting'} className="pr-10" />
 </FormControl>
 <button type="button" className="absolute inset-y-0 right-0 flex items-center pr-3 focus:outline-none" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </div>
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
