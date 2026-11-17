import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5-5";
const MAX_TOKENS = 4000;

export function errorResponse(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

// Requiring JSON forces a CORS preflight, so other sites cannot post here and spend the key.
export function rejectUnusable(request: Request): Response | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return errorResponse("Add ANTHROPIC_API_KEY to .env.local and restart the app.", 503);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return errorResponse("Requests must be sent as JSON.", 415);
  }
  return null;
}

export async function askClaude(
  system: string,
  content: Anthropic.MessageParam["content"],
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content }],
  });
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
