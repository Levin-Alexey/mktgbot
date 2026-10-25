import { describeUser, postToUserTopic } from "../group.js";
import { saveUser } from "./start.js";

const STATE_TTL_SECONDS = 24 * 60 * 60;
const MAX_QUESTION_LENGTH = 3000;

const stateKey = (chatId) => `fsm:question:${chatId}`;

const PROMPT =
  "💬 Задать вопрос\n\nНапишите Ваш вопрос в ответном сообщении в чате, и мы ответим Вам в ближайшее время.";

const THANKS =
  "Спасибо! Ваш вопрос передан менеджеру, он ответит вам в ближайшее время.";

const SELECTION_THANKS =
  "Спасибо! Ваш запрос принят, мы подберём подходящий курс и ответим Вам в ближайшее время.";

const MENU_KEYBOARD = {
  inline_keyboard: [[{ text: "🏠 Главное меню", callback_data: "menu" }]],
};

export async function clearQuestionState(env, chatId) {
  await env.KV.delete(stateKey(chatId));
}

export async function hasQuestionState(env, chatId) {
  return (await env.KV.get(stateKey(chatId))) !== null;
}

// kind: "question" | "selection"; course - пометка для «Узнать подробнее»
async function startWaiting(ctx, { course = null, kind = "question" }, prompt) {
  await ctx.env.KV.put(stateKey(ctx.chatId), JSON.stringify({ course, kind }), {
    expirationTtl: STATE_TTL_SECONDS,
  });
  await ctx.send(prompt);
}

// Кнопка «Задать вопрос»: ждём от пользователя текст
export default async function handleQuestion(ctx) {
  await startWaiting(ctx, {}, PROMPT);
}

// Кнопка «Узнать подробнее» на странице курса: тот же поток, но с пометкой курса
export async function handleCourseInquiry(ctx, courseTitle) {
  await startWaiting(
    ctx,
    { course: courseTitle },
    `💬 Узнать подробнее: «${courseTitle}»\n\nНапишите Ваш вопрос по этому курсу в ответном сообщении в чате, и мы ответим Вам в ближайшее время.`,
  );
}

// Кнопка «Подобрать курс»: ждём возраст и интересы ребёнка
export async function startCourseSelection(ctx, prompt) {
  await startWaiting(ctx, { kind: "selection" }, prompt);
}

// Кнопка «Получить консультацию» на экране стоимости
export async function startPricingQuestion(ctx, prompt) {
  await startWaiting(ctx, { kind: "pricing" }, prompt);
}

async function loadState(ctx) {
  try {
    const state = JSON.parse(await ctx.env.KV.get(stateKey(ctx.chatId)));
    return { course: state?.course ?? null, kind: state?.kind ?? "question" };
  } catch {
    return { course: null, kind: "question" };
  }
}

export async function handleQuestionMessage(ctx, text) {
  const questionText = text?.trim();
  if (!questionText || questionText.length > MAX_QUESTION_LENGTH) {
    await ctx.send(
      `Пожалуйста, отправьте ответ текстом (до ${MAX_QUESTION_LENGTH} символов).`,
    );
    return;
  }

  const { course, kind } = await loadState(ctx);
  const isSelection = kind === "selection";
  const isPricing = kind === "pricing";
  // В таблице questions нет отдельных колонок, поэтому пометка идёт в тексте
  const mark = isSelection
    ? "[Подбор курса] "
    : isPricing
      ? "[Вопрос по стоимости] "
      : course
        ? `[Курс: ${course}] `
        : "";
  const contactInfo = ctx.from?.username ? `@${ctx.from.username}` : null;

  let questionId;
  try {
    await saveUser(ctx.env, ctx.chatId);
    const result = await ctx.env.DB.prepare(
      `INSERT INTO questions (telegram_id, question_text, contact_info)
       VALUES (?1, ?2, ?3)`,
    )
      .bind(ctx.chatId, `${mark}${questionText}`, contactInfo || null)
      .run();
    questionId = result.meta.last_row_id;
  } catch (error) {
    console.error("Failed to save question:", error);
    await ctx.send(
      "Не удалось отправить сообщение. Пожалуйста, отправьте его ещё раз.",
    );
    return;
  }

  await clearQuestionState(ctx.env, ctx.chatId);

  // Запись уже в БД, поэтому сбой уведомления не должен пугать пользователя
  try {
    const name = ctx.from?.first_name || "Пользователь";
    const title = isSelection
      ? `🧭 Подбор курса #${questionId}`
      : isPricing
        ? `💰 Вопрос по стоимости #${questionId}`
        : course
          ? `❓ Новый вопрос #${questionId}\n📚 Курс: ${course}`
          : `❓ Новый вопрос #${questionId}`;
    await postToUserTopic(
      ctx,
      name,
      `${title}\n${describeUser(ctx)}\n\n${questionText}`,
    );
  } catch (error) {
    console.error("Failed to notify questions group:", error);
  }

  await ctx.send(isSelection ? SELECTION_THANKS : THANKS, MENU_KEYBOARD);
}
