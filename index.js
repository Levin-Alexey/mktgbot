import handleFreeLesson from "./handlers/free-lesson.js";
import handleCourses from "./handlers/courses.js";
import handleCourseSelection from "./handlers/course-selection.js";
import handleStudentProjects from "./handlers/student-projects.js";
import handlePricing from "./handlers/pricing.js";
import handleQuestion from "./handlers/question.js";

const GREETING = `Будущее уже наступило - и наши дети будут жить в мире искусственного интеллекта, умных программ и технологий, которые сегодня меняются буквально каждый день.

Наша задача - не просто познакомить ребёнка с ИИ. Мы хотим научить его понимать современные технологии, правильно ими пользоваться, мыслить самостоятельно, придумывать идеи и превращать их в настоящие проекты.

На занятиях дети работают с искусственным интеллектом, делают первые шаги в программировании, создают сайты, игры, приложения, изображения и собственные цифровые проекты.

Для нас важно, чтобы ребёнок не просто умел спросить что-то у нейросети и получить готовый ответ. Мы учим использовать ИИ как инструмент для творчества, обучения, решения задач и реализации собственных идей.

🚀 Здесь ребёнок становится не просто пользователем технологий, а человеком, который понимает их и умеет создавать с их помощью новое.

Мир меняется. Давайте поможем нашим детям быть к этому готовыми.

❤️ Будем строить будущее вместе!`;

const INLINE_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "БЕСПЛАТНЫЙ УРОК", callback_data: "free-lesson" },
      { text: "НАШИ КУРСЫ", callback_data: "courses" },
    ],
    [
      { text: "ПОДОБРАТЬ КУРС", callback_data: "course-selection" },
      { text: "ПРОЕКТЫ УЧЕНИКОВ", callback_data: "student-projects" },
    ],
    [
      { text: "СТОИМОСТЬ ОБУЧЕНИЯ", callback_data: "pricing" },
      { text: "ЗАДАТЬ ВОПРОС", callback_data: "question" },
    ],
  ],
};

const BUTTON_HANDLERS = {
  "free-lesson": handleFreeLesson,
  courses: handleCourses,
  "course-selection": handleCourseSelection,
  "student-projects": handleStudentProjects,
  pricing: handlePricing,
  question: handleQuestion,
};

async function telegramRequest(apiUrl, method, body) {
  const response = await fetch(`${apiUrl}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error(
      `Telegram ${method} failed:`,
      response.status,
      await response.text(),
    );
    return false;
  }

  return true;
}

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
    const callbackQuery = update?.callback_query;
    const isStartCommand =
      message?.chat?.id !== undefined &&
      message.text?.match(/^\/start(?:@\w+)?(?:\s|$)/);
    const callbackHandler = Object.hasOwn(
      BUTTON_HANDLERS,
      callbackQuery?.data,
    )
      ? BUTTON_HANDLERS[callbackQuery.data]
      : undefined;

    if (!isStartCommand && !callbackQuery) {
      return new Response("OK");
    }

    if (!env.TELEGRAM_BOT_TOKEN) {
      console.error("Missing TELEGRAM_BOT_TOKEN secret");
      return new Response("Bot token is not configured", { status: 500 });
    }

    const apiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

    if (callbackQuery) {
      const callbackAnswered = await telegramRequest(
        apiUrl,
        "answerCallbackQuery",
        {
          callback_query_id: callbackQuery.id,
          ...(!callbackHandler && {
            text: "Неизвестная команда",
            show_alert: true,
          }),
        },
      );

      if (!callbackAnswered) {
        return new Response("Failed to answer callback", { status: 502 });
      }

      const chatId = callbackQuery.message?.chat?.id;
      if (!callbackHandler || chatId === undefined) {
        return new Response("OK");
      }

      const reply = callbackHandler();
      const replySent = await telegramRequest(apiUrl, "sendMessage", {
        chat_id: chatId,
        text: reply,
      });

      return replySent
        ? new Response("OK")
        : new Response("Failed to send button response", { status: 502 });
    }

    const chatId = message.chat.id;

    // Сбой БД не должен мешать показать приветствие
    try {
      await env.DB.prepare(
        `INSERT INTO users (telegram_id, created_at, last_seen_at)
         VALUES (?1, datetime('now'), datetime('now'))
         ON CONFLICT(telegram_id) DO UPDATE SET
           last_seen_at = datetime('now')`,
      )
        .bind(chatId)
        .run();
    } catch (error) {
      console.error("Failed to save user:", error);
    }

    const greetingSent = await telegramRequest(apiUrl, "sendMessage", {
      chat_id: chatId,
      text: GREETING,
      reply_markup: INLINE_KEYBOARD,
    });

    return greetingSent
      ? new Response("OK")
      : new Response("Failed to send greeting", { status: 502 });
  },
};
