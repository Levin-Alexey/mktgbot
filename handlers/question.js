import { describeUser, postToUserTopic } from "../group.js";
import { saveUser } from "./start.js";

const STATE_TTL_SECONDS = 24 * 60 * 60;
const MAX_QUESTION_LENGTH = 3000;

const stateKey = (chatId) => `fsm:question:${chatId}`;

const PROMPT =
  "💬 Задать вопрос\n\nНапишите Ваш вопрос в ответном сообщении в чате, и мы ответим Вам в ближайшее время.";

const THANKS =
  "Спасибо! Ваш вопрос передан менеджеру, он ответит вам в ближайшее время.";

const MENU_KEYBOARD = {
  inline_keyboard: [[{ text: "🏠 Главное меню", callback_data: "menu" }]],
};

export async function clearQuestionState(env, chatId) {
  await env.KV.delete(stateKey(chatId));
}

export async function hasQuestionState(env, chatId) {
  return (await env.KV.get(stateKey(chatId))) !== null;
}

// Кнопка «Задать вопрос»: ждём от пользователя текст
export default async function handleQuestion(ctx) {
  await ctx.env.KV.put(stateKey(ctx.chatId), "waiting", {
    expirationTtl: STATE_TTL_SECONDS,
  });
  await ctx.send(PROMPT);
}

export async function handleQuestionMessage(ctx, text) {
  const questionText = text?.trim();
  if (!questionText || questionText.length > MAX_QUESTION_LENGTH) {
    await ctx.send(
      `Пожалуйста, отправьте вопрос текстом (до ${MAX_QUESTION_LENGTH} символов).`,
    );
    return;
  }

  const contactInfo = ctx.from?.username ? `@${ctx.from.username}` : null;

  let questionId;
  try {
    await saveUser(ctx.env, ctx.chatId);
    const result = await ctx.env.DB.prepare(
      `INSERT INTO questions (telegram_id, question_text, contact_info)
       VALUES (?1, ?2, ?3)`,
    )
      .bind(ctx.chatId, questionText, contactInfo || null)
      .run();
    questionId = result.meta.last_row_id;
  } catch (error) {
    console.error("Failed to save question:", error);
    await ctx.send(
      "Не удалось отправить вопрос. Пожалуйста, отправьте его ещё раз.",
    );
    return;
  }

  await clearQuestionState(ctx.env, ctx.chatId);

  // Вопрос уже в БД, поэтому сбой уведомления не должен пугать пользователя
  try {
    const name = ctx.from?.first_name || "Пользователь";
    await postToUserTopic(
      ctx,
      name,
      `❓ Новый вопрос #${questionId}\n${describeUser(ctx)}\n\n${questionText}`,
    );
  } catch (error) {
    console.error("Failed to notify questions group:", error);
  }

  await ctx.send(THANKS, MENU_KEYBOARD);
}
