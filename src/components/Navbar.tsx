import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Wand2, Grid } from 'lucide-react';
import TokenDisplay from './Dashboard/TokenDisplay';

function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <Wand2 className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                LandingAI
              </span>
            </Link>
          </div>
          <div className="flex items-center">
            {user ? (
              <>
                <TokenDisplay compact={true} />
                <div className="ml-3 relative">
                  <div className="flex items-center">
                    {!isHomePage && (
                      <Link to="/dashboard" className="flex items-center text-gray-500 hover:text-gray-700 mx-4">
                        <Grid className="h-4 w-4 mr-1" />
                        Dashboard
                      </Link>
                    )}
                    <Link to="/account" className="text-gray-500 hover:text-gray-700 mx-4">
                      Account
                    </Link>
                    <button
                      onClick={logout}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex space-x-4">
                <Link
                  to="/login"
                  className="text-gray-500 hover:text-gray-700"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="text-blue-600 hover:text-blue-500"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
