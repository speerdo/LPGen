# Deduct Tokens Edge Function

This Supabase Edge Function securely handles token deduction for user operations. It provides a server-side implementation to prevent client-side tampering with token balances.

## Features

- Securely deducts tokens from a user's balance
- Validates user subscription and token availability
- Records token transactions for audit purposes
- Provides detailed error responses for different scenarios
- Maintains transaction atomicity within the function

## Implementation

The function is implemented as a Node.js Lambda function using the Supabase client:

```javascript
import { createClient } from '@supabase/supabase-js';
import { Database } from '../_shared/database.types';

export const handler = async (event) => {
  // Implementation details...
};
```

## Usage

The function accepts POST requests with the following JSON body:

```json
{
  "userId": "user-uuid",
  "tokenAmount": 10,
  "operation": "LANDING_PAGE_GENERATION"
}
```

### Parameters

- `userId` (required): The user's UUID
- `tokenAmount` (required): Number of tokens to deduct (must be greater than zero)
- `operation` (optional): Description of the operation for transaction logging

### Response

Success response (200 OK):

```json
{
  "success": true,
  "tokensRemaining": 90,
  "tokensDeducted": 10
}
```

Error responses:

- 400 Bad Request: Missing parameters or insufficient tokens
- 404 Not Found: User subscription not found
- 500 Internal Server Error: Database errors or unexpected exceptions

## Environment Variables

The function requires the following environment variables:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (has admin rights)

## Deployment

Use the Supabase CLI to deploy this function:

```bash
supabase functions deploy deduct-tokens
```

Or use the project's deployment script:

```bash
./deploy-edge-functions.sh
```

## Testing

You can test the function using the provided test script:

```bash
node test-edge-function.js <userId> <tokenAmount> <operation>
```
