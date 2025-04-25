import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, ArrowRight } from 'lucide-react';

function PaymentSuccess() {
  const [countdown, setCountdown] = useState(5);
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSubscription } = useAuth();
  const searchParams = new URLSearchParams(location.search);
  const paymentType = searchParams.get('type') || 'one-time';
  
  useEffect(() => {
    // Refresh the user's subscription data to get the updated token balance
    const updateUserData = async () => {
      try {
        await refreshSubscription();
      } catch (error) {
        console.error('Error refreshing subscription data:', error);
      }
    };
    
    updateUserData();
  }, [refreshSubscription]);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/account');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [navigate]);
  
  const getTitle = () => {
    return paymentType === 'subscription'
      ? 'Subscription Activated!'
      : 'Payment Successful!';
  };
  
  const getMessage = () => {
    return paymentType === 'subscription'
      ? 'Thank you for subscribing! Your premium plan has been activated, and your tokens have been added to your account.'
      : 'Thank you for your purchase. Your tokens have been added to your account.';
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          
          <h2 className="mt-6 text-2xl font-extrabold text-gray-900">{getTitle()}</h2>
          <p className="mt-2 text-gray-600">
            {getMessage()}
          </p>
          
          <div className="mt-8">
            <div className="rounded-md bg-blue-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1 md:flex md:justify-between">
                  <p className="text-sm text-blue-700">
                    {paymentType === 'subscription' 
                      ? 'Your subscription will automatically renew each month.' 
                      : 'You can purchase additional tokens at any time.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <p className="text-sm text-gray-500">
              Redirecting to your account in {countdown} seconds...
            </p>
            
            <button
              onClick={() => navigate('/account')}
              className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go to My Account <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccess; 
