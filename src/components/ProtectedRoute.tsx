import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, userSubscription, refreshSubscription, initializing } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const ensureSubscriptionLoaded = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        // If we already have a subscription, no need to refresh
        if (userSubscription) {
          console.log("ProtectedRoute - subscription already loaded:", userSubscription);
          setIsLoading(false);
          return;
        }
        
        // Otherwise make sure we have subscription data
        console.log("ProtectedRoute - ensuring subscription is loaded");
        await refreshSubscription();
        console.log("ProtectedRoute - subscription refreshed");
      } catch (error) {
        console.error("Error ensuring subscription is loaded:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Don't run this until initializing is complete
    if (!initializing) {
      ensureSubscriptionLoaded();
    }
  }, [user, userSubscription, refreshSubscription, initializing]);

  // If initialization is still happening, show nothing
  if (initializing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // If not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" />;
  }

  // If still loading subscription data, show a loading indicator
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-700">Loading subscription data...</span>
      </div>
    );
  }

  // User is logged in and we have (or tried to get) subscription data
  return <>{children}</>;
}

export default ProtectedRoute;
