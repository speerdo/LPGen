import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { createPortalSession } from '../services/stripe';
import { PLANS, TOKENS_PER_LANDING_PAGE } from '../services/tokens';

function Account() {
  const { user, userSubscription } = useAuth();
  const navigate = useNavigate();
  const [processingPayment, setProcessingPayment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Just check if user is logged in and use existing subscription from context
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // No need to refresh, just update loading state when subscription is available
    if (userSubscription) {
      console.log(
        'Account page - using subscription from context:',
        userSubscription
      );
      setIsLoading(false);
    }
  }, [user, navigate, userSubscription]);

  const handleSubscribe = () => {
    navigate(`/checkout?item=premium`);
  };

  const handleOneTimePayment = (priceId: string) => {
    const packType =
      priceId === PLANS.TOKEN_PACK_SMALL.stripePriceId
        ? 'small-token-pack'
        : 'large-token-pack';

    navigate(`/checkout?item=${packType}`);
  };

  const handleManageSubscription = async () => {
    if (!userSubscription?.stripe_customer_id) return;

    try {
      setProcessingPayment(true);
      const portalUrl = await createPortalSession(
        userSubscription.stripe_customer_id
      );
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Failed to open portal:', error);
      alert('Failed to open subscription portal. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const getTokenUsage = () => {
    if (!userSubscription) return '0%';
    const totalMonthlyTokens =
      userSubscription.plan_type === 'premium'
        ? PLANS.PREMIUM.monthlyTokens
        : PLANS.FREE.monthlyTokens;
    const used = userSubscription.tokens_used;
    const percentage = Math.min(
      100,
      Math.round((used / totalMonthlyTokens) * 100)
    );
    return `${percentage}%`;
  };

  const getLandingPagesRemaining = () => {
    if (!userSubscription) return 0;
    return Math.floor(userSubscription.token_balance / TOKENS_PER_LANDING_PAGE);
  };

  return (
    <div className='min-h-screen bg-gray-50'>
      <Navbar />
      <div className='max-w-7xl mx-auto py-10 sm:px-6 lg:px-8'>
        <div className='bg-white shadow overflow-hidden sm:rounded-lg'>
          <div className='px-4 py-5 border-b border-gray-200 sm:px-6'>
            <h3 className='text-lg leading-6 font-medium text-gray-900'>
              Account Details
            </h3>
            <p className='mt-1 max-w-2xl text-sm text-gray-500'>
              Manage your subscription and tokens.
            </p>
          </div>

          {isLoading ? (
            <div className='p-6 text-center'>
              Loading subscription details...
            </div>
          ) : (
            <div className='px-4 py-5 sm:p-6'>
              {/* Token Balance */}
              <div className='mb-8 p-6 bg-gray-50 rounded-lg'>
                <div className='flex justify-between items-center mb-4'>
                  <h4 className='text-lg font-medium'>Your Token Balance</h4>
                  <span className='text-2xl font-bold'>
                    {userSubscription?.token_balance || 0}
                  </span>
                </div>

                <div className='w-full bg-gray-200 rounded-full h-2.5 mb-2'>
                  <div
                    className='bg-blue-600 h-2.5 rounded-full'
                    style={{ width: getTokenUsage() }}
                  ></div>
                </div>

                <div className='flex justify-between text-sm text-gray-500'>
                  <span>0 tokens</span>
                  <span>
                    {userSubscription?.plan_type === 'premium'
                      ? PLANS.PREMIUM.monthlyTokens
                      : PLANS.FREE.monthlyTokens}{' '}
                    tokens
                  </span>
                </div>

                <div className='mt-4 text-sm'>
                  <p>
                    You can create approximately{' '}
                    <span className='font-bold'>
                      {getLandingPagesRemaining()}
                    </span>{' '}
                    more landing pages with your current balance.
                  </p>
                  <p className='mt-1'>
                    Next token reset:{' '}
                    <span className='font-medium'>
                      {userSubscription?.next_reset_date
                        ? new Date(
                            userSubscription.next_reset_date
                          ).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Current Plan */}
              <div className='mb-8'>
                <h4 className='text-lg font-medium mb-4'>Current Plan</h4>
                <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
                  <div className='flex justify-between items-center'>
                    <div>
                      <span className='text-lg font-medium'>
                        {userSubscription?.plan_type === 'premium'
                          ? 'Premium Plan'
                          : 'Free Plan'}
                      </span>
                      <p className='text-sm text-gray-600 mt-1'>
                        {userSubscription?.plan_type === 'premium'
                          ? `${PLANS.PREMIUM.monthlyTokens} tokens per month`
                          : `${PLANS.FREE.monthlyTokens} tokens per month`}
                      </p>
                    </div>

                    {userSubscription?.stripe_subscription_id ? (
                      <button
                        onClick={handleManageSubscription}
                        disabled={processingPayment}
                        className='bg-white border border-blue-500 text-blue-500 px-4 py-2 rounded-md hover:bg-blue-50'
                      >
                        Manage Subscription
                      </button>
                    ) : userSubscription?.plan_type !== 'premium' ? (
                      <button
                        onClick={() => handleSubscribe()}
                        disabled={processingPayment}
                        className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700'
                      >
                        Upgrade to Premium
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Buy More Tokens */}
              <div>
                <h4 className='text-lg font-medium mb-4'>
                  Buy Additional Tokens
                </h4>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  {/* Small Token Pack */}
                  <div className='border rounded-lg p-4 hover:shadow-md transition-shadow'>
                    <h5 className='font-medium mb-2'>
                      {PLANS.TOKEN_PACK_SMALL.name}
                    </h5>
                    <p className='text-gray-600 mb-4'>
                      One-time purchase of {PLANS.TOKEN_PACK_SMALL.tokens}{' '}
                      tokens
                    </p>
                    <div className='flex justify-between items-center'>
                      <span className='text-lg font-bold'>
                        ${PLANS.TOKEN_PACK_SMALL.price}
                      </span>
                      <button
                        onClick={() =>
                          handleOneTimePayment(
                            PLANS.TOKEN_PACK_SMALL.stripePriceId
                          )
                        }
                        disabled={processingPayment}
                        className='bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700'
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>

                  {/* Large Token Pack */}
                  <div className='border rounded-lg p-4 hover:shadow-md transition-shadow'>
                    <h5 className='font-medium mb-2'>
                      {PLANS.TOKEN_PACK_LARGE.name}
                    </h5>
                    <p className='text-gray-600 mb-4'>
                      One-time purchase of {PLANS.TOKEN_PACK_LARGE.tokens}{' '}
                      tokens
                    </p>
                    <div className='flex justify-between items-center'>
                      <span className='text-lg font-bold'>
                        ${PLANS.TOKEN_PACK_LARGE.price}
                      </span>
                      <button
                        onClick={() =>
                          handleOneTimePayment(
                            PLANS.TOKEN_PACK_LARGE.stripePriceId
                          )
                        }
                        disabled={processingPayment}
                        className='bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700'
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Account;
