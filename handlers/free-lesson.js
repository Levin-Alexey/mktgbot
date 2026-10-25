import { postToUserTopic } from "../group.js";
import { saveUser } from "./start.js";

const STATE_TTL_SECONDS = 24 * 60 * 60;
const MAX_TEXT_LENGTH = 500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const stateKey = (chatId) => `fsm:free-lesson:${chatId}`;

const STEPS = [
  "parent_name",
  "child_name",
  "child_age",
  "direction",
  "about_child",
  "preferred_time",
  "contact_method",
  "email",
];

const DIRECTIONS = {
  "fl-dir-ai": "ИИ",
  "fl-dir-prog": "Программирование",
  "fl-dir-help": "Не определились",
};

const PROMPTS = {
  parent_name:
    "Спасибо, что хотите познакомить ребёнка с миром программирования и ИИ! Чтобы записать его на бесплатный пробный урок, нам нужно уточнить пару деталей. Начнём с самого простого: напишите, пожалуйста, Ваше имя в ответном сообщении в чате и дальше шаг за шагом всё оформим!",
  child_name:
    "А теперь самое важное - имя будущего программиста! 🎉 Напишите, пожалуйста, как зовут ребёнка в ответном сообщении в чате. Мы уже мысленно готовим для него место в группе и первый проект!",
  child_age:
    "Спасибо! Теперь подскажите, сколько лет ребёнку. Это важно, чтобы подобрать подходящий уровень сложности - чтобы на уроке ему было интересно, но не слишком сложно.",
  direction:
    "Теперь давайте определимся с направлением. У нас их два: Искусственный Интеллект и программирование. Оба ведут к одному результату, просто с разного старта. Подскажите, что вам сейчас ближе?",
  about_child:
    "Поделитесь, пожалуйста, парой слов про ребёнка (1-2 предложения): что ему интересно, пробовал ли он программировать или работать с ИИ, к чему тянется. Это поможет нам сразу подстроиться под него.\n\nА если сейчас не хочется ничего описывать - нажмите кнопку ниже.",
  preferred_time:
    "Осталось совсем немного - выбрать время. Напишите, когда Вам и ребёнку было бы удобно прийти на пробный урок (можно пару вариантов). Мы всё проверим по расписанию и подтвердим подходящий слот.",
  contact_method:
    "Для быстрой связи и подтверждения записи нужен номер телефона. Напишите его, пожалуйста. Или, если удобнее, укажите ник в Telegram/WhatsApp - как вам комфортнее.",
  email:
    "Чтобы прислать все детали пробного урока и полезные материалы, укажите, пожалуйста, Вашу электронную почту. Обещаем: никаких лишних писем - только то, что нужно для занятия.",
};

const KEYBOARDS = {
  direction: {
    inline_keyboard: [
      [{ text: "🤖 Искусственный интеллект", callback_data: "fl-dir-ai" }],
      [{ text: "💻 Программирование", callback_data: "fl-dir-prog" }],
      [{ text: "🤔 Нужна помощь в выборе", callback_data: "fl-dir-help" }],
    ],
  },
  about_child: {
    inline_keyboard: [
      [{ text: "🤷 Пока сложно ответить", callback_data: "fl-about-skip" }],
    ],
  },
  confirm: {
    inline_keyboard: [
      [{ text: "✅ Всё верно", callback_data: "fl-confirm" }],
      [{ text: "✏️ Изменить", callback_data: "fl-edit" }],
    ],
  },
  menu: {
    inline_keyboard: [[{ text: "🏠 Главное меню", callback_data: "menu" }]],
  },
};

const THANKS = `Спасибо, что доверили нам знакомство ребёнка с миром ИИ и программирования.

Совсем скоро наш куратор свяжется с вами, чтобы подтвердить время пробного урока и ответить на любые вопросы.

До встречи на занятии - уверены, ребёнку понравится! 🚀`;

const EXPIRED =
  "Анкета устарела. Вернитесь в главное меню и начните запись заново.";

function formatFields(data) {
  return [
    `👤 Имя родителя: ${data.parent_name}`,
    `🧒 Имя ребёнка: ${data.child_name}`,
    `🎂 Возраст: ${data.child_age}`,
    `🎯 Направление: ${data.direction}`,
    `📝 О ребёнке: ${data.about_child ?? "—"}`,
    `🕒 Удобное время: ${data.preferred_time}`,
    `📞 Контакт: ${data.contact_method}`,
    `✉️ Email: ${data.email}`,
  ].join("\n");
}

