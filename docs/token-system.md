# LPGen Token System Documentation

## Overview

The LPGen platform uses a token-based system to manage and track usage of various operations. Tokens are consumed when performing different actions like generating landing pages, taking screenshots, and updating content.

## Token Costs

Different operations have different token costs:

| Operation                 | Token Cost | Description                                        |
| ------------------------- | ---------- | -------------------------------------------------- |
| `INITIAL_LANDING_PAGE`    | 100        | Initial scraping and generation of a landing page  |
| `LANDING_PAGE_REFINEMENT` | 30         | Refinements that don't require new scraping        |
| `CONTENT_UPDATE`          | 15         | Simple text edits                                  |
| `SECTION_GENERATION`      | 25         | Generating specific sections                       |
| `EXTERNAL_SERVICE`        | 10         | Using external services (e.g., taking screenshots) |

## Subscription Plans

| Plan    | Monthly Tokens | Cost         |
| ------- | -------------- | ------------ |
| Free    | 100            | $0           |
| Premium | 1,000          | $19.99/month |

Additional token packs:

- 100 Extra Tokens: $4.99
- 500 Extra Tokens: $19.99

## Token Management Architecture

### Client-Side Components

1. **stripe.ts**: Contains functions for managing tokens, checking balances, and interacting with the token system.
2. **TokenDisplay**: Component that shows the user's current token balance and plan information.
3. **Project Editors**: Consume tokens for various operations.

### Server-Side Components

1. **deduct-tokens Edge Function**: Secure server-side implementation for deducting tokens.
2. **token_transactions Table**: Records all token transactions for auditing.
3. **user_subscriptions Table**: Stores user token balances and subscription information.

## How Token Deduction Works

1. When an operation is performed, the application calls `deductTokens(userId, tokenAmount, operation)`.
2. The function attempts to invoke the secure Edge Function to handle the deduction.
3. If the Edge Function isn't available, a fallback client-side implementation is used.
4. The operation only proceeds if the user has sufficient tokens.
5. All token transactions are recorded for transparency and auditing.

## Debugging Token Issues

If users experience token-related issues:

1. Check the console logs for error messages related to token deduction.
2. Verify that the user has a valid subscription record in the database.
3. Examine the token transaction history to identify any discrepancies.
4. Test the Edge Function using the included test script.

## Token Reset Logic

Free and Premium plans have their tokens reset on the 1st of each month. A cron job should be set up to call the `resetMonthlyTokens()` function on this date.

## Testing

Use the `test-edge-function.js` script to test the token deduction functionality:

```bash
node test-edge-function.js <userId> <tokenAmount> <operation>
```

Example:

```bash
node test-edge-function.js abc123 10 "LANDING_PAGE_GENERATION"
```
