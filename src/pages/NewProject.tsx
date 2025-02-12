import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Globe,
  Settings,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { createProject, createVersion, updateProject } from '../lib/supabase';
import { generateLandingPage } from '../lib/ai';
import { scrapeWebsite } from '../lib/scraper';
import { uploadLogo } from '../lib/storage/uploadLogo';
import ScrapingProgressModal from '../components/ScrapingProgressModal';
import AIGenerationProgressModal from '../components/AIGenerationProgressModal';
import type { Project, ProjectSettings, WebsiteStyle } from '../types/database';

type Step = 'url' | 'settings';

function NewProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('url');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [logo, setLogo] = useState<string | null>(null);

  // Form state
  const [projectName, setProjectName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [brand, setBrand] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [extractedAssets, setExtractedAssets] = useState<WebsiteStyle | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [selectedFont, setSelectedFont] = useState('');
  const [customFont, setCustomFont] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (extractedAssets?.logo) {
      setLogo(extractedAssets.logo);
    }
  }, [extractedAssets]);

  const steps = [
    { id: 'url' as const, title: 'Website URL', icon: <Globe className="h-6 w-6" /> },
    { id: 'settings' as const, title: 'Settings', icon: <Settings className="h-6 w-6" /> },
  ];

  const validateForm = () => {
    if (!user) {
      setError('Please log in to continue');
      return false;
    }

    if (currentStep === 'url') {
      if (!projectName.trim()) {
        setError('Please enter a project name');
        return false;
      }
      if (!websiteUrl.trim()) {
        setError('Please enter a website URL');
        return false;
      }
      try {
        new URL(websiteUrl);
      } catch {
        setError('Please enter a valid website URL');
        return false;
      }
    }

    return true;
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setIsScraping(true);

    try {
      // Check for required environment variables
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        throw new Error('Please click the "Connect to Supabase" button in the top right to set up your database connection.');
      }

      if (!import.meta.env.VITE_SCRAPINGBEE_API_KEY || !import.meta.env.VITE_OPENAI_API_KEY) {
        throw new Error('Please click the "Connect to Supabase" button in the top right to set up your environment variables.');
      }

      // Create the project first
      const project = await createProject({
        user_id: user!.id,
        name: projectName.trim(),
        website_url: websiteUrl.trim(),
        settings: {},
        status: 'draft'
      });

      setCurrentProject(project);

      // Scrape website with project ID for asset storage
      console.log('Scraping website...');
      const scrapedAssets = await scrapeWebsite(websiteUrl.trim(), project.id, brand.trim());
      console.log('Full scraped assets:', scrapedAssets);
      if (scrapedAssets.colors?.length) {
        console.log("Using pre-formatted colors:", scrapedAssets.colors);
        // Set default dominant color to the first screenshot color if none is selected.
        if (!selectedColor) {
          setSelectedColor(scrapedAssets.colors[0]);
          console.log("Set default dominant color to:", scrapedAssets.colors[0]);
        }
      } else {
        console.log("No colors found in scraped assets");
      }
      setExtractedAssets(scrapedAssets);

      // Create initial version with empty content
      await createVersion({
        project_id: project.id,
        version_number: 1,
        created_by: user!.id,
        is_current: true,
        html_content: '',
        marketing_content: ''
      });

      setCurrentStep('settings');
    } catch (err) {
      console.error('Error in handleUrlSubmit:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to extract website assets. Please try again.');
      }
    } finally {
      setIsLoading(false);
      setIsScraping(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (!currentProject) {
      setError('Project not initialized');
      return;
    }

    setError(null);
    setIsLoading(true);
    setIsGenerating(true);

    try {
      console.log('Starting final submission...');

      // Merge the extracted assets with the user's selected dominant color and primary font.
      const finalStyle: WebsiteStyle = {
        ...extractedAssets,
        dominantColor: selectedColor === 'custom' ? customColor : selectedColor,
        primaryFont: selectedFont === 'custom' ? customFont : selectedFont,
        logo: logo || extractedAssets?.logo,
      };

      const settings: ProjectSettings = {
        // Assume lorem ipsum is always used.
        use_lorem_ipsum: true,
        extracted_styles: finalStyle,
        deployment: {
          platform: 'custom',
          settings: {},
        },
      };

      // Update project settings
      console.log('Updating project settings...');
      await updateProject(currentProject.id, { settings });

      // Generate landing page content using AI
      console.log('Generating landing page content...');
      const prompt = `Create a landing page that uses lorem ipsum placeholder text for all marketing content.
Additional instructions:
${additionalInstructions.trim()}`;

      const result = await generateLandingPage(
        prompt, 
        finalStyle,
        extractedAssets?.screenshot
      );

      if (result.error) {
        throw new Error(result.error);
      }

      // Create a new version with the generated content
      console.log('Creating new version...');
      await createVersion({
        project_id: currentProject.id,
        version_number: 2,
        html_content: result.html,
        marketing_content: '',
        prompt_instructions: additionalInstructions.trim(),
        created_by: user!.id,
        is_current: true,
      });

      navigate(`/project/${currentProject.id}`);
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create project. Please try again.');
      }
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        if (!currentProject) {
          throw new Error('Project not initialized');
        }
        // Use the new uploadLogo function to upload the logo file.
        const uploadedUrl = await uploadLogo(file, currentProject.id);
        setLogo(uploadedUrl);
      } catch (err) {
        console.error('Error uploading logo:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Steps */}
        <nav aria-label="Progress" className="mb-8">
          <ol className="flex items-center">
            {steps.map((step, index) => (
              <li
                key={step.id}
                className={`relative ${
                  index < steps.length - 1 ? 'pr-8 sm:pr-20' : ''
                }`}
              >
                <div className="flex items-center">
                  <div
                    className={`${
                      currentStep === step.id
                        ? 'border-indigo-600 bg-indigo-600'
                        : 'border-gray-300 bg-white'
                    } rounded-full border-2 p-2`}
                  >
                    <div
                      className={
                        currentStep === step.id
                          ? 'text-white'
                          : 'text-gray-500'
                      }
                    >
                      {step.icon}
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="hidden sm:block absolute top-0 right-0 h-full w-5">
                      <div className="h-0.5 relative top-4 bg-gray-300 w-full" />
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <span className="text-sm font-medium text-gray-900">
                    {step.title}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </nav>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-md">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Step 1 Content */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          {currentStep === 'url' && (
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="projectName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Project Name
                </label>
                <input
                  type="text"
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2"
                  placeholder="My Landing Page"
                />
              </div>
              <div>
                <label
                  htmlFor="websiteUrl"
                  className="block text-sm font-medium text-gray-700"
                >
                  Website URL
                </label>
                <input
                  type="text"
                  id="websiteUrl"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2"
                  placeholder="https://example.com"
                />
                <label
                  htmlFor="brand"
                  className="block text-sm font-medium text-gray-700 mt-4"
                >
                  Brand (optional)
                </label>
                <input
                  type="text"
                  id="brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2"
                  placeholder="Your brand name"
                />
                <p className="mt-2 text-sm text-gray-500">
                  We'll extract styles and assets from this URL to match your
                  brand.
                </p>
              </div>
            </div>
          )}

          {currentStep === 'settings' && (
            <div className="space-y-6">
              {/* Extracted Assets */}
              {extractedAssets && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Extracted Assets
                  </h3>
                  <div className="bg-gray-50 rounded-md p-4">
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-gray-500 mb-2">
                        Colors
                      </h4>
                      <div className="flex gap-2">
                        {(extractedAssets.colors || []).map((color) => (
                          <div
                            key={color}
                            className="w-8 h-8 rounded-full border border-gray-200"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-gray-500 mb-2">
                        Fonts
                      </h4>
                      <div className="flex gap-2">
                        {(extractedAssets.fonts || []).map((font) => (
                          <span
                            key={font}
                            className="inline-flex items-center px-2 py-1 rounded-md bg-white text-xs text-gray-700 border border-gray-200"
                          >
                            {font}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-2">
                        Scraped Logo
                      </h4>
                      <div className="flex items-center gap-4">
                        {logo ? (
                          <img src={logo} alt="Logo preview" className="w-24 h-auto border rounded" />
                        ) : (
                          <div className="w-24 h-24 bg-gray-200 flex items-center justify-center rounded">
                            <span className="text-gray-500 text-xs">No logo</span>
                          </div>
                        )}
                        <div className="text-sm text-gray-500">
                          - Or -
                        </div>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Select Dominant Color
                </label>
                <div className="flex gap-2 mt-1">
                  {(extractedAssets?.colors || []).map((color: string) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border ${selectedColor === color ? "ring-2 ring-indigo-500" : "border-gray-200"}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setSelectedColor(color)}
                      title={color}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className={`w-8 h-8 rounded-full border flex items-center justify-center ${selectedColor === 'custom' ? "ring-2 ring-indigo-500" : "border-gray-200"}`}
                  onClick={() => setSelectedColor('custom')}
                  title="Custom"
                >
                  <span className="text-xs">+</span>
                </button>
                {selectedColor === 'custom' && (
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    placeholder="Enter custom HEX color"
                    className="mt-2 block w-full rounded-md border-gray-300 px-3 py-2"
                  />
                )}
              </div>
              <div className="mt-4">
                <label htmlFor="primaryFont" className="block text-sm font-medium text-gray-700">
                  Select Primary Font
                </label>
                {extractedAssets && extractedAssets.fonts && extractedAssets.fonts.length > 0 ? (
                  <>
                    <select
                      id="primaryFont"
                      value={selectedFont}
                      onChange={(e) => setSelectedFont(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2"
                    >
                      {extractedAssets.fonts.map(font => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                      <option value="custom">Custom</option>
                    </select>
                    {selectedFont === 'custom' && (
                      <div className="mt-2">
                        <label htmlFor="customFont" className="block text-sm font-medium text-gray-700">
                          Custom Font
                        </label>
                        <input
                          type="text"
                          id="customFont"
                          value={customFont}
                          onChange={(e) => setCustomFont(e.target.value)}
                          placeholder="Enter custom font"
                          className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <label htmlFor="customFont" className="block text-sm font-medium text-gray-700">
                      Primary Font (Custom)
                    </label>
                    <input
                      type="text"
                      id="customFont"
                      value={customFont}
                      onChange={(e) => setCustomFont(e.target.value)}
                      placeholder="Enter custom font"
                      className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2"
                    />
                  </div>
                )}
              </div>
              {/* Additional Instructions */}
              <div className="mb-4">
                <label htmlFor="additionalInstructions" className="block text-sm font-medium text-gray-700">
                  Additional Instructions
                </label>
                <textarea
                  id="additionalInstructions"
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2"
                  rows={4}
                  placeholder="Enter any extra instructions..."
                ></textarea>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex justify-between">
            {currentStep !== 'url' && (
              <button
                type="button"
                onClick={() => setCurrentStep('url')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                if (currentStep === 'url') {
                  handleUrlSubmit(e);
                } else {
                  handleSubmit();
                }
              }}
              disabled={isLoading}
              className="ml-auto inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              {currentStep === 'settings' ? 'Generate Landing Page' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
      {/* Scraping Progress Modal */}
      <ScrapingProgressModal
        isOpen={isScraping}
        message="Scraping website data, gathering assets, and preparing your landing page. Please wait..."
      />
      {/* AI Generation Progress Modal */}
      <AIGenerationProgressModal
        isOpen={isGenerating}
        message="Our AI is drafting a perfect landing page for your brand. Please wait..."
      />
    </div>
  );
}

export default NewProject;
