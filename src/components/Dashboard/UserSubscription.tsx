import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { useToast } from '../ui/use-toast';
import { supabase } from '../../lib/supabase';
import { AlertCircle, BadgeCheck, Coins } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useNavigate } from 'react-router-dom';

/**
 * UserSubscription component displays the user's current subscription plan and token usage.
 * It allows users to upgrade to the premium plan or buy token packs.
 * 
 * Features:
 * - Shows user's current plan (Free or Premium)
 * - Displays token usage with a progress bar
 * - Provides options to upgrade plan or buy more tokens
 * - Shows alerts for low token balance
 */
export function UserSubscription() {
  const { user, userSubscription, refreshSubscription } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Refresh subscription data when component mounts
    const loadSubscription = async () => {
      console.log('UserSubscription component - attempting to refresh subscription data');
      if (user) {
        try {
          await refreshSubscription();
          console.log('UserSubscription component - subscription refreshed:', userSubscription);
        } catch (error) {
          console.error('UserSubscription component - error refreshing subscription:', error);
        }
      } else {
        console.log('UserSubscription component - no user found, cannot refresh subscription');
      }
    };
    
    loadSubscription();
  }, [user, refreshSubscription]);

  // Log whenever the userSubscription changes
  useEffect(() => {
    console.log('UserSubscription component - subscription state updated:', userSubscription);
  }, [userSubscription]);

  /**
   * Creates a Checkout session for the specified price ID
   * @param priceId - The Stripe price ID for the product
   * @param isSubscription - Whether this is a subscription or one-time purchase
   */
  const createCheckoutSession = async (priceId: string, isSubscription: boolean) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to upgrade your plan',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create checkout session via Supabase Edge Function
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            priceId,
            userId: user.id,
            isSubscription,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      toast({
        title: 'Checkout Error',
        description: err instanceof Error ? err.message : 'Failed to start checkout process',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles upgrading to the premium plan
   */
  const handleUpgrade = async () => {
    // Use a placeholder that will be replaced with the actual Premium plan price ID in production
    await createCheckoutSession('PREMIUM_PLAN_PRICE_ID', true);
  };

  /**
   * Handles purchasing a token pack
   * @param size - The size of the token pack ('small' or 'large')
   */
  const handleBuyTokens = async (size: 'small' | 'large') => {
    // Use placeholder price IDs that will be replaced with actual IDs in production
    const priceId = size === 'small' ? 'SMALL_TOKEN_PACK_PRICE_ID' : 'LARGE_TOKEN_PACK_PRICE_ID';
    await createCheckoutSession(priceId, false);
  };

  /**
   * Calculates the percentage of tokens used
   */
  const calculateTokenUsage = () => {
    if (!userSubscription) return 0;
    
    const { token_balance, tokens_used } = userSubscription;
    if (token_balance === 0 && tokens_used === 0) return 0;
    if (token_balance === 0) return 100;
    
    const total = token_balance + tokens_used;
    const used = tokens_used;
    return Math.round((used / total) * 100);
  };

  /**
   * Determines if the token balance is low (less than 20% remaining)
   */
  const isLowBalance = () => {
    if (!userSubscription) return false;
    
    const { token_balance, tokens_used } = userSubscription;
    const total = token_balance + tokens_used;
    if (total === 0) return false;
    return token_balance / total < 0.2;
  };

  // Loading state while waiting for subscription data
  if (!userSubscription) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Your Subscription</CardTitle>
          <CardDescription>Loading subscription details...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          Your Subscription
          {userSubscription.plan_type === 'premium' && (
            <BadgeCheck className="ml-2 h-5 w-5 text-blue-500" />
          )}
        </CardTitle>
        <CardDescription>
          You are currently on the {userSubscription.plan_type === 'premium' ? 'Premium' : 'Free'} plan
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Display low balance warning */}
        {isLowBalance() && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Low Token Balance</AlertTitle>
            <AlertDescription>
              You're running low on tokens. Consider upgrading your plan or purchasing additional tokens.
            </AlertDescription>
          </Alert>
        )}

        {/* Token usage display */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <Coins className="h-4 w-4 mr-2" />
              <span>Tokens Available</span>
            </div>
            <span className="font-semibold">
              {userSubscription.token_balance} tokens
            </span>
          </div>
          <Progress value={calculateTokenUsage()} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Used: {userSubscription.tokens_used} tokens</span>
            <span>Total: {userSubscription.token_balance + userSubscription.tokens_used} tokens</span>
          </div>
        </div>

        {/* Error message display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2">
        {/* Plan upgrade button (only show for free users) */}
        {userSubscription.plan_type !== 'premium' && (
          <Button 
            className="w-full sm:w-auto" 
            onClick={handleUpgrade} 
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Upgrade to Premium'}
          </Button>
        )}
        
        {/* Token purchase buttons */}
        <Button 
          variant="outline" 
          className="w-full sm:w-auto" 
          onClick={() => handleBuyTokens('small')} 
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Buy 100 Tokens'}
        </Button>
        <Button 
          variant="outline" 
          className="w-full sm:w-auto" 
          onClick={() => handleBuyTokens('large')} 
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Buy 500 Tokens'}
        </Button>
      </CardFooter>
    </Card>
  );
} 
