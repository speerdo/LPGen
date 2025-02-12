import OpenAI from 'openai';
import { getOpenAIClient, waitForRateLimit, delay, MAX_RETRIES, RETRY_DELAY } from './client';
import { createSystemPrompt, createFullPrompt } from './prompts';
import { getDefaultTemplate } from './templates';
import type { WebsiteStyle } from '../../types/database';
import type { AIPromptResponse } from './types';

function extractHtmlFromResponse(response: string): string {
  // If response starts with HTML, return as-is
  if (response.trim().startsWith('<')) {
    return response;
  }
  
  // Try to find HTML content between backticks or after markdown code block indicators
  const htmlMatch = response.match(/```(?:html)?([\s\S]*?)```|<html[\s\S]*?<\/html>/i);
  if (htmlMatch) {
    return htmlMatch[1] ? htmlMatch[1].trim() : htmlMatch[0];
  }
  
  // If no HTML found, throw error
  throw new Error('No valid HTML found in response');
}

export async function generateLandingPage(
  prompt: string,
  style?: WebsiteStyle,
  screenshot?: string
): Promise<AIPromptResponse> {
  let retries = 0;
  let lastError: Error | null = null;

  while (retries < MAX_RETRIES) {
    try {
      await waitForRateLimit();
      const openai = getOpenAIClient();
      
      const systemPrompt = createSystemPrompt();
      const fullPrompt = createFullPrompt(prompt, style, screenshot);

      const messages = [
        { role: "system", content: systemPrompt } as const,
        { 
          role: "user",
          content: [
            { type: "text", text: fullPrompt },
            screenshot ? { type: "image_url", image_url: { url: screenshot, detail: "high" } } : null
          ].filter(Boolean)
        } as const
      ];

      console.log('Generated AI Prompt:', fullPrompt);
      console.log("Image input being sent:", screenshot);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: 0.7,
        max_tokens: 4000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });

      const content = completion.choices[0].message.content;

      if (!content) {
        throw new Error('Failed to generate landing page content');
      }

      const cleanHtml = extractHtmlFromResponse(content);
      
      return {
        html: cleanHtml,
        css: '',
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error('AI Generation Error:', lastError);
      
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
    html: getDefaultTemplate(style),
    css: '',
    error: lastError?.message || 'Failed to generate content'
  };
}
