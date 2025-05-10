// This file configures the monthly token reset cron job
// It should be placed in the supabase/functions/reset-monthly-tokens directory

// For Supabase Edge Functions with scheduled cron jobs
// Format: cron(minute hour day-of-month month day-of-week year)
// This runs at midnight (00:00) on the 1st day of every month
export const schedule = 'cron(0 0 1 * ? *)';

// Import the handler function from the main index.ts file
import { handler } from './index';

// Export the handler as the default function to be called by the scheduler
export default handler;
