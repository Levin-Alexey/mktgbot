import START_IMAGE from "./p1.jpg" with { type: "bytes" };

const GREETING = "Привет, я бот!";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let update;
    try {
      update = await request.json();
    } catch (error) {
      console.error("Failed to parse Telegram update:", error);
      return new Response("Invalid JSON", { status: 400 });
    }

    const message = update?.message;
    const chatId = message?.chat?.id;
    if (
      chatId === undefined ||
      !message.text?.match(/^\/start(?:@\w+)?(?:\s|$)/)
    ) {
      return new Response("OK");
    }

    if (!env.TELEGRAM_BOT_TOKEN) {
      console.error("Missing TELEGRAM_BOT_TOKEN secret");
      return new Response("Bot token is not configured", { status: 500 });
    }

    const apiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
    const photoForm = new FormData();
    photoForm.set("chat_id", String(chatId));
    photoForm.set(
      "photo",
      new Blob([START_IMAGE], { type: "image/jpeg" }),
      "start.jpg",
    );
    const photoResponse = await fetch(`${apiUrl}/sendPhoto`, {
      method: "POST",
      body: photoForm,
    });

    if (!photoResponse.ok) {
      console.error(
        "Telegram sendPhoto failed:",
        photoResponse.status,
        await photoResponse.text(),
      );
      return new Response("Failed to send start photo", { status: 502 });
    }

    const greetingResponse = await fetch(`${apiUrl}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: GREETING }),
    });

    if (!greetingResponse.ok) {
      console.error(
        "Telegram sendMessage failed:",
        greetingResponse.status,
        await greetingResponse.text(),
      );
      return new Response("Failed to send greeting", { status: 502 });
    }

    return new Response("OK");
  },
};
