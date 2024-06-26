import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  // Extract the `messages` from the body of the request
  const { messages } = await req.json();

  // Call the language model
  const result = await streamText({
    model: openai('gpt-3.5-turbo'),
    messages,
  });

  // Respond with the stream
  return result.toAIStreamResponse();
}
