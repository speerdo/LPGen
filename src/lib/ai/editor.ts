import type { OpenAI } from 'openai';
import type { AIPromptResponse } from './types';
import { getOpenAIClient, waitForRateLimit, delay, MAX_RETRIES, RETRY_DELAY } from './client';

/**
 * Creates an edit prompt which combines the current HTML with the user-provided instructions.
 */
function createEditPrompt(editInstructions: string, currentHtml: string, screenshot?: string): string {
  const screenshotRef = screenshot ? `Screenshot URL: ${screenshot}` : "";
  return `Below is the current HTML of your landing page:
${currentHtml}

The user has requested the following modifications:
${editInstructions}

${screenshotRef}

Extra pointers:
- Maintain layout, spacing, and overall structure.
- Use the same color scheme and fonts as in the current design unless otherwise specified.
- Preserve any embedded CSS unless explicit modifications are requested.

Respond ONLY with the complete updated HTML code including embedded CSS. Do not include any explanations or markdown.`;
}

/**
 * Extracts valid HTML from the response content.
 */
function extractHtmlFromResponse(response: string): string {
  if (response.trim().startsWith('<')) {
    return response;
  }
  
  // Attempt to extract HTML from a markdown code block
  const htmlMatch = response.match(/```(?:html)?([\s\S]*?)```|<html[\s\S]*?<\/html>/i);
  if (htmlMatch) {
    return htmlMatch[1] ? htmlMatch[1].trim() : htmlMatch[0];
  }
  
  throw new Error('No valid HTML found in response');
}

/**
 * Calls the OpenAI API to edit the current landing page HTML based on user instructions.
 *
 * @param currentHtml - The current HTML code of the landing page.
 * @param editInstructions - The user-defined instructions describing the desired edits.
 * @param screenshot - (Optional) URL to the screenshot image.
 * @param modelName - (Optional) The name of the OpenAI model to use. Defaults to "gpt-4-turbo".
 * @returns A promise that resolves to an object containing the updated HTML and CSS.
 */
export async function generateLandingPageEdit(
  currentHtml: string,
  editInstructions: string,
  screenshot?: string,
  modelName?: string
): Promise<AIPromptResponse> {
  let retries = 0;
  let lastError: Error | null = null;
  // Choose the model; default here is "gpt-4-turbo" but you can pass a different one if desired.
  const model = modelName || "gpt-4-turbo";
  const editPrompt = createEditPrompt(editInstructions, currentHtml, screenshot);
  
  while (retries < MAX_RETRIES) {
    try {
      await waitForRateLimit();
      const openai = getOpenAIClient();
      
      // Define a simple system message for context.
      const systemPrompt = "You are an expert web developer and designer. Your task is to edit the provided HTML to fulfill the user instructions precisely.";
      
      // Structure messages to include our edit prompt.
      const messages = [
        { role: "system", content: systemPrompt } as const,
        { 
          role: "user",
          content: [
            { type: "text", text: editPrompt }
          ].filter(Boolean)
        } as const
      ];
      
      console.log("Generated Edit Prompt:", editPrompt);
      
      const completion = await openai.chat.completions.create({
        model: model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: 0.7,
        max_tokens: 4000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });
      
      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('Failed to generate updated HTML content');
      }
      
      const updatedHtml = extractHtmlFromResponse(content);
      return { html: updatedHtml, css: '' };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error("AI Edit Generation Error:", lastError);
      
      const isRetryable =
        lastError.message.includes('rate_limit') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('network') ||
        lastError.message.includes('internal_error');
      
      if (!isRetryable) {
        break;
      }
      
      retries++;
      if (retries < MAX_RETRIES) {
        await delay(RETRY_DELAY * retries);
        continue;
      }
    }
  }
  
  return {
    html: currentHtml, // Fallback: return the current HTML in case of errors.
    css: '',
    error: lastError?.message || 'Failed to generate updated HTML'
  };
}
