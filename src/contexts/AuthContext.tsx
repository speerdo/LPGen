import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Define types for the subscription data
export interface UserSubscription {
  id: string;
  user_id: string;
  plan_type: 'free' | 'premium';
  token_balance: number;
  tokens_used: number;
  next_reset_date: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

// Define the shape of our auth context
interface AuthContextType {
  user: User | null;
  session: Session | null;
  userSubscription: UserSubscription | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  signup: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  userSubscription: null,
  initializing: true,
  login: async () => ({ error: null }),
  signup: async () => ({ error: null }),
  logout: async () => {},
  refreshSubscription: async () => {},
});

/**
 * AuthProvider component manages authentication state and user subscription data
 * It provides login, signup, logout functionality and subscription management
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [initializing, setInitializing] = useState(true);
  
  // Track last refresh time to prevent excessive refetching
  const lastRefreshTimeRef = useRef<number>(0);
  // Debounce time in milliseconds
  const REFRESH_DEBOUNCE_TIME = 5000; // 5 seconds

  /**
   * Fetches user subscription from the database
   * @param userId User ID to fetch subscription for
   */
  const fetchUserSubscription = async (userId: string) => {
    try {
      // Always try to get a subscription from the database first
      console.log('Fetching user subscription for:', userId);
      
      // Use maybeSingle() to prevent 406 errors when no row is found
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.log('Error fetching subscription:', error.message);
        // Any error (including "table does not exist") should fall back to the default subscription
        console.log('Using fallback subscription due to error');
        return createFallbackSubscription(userId);
      }

      // If we got data back from the database, use it
      if (data) {
        console.log('Found subscription in database:', data);
        return data as UserSubscription;
      }
      
      // If no data was returned (no error but null data), use fallback
      console.log('No subscription found in database, using fallback');
      return createFallbackSubscription(userId);
    } catch (error) {
      console.error('Exception in fetchUserSubscription:', error);
      console.log('Using fallback subscription after exception');
      return createFallbackSubscription(userId);
    }
  };

  /**
   * Creates a fallback subscription object when the database isn't available
   */
  const createFallbackSubscription = (userId: string): UserSubscription => {
    console.log('Creating fallback subscription with 100 tokens for user:', userId);
    const subscription: UserSubscription = {
      id: `temp-${userId}`,
      user_id: userId,
      plan_type: 'free',
      token_balance: 100, // Hard-coded value to ensure it's always set
      tokens_used: 0,
      next_reset_date: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    console.log('Fallback subscription created:', subscription);
    return subscription;
  };

  /**
   * Refreshes the current user's subscription data
   */
  const refreshSubscription = async () => {
    if (!user) {
      console.log('Cannot refresh subscription: No user is logged in');
      return;
    }

    // Check if we've refreshed recently to prevent too many API calls
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
    
    if (timeSinceLastRefresh < REFRESH_DEBOUNCE_TIME && userSubscription) {
      console.log(`Skipping refresh - last refresh was ${timeSinceLastRefresh}ms ago, using cached subscription`);
      return;
    }
    
    // Update the refresh timestamp
    lastRefreshTimeRef.current = now;
    console.log('Refreshing subscription for user:', user.id);
    
    try {
      const subscription = await fetchUserSubscription(user.id);
      
      // Log the subscription we're setting in state
      console.log('Setting user subscription in state:', subscription);
      setUserSubscription(subscription);
    } catch (error) {
      console.error('Error refreshing subscription:', error);
      
      // Provide a fallback subscription to ensure UI works
      console.log('Creating fallback subscription after error');
      const fallbackSub = createFallbackSubscription(user.id);
      console.log('Setting fallback subscription in state:', fallbackSub);
      setUserSubscription(fallbackSub);

      // After creating the fallback subscription
      try {
        // Try to insert the fallback subscription into the database
        // Note: This may fail if another process already created it
        const { error } = await supabase
          .from('user_subscriptions')
          .insert([fallbackSub])
          .select()
          .maybeSingle();
        
        if (error) {
          console.error('Failed to persist fallback subscription:', error);
          // Check if the error is due to a unique violation (subscription already exists)
          if (error.message?.includes('duplicate key value') || error.message?.includes('unique constraint')) {
            console.log('Fallback subscription not persisted - likely already exists');
          }
        } else {
          console.log('Fallback subscription persisted to database');
        }
      } catch (err) {
        console.error('Error persisting fallback subscription:', err);
      }
    }
  };

  /**
   * Initializes auth state by checking for existing session
   */
  useEffect(() => {
    const initializeAuth = async () => {
      // Get initial session
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user || null);

      // Fetch user subscription if user exists - do this after setting the user
      if (data.session?.user) {
        // We don't need to await this - it can happen in the background
        refreshSubscription();
      }

      // Subscribe to auth changes
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state change event:', event);
          
          // First update the user state - this is the core authentication part
          setSession(session);
          setUser(session?.user || null);

          // Handle user sign-in - subscription refresh is secondary and can happen in background
          if (event === 'SIGNED_IN' && session?.user) {
            // Don't await - run in background
            refreshSubscription();
          }

          // Handle user sign-out
          if (event === 'SIGNED_OUT') {
            setUserSubscription(null);
          }
        }
      );

      setInitializing(false);

      // Clean up subscription
      return () => {
        authListener.subscription.unsubscribe();
      };
    };

    initializeAuth();
  }, []);

  /**
   * Log in with email and password
   */
  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting login for:', email);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        return { error };
      }

      // Authentication successful - subscription handling happens in the auth state change handler
      return { error: null };
    } catch (error) {
      console.error('Exception during login:', error);
      return { error: error as Error };
    }
  };

  /**
   * Sign up with email and password
   */
  const signup = async (email: string, password: string) => {
    try {
      console.log('Attempting signup for:', email);
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error('Signup error:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Exception during signup:', error);
      return { error: error as Error };
    }
  };

  /**
   * Log out the current user
   */
  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userSubscription,
        initializing,
        login,
        signup,
        logout,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context in components
 */
export function useAuth() {
  return useContext(AuthContext);
} 