async function loadState(env, chatId) {
  return env.KV.get(stateKey(chatId), "json");
}

async function saveState(env, chatId, state) {
  await env.KV.put(stateKey(chatId), JSON.stringify(state), {
    expirationTtl: STATE_TTL_SECONDS,
  });
}

export async function clearFreeLessonState(env, chatId) {
  await env.KV.delete(stateKey(chatId));
}

async function advance(ctx, state, value) {
  state.data[state.step] = value;
  state.step = STEPS[STEPS.indexOf(state.step) + 1] ?? "confirm";
  await saveState(ctx.env, ctx.chatId, state);

  if (state.step === "confirm") {
    await ctx.send(
      `Проверьте, пожалуйста, данные заявки:\n\n${formatFields(state.data)}\n\nВсё верно?`,
      KEYBOARDS.confirm,
    );
  } else {
    await ctx.send(PROMPTS[state.step], KEYBOARDS[state.step]);
  }
}

// Кнопки «Бесплатный урок» и «Изменить»: опрос начинается с первого шага
export default async function handleFreeLesson(ctx) {
  await saveState(ctx.env, ctx.chatId, {
    step: STEPS[0],
    data: {},
    username: ctx.from?.username ?? null,
  });
  await ctx.send(PROMPTS[STEPS[0]]);
}

export async function handleFreeLessonMessage(ctx, text) {
  const state = await loadState(ctx.env, ctx.chatId);
  if (!state) {
    return;
  }

  if (state.step === "direction" || state.step === "confirm") {
    await ctx.send("Пожалуйста, выберите вариант с помощью кнопок выше 👆");
    return;
  }

  const answer = text?.trim();
  if (!answer || answer.length > MAX_TEXT_LENGTH) {
    await ctx.send(
      `Пожалуйста, отправьте ответ текстом (до ${MAX_TEXT_LENGTH} символов).`,
    );
    return;
  }

  if (state.step === "email" && !EMAIL_PATTERN.test(answer)) {
    await ctx.send(
      "Похоже, в адресе ошибка. Пожалуйста, укажите почту в формате name@example.com",
    );
    return;
  }

  await advance(ctx, state, answer);
}

// Нажатия inline-кнопок опроса (fl-*)
export async function handleFreeLessonAction(ctx) {
  if (ctx.data === "fl-edit") {
    return handleFreeLesson(ctx);
  }

  const state = await loadState(ctx.env, ctx.chatId);
  if (!state) {
    await ctx.send(EXPIRED, KEYBOARDS.menu);
    return;
  }

  if (ctx.data in DIRECTIONS && state.step === "direction") {
    await advance(ctx, state, DIRECTIONS[ctx.data]);
  } else if (ctx.data === "fl-about-skip" && state.step === "about_child") {
    await advance(ctx, state, null);
  } else if (ctx.data === "fl-confirm" && state.step === "confirm") {
    await submitApplication(ctx, state);
  }
}

async function submitApplication(ctx, state) {
  const { env, chatId } = ctx;
  const data = state.data;

  let applicationId;
  try {
    await saveUser(env, chatId);
    const result = await env.DB.prepare(
      `INSERT INTO applications (
         telegram_id, parent_name, child_name, child_age, direction,
         about_child, preferred_time, contact_method, email
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
      .bind(
        chatId,
        data.parent_name,
        data.child_name,
        data.child_age,
        data.direction,
        data.about_child ?? null,
        data.preferred_time,
        data.contact_method,
        data.email,
      )
      .run();
    applicationId = result.meta.last_row_id;
  } catch (error) {
    console.error("Failed to save application:", error);
    await ctx.send(
      "Не удалось отправить заявку. Пожалуйста, нажмите «Всё верно» ещё раз.",
      KEYBOARDS.confirm,
    );
    return;
  }

  await clearFreeLessonState(env, chatId);

  // Заявка уже в БД, поэтому сбой уведомления не должен пугать пользователя
  try {
    await notifyGroup(ctx, applicationId, state);
  } catch (error) {
    console.error("Failed to notify applications group:", error);
  }

  await ctx.send(THANKS, KEYBOARDS.menu);
}

async function notifyGroup(ctx, applicationId, state) {
  const username = state.username ? `@${state.username}` : "без username";
  const text = `🆕 Новая заявка #${applicationId}\nTelegram: ${username} (ID ${ctx.chatId})\n\n${formatFields(state.data)}`;
  await postToUserTopic(ctx, state.data.parent_name, text);
}
