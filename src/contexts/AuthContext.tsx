import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { PLANS } from '../services/tokens';
import { setupTokenSystem } from '../lib/setupDatabase';

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
  const [userSubscription, setUserSubscription] =
    useState<UserSubscription | null>(null);
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
    console.log('Creating fallback subscription for user:', userId);

    // Use the PLANS constant to get the correct monthly token amount
    const monthlyTokens = PLANS.FREE.monthlyTokens;

    // Calculate next reset date (1st of next month)
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const subscription: UserSubscription = {
      id: `temp-${userId}`,
      user_id: userId,
      plan_type: 'free',
      token_balance: monthlyTokens, // Use the value from PLANS instead of hard-coding
      tokens_used: 0,
      next_reset_date: nextMonth.toISOString(),
      stripe_customer_id: null,
      stripe_subscription_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    console.log(
      'Fallback subscription created with token balance:',
      subscription.token_balance
    );
    return subscription;
  };

  /**
   * Helper function to get next reset date (1st of next month)
   */
  const getNextResetDate = () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return nextMonth;
  };

  /**
   * Refreshes the current user's subscription data
   * @param forceRefresh If true, bypasses debounce and always fetches fresh data
   */
  const refreshSubscription = async (forceRefresh = false) => {
    if (!user) {
      console.log('Cannot refresh subscription: No user is logged in');
      return;
    }

    // Check if we've refreshed recently to prevent too many API calls
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

    if (
      !forceRefresh &&
      timeSinceLastRefresh < REFRESH_DEBOUNCE_TIME &&
      userSubscription
    ) {
      console.log(
        `Skipping refresh - last refresh was ${timeSinceLastRefresh}ms ago, using cached subscription`
      );
      return;
    }

    // Update the refresh timestamp
    lastRefreshTimeRef.current = now;
    console.log('Refreshing subscription for user:', user.id);

    try {
      // First, try a direct health check on the Edge Function
      try {
        console.log('Testing token system Edge Function availability');
        const { data: checkData, error: checkError } =
          await supabase.functions.invoke('deduct-tokens', {
            body: {
              userId: user.id,
              checkOnly: true,
            },
          });

        if (!checkError && checkData?.status === 'ok') {
          console.log('Token system Edge Function is available and healthy');
        } else if (checkError) {
          console.warn('Edge Function check failed with error:', checkError);
        }
      } catch (edgeFunctionError) {
        console.warn('Edge Function check failed:', edgeFunctionError);
        // Continue anyway - this is just diagnostic
      }

      // Get the actual subscription with fresh query
      const { data: directData, error: directError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // If we have direct data from DB, use it immediately
      if (!directError && directData) {
        console.log('Got fresh subscription data directly:', {
          id: directData.id,
          user_id: directData.user_id,
          token_balance: directData.token_balance,
          plan_type: directData.plan_type,
        });
        setUserSubscription(directData as UserSubscription);
        return;
      } else if (directError) {
        console.warn('Direct subscription query failed:', directError);
      } else {
        console.log('No subscription found in database');
      }

      // Fallback to the regular fetch method if direct query failed
      console.log('Direct query unsuccessful, using regular fetch method');
      const subscription = await fetchUserSubscription(user.id);

      // Log the subscription we're setting in state
      console.log('Setting user subscription in state:', {
        id: subscription.id,
        token_balance: subscription.token_balance,
        plan_type: subscription.plan_type,
      });

      setUserSubscription(subscription);

      // For any suspicious or fallback subscriptions, immediately try to persist them
      if (subscription.id.startsWith('temp-')) {
        console.log(
          'Detected fallback subscription, attempting to persist to database'
        );
        try {
          // Check if a real subscription exists first
          const { data: existingData } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (existingData) {
            console.log(
              'Real subscription exists, using it instead of fallback'
            );
            setUserSubscription(existingData as UserSubscription);
          } else {
            // Try to create a real subscription
            const { data: newData, error: createError } = await supabase
              .from('user_subscriptions')
              .insert({
                user_id: user.id,
                plan_type: subscription.plan_type,
                token_balance: subscription.token_balance,
                tokens_used: subscription.tokens_used || 0,
                next_reset_date:
                  subscription.next_reset_date ||
                  getNextResetDate().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (createError) {
              console.error('Failed to create real subscription:', createError);
            } else if (newData) {
              console.log('Created new subscription in database:', newData.id);
              setUserSubscription(newData as UserSubscription);
            }
          }
        } catch (error) {
          console.error('Error persisting subscription:', error);
        }
      }
    } catch (refreshError) {
      console.error('Failed to refresh subscription:', refreshError);
    }
  };

  /**
   * Initializes auth state by checking for existing session
   */
  useEffect(() => {
    const initializeAuth = async () => {
      // Initialize token system - run setup checks
      try {
        await setupTokenSystem();
      } catch (setupError) {
        console.warn('Token system setup check failed:', setupError);
        // Continue anyway - this is just diagnostic
      }

      // Expose refreshSubscription method to window for global access
      // This allows other parts of the app to trigger subscription refresh
      interface WindowWithRefresh extends Window {
        __refreshUserSubscription?: () => Promise<void>;
      }
      (window as WindowWithRefresh).__refreshUserSubscription =
        refreshSubscription;

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
