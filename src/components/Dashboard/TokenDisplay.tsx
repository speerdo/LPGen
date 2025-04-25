import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PLANS, TOKEN_COSTS } from '../../services/stripe';
import { Info, AlertCircle, Coins } from 'lucide-react';

interface TokenDisplayProps {
  compact?: boolean;
}

const TokenDisplay: React.FC<TokenDisplayProps> = ({ compact = false }) => {
  const { userSubscription } = useAuth();
  const [showTokenInfo, setShowTokenInfo] = useState(false);
  
  // Get the user's plan
  const planType = userSubscription?.plan_type || 'free';
  const planDetails = planType === 'premium' ? PLANS.PREMIUM : PLANS.FREE;
  
  if (!userSubscription) {
    return null; // Don't show anything if subscription data isn't loaded
  }
  
  const { token_balance, tokens_used } = userSubscription;
  
  // Calculate how many landing pages they can create with current balance
  const fullPagesRemaining = Math.floor(token_balance / TOKEN_COSTS.INITIAL_LANDING_PAGE);
  const editOperationsRemaining = Math.floor(token_balance / TOKEN_COSTS.CONTENT_UPDATE);
  
  // Compact version for navbar
  if (compact) {
    return (
      <div className="relative">
        <button 
          className="flex items-center mx-2 text-gray-500 hover:text-gray-700"
          onClick={() => setShowTokenInfo(!showTokenInfo)}
        >
          <Coins className="h-4 w-4 mr-1" />
          <span className="text-sm font-medium">{token_balance}</span>
        </button>
        
        {/* Token info popup */}
        {showTokenInfo && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-50 border border-gray-200 p-3">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-semibold">Token Balance</h4>
              <span className="text-sm font-medium">{token_balance}</span>
            </div>
            <div className="text-xs text-gray-500 mb-2">
              {fullPagesRemaining > 0 
                ? `~${fullPagesRemaining} landing page${fullPagesRemaining !== 1 ? 's' : ''} or ${editOperationsRemaining} edits remaining` 
                : 'Purchase more tokens to continue'}
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-700">Plan:</span>
              <span className="font-medium capitalize">{planType}</span>
            </div>
            <div className="flex justify-between text-xs mb-3">
              <span className="text-gray-700">Used:</span>
              <span>{tokens_used} tokens</span>
            </div>
            <div className="border-t border-gray-100 pt-2 pb-1">
              <h5 className="text-xs font-medium mb-1">Token Costs:</h5>
              <ul className="text-xs space-y-1 text-gray-700">
                <li className="flex justify-between">
                  <span>New page:</span>
                  <span>{TOKEN_COSTS.INITIAL_LANDING_PAGE}</span>
                </li>
                <li className="flex justify-between">
                  <span>Refinement:</span>
                  <span>{TOKEN_COSTS.LANDING_PAGE_REFINEMENT}</span>
                </li>
                <li className="flex justify-between">
                  <span>Content update:</span>
                  <span>{TOKEN_COSTS.CONTENT_UPDATE}</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Regular detailed version for dashboard
  return (
    <div className="relative">
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm font-medium text-gray-700">
              Available Tokens
            </div>
            <div className="flex items-center space-x-1">
              <div className="text-2xl font-semibold text-gray-900">{token_balance}</div>
              <button 
                onClick={() => setShowTokenInfo(!showTokenInfo)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <Info size={14} className="text-gray-500" />
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {fullPagesRemaining > 0 
                ? `~${fullPagesRemaining} landing page${fullPagesRemaining !== 1 ? 's' : ''} or ${editOperationsRemaining} edits` 
                : 'Purchase more tokens to continue'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-700">
              Plan
            </div>
            <div className="text-md font-medium text-gray-900 capitalize">
              {planType}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {tokens_used} tokens used
            </div>
          </div>
        </div>
        
        {token_balance < TOKEN_COSTS.INITIAL_LANDING_PAGE && (
          <div className="mt-2 text-xs flex items-center text-amber-700 bg-amber-50 p-2 rounded">
            <AlertCircle size={14} className="mr-1 flex-shrink-0" />
            <span>Low token balance. Consider upgrading your plan.</span>
          </div>
        )}
      </div>
      
      {/* Token info popup */}
      {showTokenInfo && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-50 border border-gray-200 p-3">
          <h4 className="text-sm font-semibold mb-2">Token Costs</h4>
          <ul className="text-xs space-y-1 text-gray-700">
            <li className="flex justify-between">
              <span>New landing page:</span>
              <span className="font-medium">{TOKEN_COSTS.INITIAL_LANDING_PAGE} tokens</span>
            </li>
            <li className="flex justify-between">
              <span>Page refinement:</span>
              <span className="font-medium">{TOKEN_COSTS.LANDING_PAGE_REFINEMENT} tokens</span>
            </li>
            <li className="flex justify-between">
              <span>Content update:</span>
              <span className="font-medium">{TOKEN_COSTS.CONTENT_UPDATE} tokens</span>
            </li>
            <li className="flex justify-between">
              <span>Section generation:</span>
              <span className="font-medium">{TOKEN_COSTS.SECTION_GENERATION} tokens</span>
            </li>
          </ul>
          <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
            Your plan includes {planDetails.monthlyTokens} tokens per month.
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenDisplay; 
