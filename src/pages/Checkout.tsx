import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { createCheckoutSession, createDirectCheckoutSession, PLANS, TOKEN_COSTS } from '../services/stripe';
import { stripePromise } from '../services/stripe';
import { Loader2, CheckCircle, CreditCard, ArrowLeftCircle } from 'lucide-react';

interface CheckoutItem {
  id: string;
  name: string;
  description: string;
  price: number;
  isSubscription: boolean;
  tokens?: number;
  priceId: string;
}

function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<CheckoutItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get the checkout item from the location state or query params
    const searchParams = new URLSearchParams(location.search);
    const itemId = searchParams.get('item');

    if (!itemId) {
      navigate('/account');
      return;
    }

    if (itemId === 'premium') {
      setItem({
        id: 'premium',
        name: PLANS.PREMIUM.name,
        description: `${PLANS.PREMIUM.monthlyTokens} tokens per month`,
        price: PLANS.PREMIUM.price,
        isSubscription: true,
        tokens: PLANS.PREMIUM.monthlyTokens,
        priceId: PLANS.PREMIUM.stripePriceId || '',
      });
    } else if (itemId === 'small-token-pack') {
      setItem({
        id: 'small-token-pack',
        name: PLANS.TOKEN_PACK_SMALL.name,
        description: `${PLANS.TOKEN_PACK_SMALL.tokens} tokens (one-time)`,
        price: PLANS.TOKEN_PACK_SMALL.price,
        isSubscription: false,
        tokens: PLANS.TOKEN_PACK_SMALL.tokens,
        priceId: PLANS.TOKEN_PACK_SMALL.stripePriceId || '',
      });
    } else if (itemId === 'large-token-pack') {
      setItem({
        id: 'large-token-pack',
        name: PLANS.TOKEN_PACK_LARGE.name,
        description: `${PLANS.TOKEN_PACK_LARGE.tokens} tokens (one-time)`,
        price: PLANS.TOKEN_PACK_LARGE.price,
        isSubscription: false,
        tokens: PLANS.TOKEN_PACK_LARGE.tokens,
        priceId: PLANS.TOKEN_PACK_LARGE.stripePriceId || '',
      });
    } else {
      navigate('/account');
    }
  }, [location, navigate]);

  const handleCheckout = async () => {
    if (!user?.id || !item) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // First try using the Supabase function
      try {
        console.log("Attempting checkout via Supabase function...");
        // Create a checkout session
        const sessionId = await createCheckoutSession(item.priceId, user.id, item.isSubscription);
        
        // Redirect to Stripe checkout
        const stripe = await stripePromise;
        if (stripe) {
          await stripe.redirectToCheckout({ sessionId });
        }
        return;
      } catch (supabaseError) {
        console.warn("Supabase function checkout failed, trying direct checkout:", supabaseError);
        // If Supabase function fails, try direct checkout
      }
      
      // If we get here, try the direct client-side checkout as a fallback
      console.log("Attempting direct client-side checkout...");
      const sessionId = await createDirectCheckoutSession(item.priceId, user.id, item.isSubscription);
      
      // Redirect to Stripe checkout
      const stripe = await stripePromise;
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId });
      }
    } catch (error) {
      console.error('Payment error:', error);
      setError('There was a problem initiating checkout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // If no item is selected, redirect back to account
  if (!item) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading checkout details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <button 
            onClick={() => navigate('/account')}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-6"
          >
            <ArrowLeftCircle className="h-5 w-5 mr-2" />
            Back to Account
          </button>
          
          <div className="bg-white shadow overflow-hidden rounded-lg">
            <div className="px-6 py-5 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Checkout</h3>
            </div>
            
            <div className="px-6 py-5">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                <div>
                  <h4 className="font-medium text-gray-900">{item.name}</h4>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
                <span className="text-xl font-bold">${item.price}</span>
              </div>
              
              {item.tokens && (
                <div className="mb-6 bg-blue-50 rounded-md p-4">
                  <div className="flex">
                    <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div className="ml-3">
                      <h5 className="text-sm font-medium text-blue-800">Token Value</h5>
                      <ul className="mt-2 text-sm text-blue-700 space-y-1">
                        <li>• {Math.floor(item.tokens / TOKEN_COSTS.INITIAL_LANDING_PAGE)} new landing pages</li>
                        <li>• {Math.floor(item.tokens / TOKEN_COSTS.LANDING_PAGE_REFINEMENT)} page refinements</li>
                        <li>• {Math.floor(item.tokens / TOKEN_COSTS.CONTENT_UPDATE)} content updates</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <div className="mt-6">
                <button
                  onClick={handleCheckout}
                  disabled={isLoading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-75"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5 mr-2" />
                      Proceed to Payment
                    </>
                  )}
                </button>
              </div>
              
              <div className="mt-4 text-center text-xs text-gray-500">
                <p>You will be redirected to Stripe's secure payment page.</p>
                <p className="mt-1">Your card will be {item.isSubscription ? 'billed monthly' : 'charged once'}.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Checkout; 
