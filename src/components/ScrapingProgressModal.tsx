import React from 'react';
import { Loader2 } from 'lucide-react';

interface ScrapingProgressModalProps {
  isOpen: boolean;
  message?: string;
}

const ScrapingProgressModal: React.FC<ScrapingProgressModalProps> = ({ isOpen, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black opacity-50"></div>
      {/* Modal content */}
      <div className="relative bg-white rounded-lg shadow-lg z-10 p-6 max-w-md mx-auto transform transition-all duration-300 scale-100">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 text-indigo-600 animate-spin" />
          <h2 className="mt-4 text-xl font-semibold text-gray-800">Gathering Assets</h2>
          <p className="mt-2 text-gray-600 text-center">
            {message 
              ? message 
              : "Scraping website data, gathering assets, and preparing your landing page. Please wait..."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScrapingProgressModal; 
