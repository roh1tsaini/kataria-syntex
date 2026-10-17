import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import {
  registrationsEnabled,
  saveRegistrationsEnabled,
} from "../auth/registration";
import { answerTelegram } from "../lib/telegram";
import { timingSafeEqual } from "../lib/token";

const updateSchema = z.object({
  message: z
    .object({
      from: z.object({ id: z.number().int() }),
      chat: z.object({ id: z.number().int(), type: z.string() }),
      text: z.string().max(4096).optional(),
    })
    .optional(),
});

export const telegramRoute = new Hono<{ Bindings: Env }>();

telegramRoute.post("/webhook", async (c) => {
  const secret = c.env.TELEGRAM_WEBHOOK_SECRET;
  const token = c.env.TELEGRAM_BOT_TOKEN;
  const adminId = c.env.TELEGRAM_ADMIN_ID;
  if (
    !secret ||
    !token ||
    !adminId ||
    !timingSafeEqual(
      c.req.header("X-Telegram-Bot-Api-Secret-Token") ?? "",
      secret,
    )
  )
    return c.json({ error: "unauthorized" }, 401);

  const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || !parsed.data.message?.text)
    return c.json({ ok: true });
  const { from, chat, text } = parsed.data.message;
  const command =
    /^\/(start|status|registrations_on|registrations_off)(?:@[A-Za-z0-9_]{1,64})?$/.exec(
      text,
    )?.[1];
  if (!command) return c.json({ ok: true });

  try {
    // Silently ignore unauthorized senders or group chats to prevent bot spam
    if (
      chat.type !== "private" ||
      String(from.id) !== adminId ||
      String(chat.id) !== adminId
    ) {
      return c.json({ ok: true });
    }

    if (command === "start") {
      await answerTelegram(
        token,
        chat.id,
        "Kataria Syntex Admin Bot ready.\n\nCommands:\n/status - Check registration status\n/registrations_on - Enable public registrations\n/registrations_off - Disable public registrations",
      );
      return c.json({ ok: true });
    }

    if (command === "status") {
      const enabled = await registrationsEnabled(c.env.DB);
      await answerTelegram(
        token,
        chat.id,
        `New registrations are currently ${enabled ? "enabled" : "disabled"}.`,
      );
      return c.json({ ok: true });
    }

    const enabled = command === "registrations_on";
    try {
      await saveRegistrationsEnabled(c.env.DB, enabled);
    } catch {
      console.error("telegram_registration_save_failed");
      await answerTelegram(
        token,
        chat.id,
        "Could not save the registration setting. The previous setting remains in effect.",
      );
      return c.json({ ok: true });
    }
    await answerTelegram(
      token,
      chat.id,
      `New registrations are ${enabled ? "enabled" : "disabled"}.`,
    );
  } catch {
    console.error("telegram_webhook_reply_failed");
    return c.json({ error: "telegram_delivery_failed" }, 502);
  }
  return c.json({ ok: true });
});
