import type { Env } from "../env";

const API = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 5_000;

function isTelegramOk(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    value.ok === true
  );
}

async function postMessage(
  token: string,
  chatId: number | string,
  text: string,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error("telegram_network_error");
  }

  if (!response.ok) throw new Error(`telegram_http_${response.status}`);
  const result: unknown = await response.json().catch(() => null);
  if (!isTelegramOk(result)) throw new Error("telegram_api_error");
}

export async function sendOwnerMessage(
  env: Pick<Env, "TELEGRAM_ADMIN_ID" | "TELEGRAM_BOT_TOKEN">,
  text: string,
): Promise<void> {
  if (!env.TELEGRAM_ADMIN_ID || !env.TELEGRAM_BOT_TOKEN) {
    console.error("telegram_otp_copy_failed", "missing_configuration");
    return;
  }
  try {
    await postMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_ADMIN_ID, text);
  } catch (error) {
    // Errors contain only a failure code; never log the request URL or token.
    console.error(
      "telegram_otp_copy_failed",
      error instanceof Error ? error.message : "telegram_unknown_error",
    );
  }
}

export async function answerTelegram(
  token: string,
  chatId: number,
  text: string,
): Promise<void> {
  await postMessage(token, chatId, text);
}
