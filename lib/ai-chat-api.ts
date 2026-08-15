/** KeyForge AI agent chat endpoint (ACMECOM tenant). */
export const AI_CHAT_API_URL =
  "https://graph.keyforge.ai/kfagent/api/v1/ACMECOM/chat";

export type ChatApiResult = {
  conversation_id: string;
  reply: string;
};

export class SuppressedChatError extends Error {
  constructor() {
    super("Suppressed chat error");
    this.name = "SuppressedChatError";
  }
}
const TECHNICAL_CHAT_ERROR =
  /LLM API request failed|flatMap|terminal signal|no fallback has been configured|120000ms/i;

/** Backend/LLM failures that should not be shown verbatim in the chat UI. */
export function isSuppressedChatError(message: string): boolean {
  return TECHNICAL_CHAT_ERROR.test(message);
}

export function getUserFacingChatError(message: string): string | null {
  if (isSuppressedChatError(message)) return null;
  if (/sign in required/i.test(message)) return message;
  return "Something went wrong. Please try again.";
}

function parseApiError(text: string, status: number, statusText: string): string {
  if (!text.trim()) {
    return `Chat API request failed (${status} ${statusText})`;
  }
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    const message = body.message ?? body.error ?? body.statusMessage;
    if (typeof message === "string" && message.trim()) return message.trim();
  } catch {
    // not JSON
  }
  return text;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function parseChatResponse(data: unknown): ChatApiResult {
  if (typeof data === "string" && data.trim()) {
    if (isSuppressedChatError(data)) {
      throw new SuppressedChatError();
    }
    return { conversation_id: "", reply: data.trim() };
  }

  if (!data || typeof data !== "object") {
    throw new Error("Chat API returned an unexpected response shape");
  }

  const root = data as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root.result && typeof root.result === "object"
        ? (root.result as Record<string, unknown>)
        : null;

  const sources = nested ? [nested, root] : [root];

  let conversation_id = "";
  let reply = "";

  for (const source of sources) {
    conversation_id =
      pickString(source, ["conversation_id", "conversationId"]) ?? conversation_id;
    reply =
      pickString(source, [
        "response",
        "reply",
        "answer",
        "content",
        "text",
        "assistant_message",
        "assistantMessage",
        "message",
      ]) ?? reply;
  }

  if (!reply) {
    throw new Error("Chat API returned an unexpected response shape");
  }

  if (isSuppressedChatError(reply)) {
    throw new SuppressedChatError();
  }

  return { conversation_id, reply };
}

export async function sendChatMessage(
  message: string,
  conversationId?: string | null,
  bearerToken?: string | null
): Promise<ChatApiResult> {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new Error("Message is required.");
  }

  const payload: Record<string, string> = { message: trimmedMessage };
  const trimmedConversationId = conversationId?.trim();
  if (trimmedConversationId) {
    payload.conversation_id = trimmedConversationId;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const token =
    bearerToken?.trim() || process.env.POLICY_OPTIMIZATION_API_KEY?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(AI_CHAT_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const parsed = parseApiError(text, res.status, res.statusText);
    if (isSuppressedChatError(parsed)) {
      throw new SuppressedChatError();
    }
    const err = new Error(parsed) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const text = await res.text().catch(() => "");
  if (!text.trim()) {
    throw new Error("Chat API returned an empty response");
  }

  try {
    return parseChatResponse(JSON.parse(text) as unknown);
  } catch (error) {
    if (error instanceof SuppressedChatError) throw error;
    if (error instanceof Error && error.message.includes("unexpected response")) {
      throw error;
    }
    return parseChatResponse(text);
  }
}
