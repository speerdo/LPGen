import { Link } from 'react-router-dom';
import { Wand2, Upload, Download, Repeat, Layout } from 'lucide-react';
import Navbar from '../components/Navbar';

function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Navbar />
      
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Transform Your Content into Beautiful Landing Pages
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Upload your content or provide a website link, and our AI will generate
            a professional, conversion-optimized landing page in seconds.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Get Started <Wand2 className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-50 rounded-lg text-center">
              <Upload className="h-10 w-10 text-indigo-600 mb-4 mx-auto" />
              <h3 className="text-xl font-semibold mb-2">Easy Start</h3>
              <p className="text-gray-600">
                Simply provide your brand URL to get started
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-lg text-center">
              <Layout className="h-10 w-10 text-indigo-600 mb-4 mx-auto" />
              <h3 className="text-xl font-semibold mb-2">AI-Powered Design</h3>
              <p className="text-gray-600">
                Our AI analyzes your content and creates a professionally designed landing page
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-lg text-center">
              <Download className="h-10 w-10 text-indigo-600 mb-4 mx-auto" />
              <h3 className="text-xl font-semibold mb-2">Instant Download</h3>
              <p className="text-gray-600">
                Download your landing page in HTML format, ready to deploy
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-indigo-100 rounded-full p-4 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Upload className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="font-semibold mb-2">Upload Content</h3>
              <p className="text-gray-600">Provide your brand URL</p>
            </div>
            <div className="text-center">
              <div className="bg-indigo-100 rounded-full p-4 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Wand2 className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="font-semibold mb-2">AI Processing</h3>
              <p className="text-gray-600">Our AI analyzes and designs</p>
            </div>
            <div className="text-center">
              <div className="bg-indigo-100 rounded-full p-4 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Repeat className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="font-semibold mb-2">Refine</h3>
              <p className="text-gray-600">Make adjustments if needed</p>
            </div>
            <div className="text-center">
              <div className="bg-indigo-100 rounded-full p-4 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Download className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="font-semibold mb-2">Download</h3>
              <p className="text-gray-600">Get your landing page</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer Section */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <Link to="/" className="flex items-center">
              <Wand2 className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-bold text-white">
                LandingAI
              </span>
            </Link>
            <div className="mt-4 md:mt-0">
              <ul className="flex space-x-6">
                <li>
                  <a href="/support" className="hover:underline">Support</a>
                </li>
                <li>
                  <a href="/terms" className="hover:underline">Terms of Service</a>
                </li>
                <li>
                  <a href="/privacy" className="hover:underline">Privacy Policy</a>
                </li>
                <li>
                  <a href="/contact" className="hover:underline">Contact Us</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-4 text-center text-sm text-gray-400">
            © {new Date().getFullYear()} LandingAI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
