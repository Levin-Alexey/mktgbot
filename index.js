import handleStart from "./handlers/start.js";
import handleFreeLesson, {
  clearFreeLessonState,
  handleFreeLessonAction,
  handleFreeLessonMessage,
} from "./handlers/free-lesson.js";
import handleCourses from "./handlers/courses.js";
import handleCourseSelection from "./handlers/course-selection.js";
import handleStudentProjects from "./handlers/student-projects.js";
import handlePricing from "./handlers/pricing.js";
import handleQuestion from "./handlers/question.js";
import { callTelegram } from "./telegram.js";

// Обработчик получает ctx и может сам отправить сообщения или вернуть строку-ответ
const BUTTON_HANDLERS = {
  menu: handleStart,
  "free-lesson": handleFreeLesson,
  "fl-dir-ai": handleFreeLessonAction,
  "fl-dir-prog": handleFreeLessonAction,
  "fl-dir-help": handleFreeLessonAction,
  "fl-about-skip": handleFreeLessonAction,
  "fl-confirm": handleFreeLessonAction,
  "fl-edit": handleFreeLessonAction,
  courses: handleCourses,
  "course-selection": handleCourseSelection,
  "student-projects": handleStudentProjects,
  pricing: handlePricing,
  question: handleQuestion,
};

function createContext(env, apiUrl, chatId, from, data) {
  const tg = (method, body) => callTelegram(apiUrl, method, body);
  return {
    env,
    chatId,
    from,
    data,
    tg,
    send: (text, replyMarkup) =>
      tg("sendMessage", {
        chat_id: chatId,
        text,
        ...(replyMarkup && { reply_markup: replyMarkup }),
      }),
  };
}

async function handleCallback(env, apiUrl, callbackQuery) {
  const handler = Object.hasOwn(BUTTON_HANDLERS, callbackQuery.data)
    ? BUTTON_HANDLERS[callbackQuery.data]
    : undefined;

  await callTelegram(apiUrl, "answerCallbackQuery", {
    callback_query_id: callbackQuery.id,
    ...(!handler && { text: "Неизвестная команда", show_alert: true }),
  });

  const chatId = callbackQuery.message?.chat?.id;
  if (!handler || chatId === undefined) {
    return;
  }

  const ctx = createContext(
    env,
    apiUrl,
    chatId,
    callbackQuery.from,
    callbackQuery.data,
  );
  const reply = await handler(ctx);
  if (typeof reply === "string") {
    await ctx.send(reply);
  }
}

async function handleMessage(env, apiUrl, message) {
  // Бот состоит в группе заявок: сообщения вне личного чата игнорируем
  if (message.chat?.type !== "private") {
    return;
  }

  const ctx = createContext(env, apiUrl, message.chat.id, message.from);

  if (message.text?.match(/^\/start(?:@\w+)?(?:\s|$)/)) {
    await clearFreeLessonState(env, ctx.chatId);
    await handleStart(ctx);
    return;
  }

  await handleFreeLessonMessage(ctx, message.text);
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

    if (!update?.message && !update?.callback_query) {
      return new Response("OK");
    }

    if (!env.TELEGRAM_BOT_TOKEN) {
      console.error("Missing TELEGRAM_BOT_TOKEN secret");
      return new Response("Bot token is not configured", { status: 500 });
    }

    const apiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

    // Ошибки не пробрасываем: иначе Telegram повторит апдейт и заявка продублируется
    try {
      if (update.callback_query) {
        await handleCallback(env, apiUrl, update.callback_query);
      } else {
        await handleMessage(env, apiUrl, update.message);
      }
    } catch (error) {
      console.error("Failed to handle update:", error);
    }

    return new Response("OK");
  },
};
