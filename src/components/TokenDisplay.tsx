import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const TokenDisplay = () => {
  const { userSubscription } = useAuth();
  const [loading, setLoading] = useState(true);

  // Only update loading state when subscription changes, but don't trigger refreshes
  useEffect(() => {
    if (userSubscription) {
      setLoading(false);
      console.log('TokenDisplay - subscription data available:', userSubscription);
    }
  }, [userSubscription]);

  if (loading) {
    return <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>;
  }

  if (!userSubscription) {
    return null;
  }

  return (
    <Link to="/account" className="flex items-center p-2 rounded-md bg-blue-50 hover:bg-blue-100">
      <div className="mr-2">
        <span className="text-xs text-gray-500">Tokens</span>
        <div className="font-medium">{userSubscription.token_balance}</div>
      </div>
      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 011-1h4a1 1 0 010 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    </Link>
  );
};

export default TokenDisplay; 
