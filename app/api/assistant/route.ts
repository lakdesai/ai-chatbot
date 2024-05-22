import { AssistantResponse } from 'ai';
import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

// Create an OpenAI API client (that's edge friendly!)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const input: {
      threadId: string | null;
      message: string;
    } = await req.json();

    // Create a thread if needed
    const threadId = input.threadId ?? (await openai.beta.threads.create({})).id;

    // Add a message to the thread
    const createdMessage = await openai.beta.threads.messages.create(
      threadId,
      {
        role: 'user',
        content: input.message,
      },
      { signal: req.signal },
    );

    return AssistantResponse(
      { threadId, messageId: createdMessage.id },
      async ({ forwardStream }) => {
        // Run the assistant on the thread
        const runResponse = await openai.beta.threads.runs.create(
          threadId,
          {
            assistant_id:
              process.env.ASSISTANT_ID ??
              (() => {
                throw new Error('ASSISTANT_ID is not set');
              })(),
          },
          { signal: req.signal },
        );

        // Forward run status to stream message deltas
        await forwardStream(runResponse);

        // Polling for completion or further actions
        let runResult = await openai.beta.threads.runs.retrieve(threadId, runResponse.id);

        while (runResult.status === 'requires_action' && runResult.required_action?.type === 'submit_tool_outputs') {
          const tool_outputs = runResult.required_action.submit_tool_outputs.tool_calls.map(
            (toolCall: any) => {
              // Handle tool calls here if any
              return {
                tool_call_id: toolCall.id,
                output: 'processed output here',
              };
            },
          );

          runResult = await openai.beta.threads.runs.submitToolOutputs(threadId, runResult.id, { tool_outputs });
        }
      },
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

