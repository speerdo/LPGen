# LP Gen - AI Landing Page Generator

An AI-powered tool for generating professional landing pages.

## Token System

LP Gen uses a token-based system for generating landing pages:

- **Free Users**: 
  - 100 tokens every month (reset on the 1st of each month)
  - Approximately enough for 1 landing page
  - No rollovers - unused tokens don't accumulate

- **Premium Users**:
  - 1000 tokens every month (reset on the 1st of each month)
  - Approximately enough for 10 landing pages
  - No rollovers - unused tokens don't accumulate

- **Additional Tokens**:
  - Users can purchase additional token packs:
    - Small: 100 tokens
    - Large: 500 tokens

## Development

1. Install dependencies:
   ```
   npm install
   ```

2. Set up environment variables:
   ```
   cp .env.example .env.local
   ```
   Fill in the required values in `.env.local`.

3. Start the development server:
   ```
   npm run dev
   ```

## Supabase Functions

This project uses Supabase Edge Functions for handling:

- Stripe integration (subscriptions, payments)
- Token management
- Scheduled tasks

For deployment instructions, see `/supabase/functions/.deployment/README.md`.

## Technologies

- React
- TypeScript
- Tailwind CSS
- Supabase
- Stripe
- OpenAI 
