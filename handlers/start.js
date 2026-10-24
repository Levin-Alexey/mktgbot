const GREETING = `Будущее уже наступило - и наши дети будут жить в мире искусственного интеллекта, умных программ и технологий, которые сегодня меняются буквально каждый день.

Наша задача - не просто познакомить ребёнка с ИИ. Мы хотим научить его понимать современные технологии, правильно ими пользоваться, мыслить самостоятельно, придумывать идеи и превращать их в настоящие проекты.

На занятиях дети работают с искусственным интеллектом, делают первые шаги в программировании, создают сайты, игры, приложения, изображения и собственные цифровые проекты.

Для нас важно, чтобы ребёнок не просто умел спросить что-то у нейросети и получить готовый ответ. Мы учим использовать ИИ как инструмент для творчества, обучения, решения задач и реализации собственных идей.

🚀 Здесь ребёнок становится не просто пользователем технологий, а человеком, который понимает их и умеет создавать с их помощью новое.

Мир меняется. Давайте поможем нашим детям быть к этому готовыми.

❤️ Будем строить будущее вместе!`;

const INLINE_KEYBOARD = {
  inline_keyboard: [
    [{ text: "🎁 БЕСПЛАТНЫЙ УРОК", callback_data: "free-lesson" }],
    [{ text: "📚 НАШИ КУРСЫ", callback_data: "courses" }],
    [{ text: "🧭 ПОДОБРАТЬ КУРС", callback_data: "course-selection" }],
    [{ text: "🏆 ПРОЕКТЫ УЧЕНИКОВ", callback_data: "student-projects" }],
    [{ text: "💰 СТОИМОСТЬ ЗАНЯТИЙ", callback_data: "pricing" }],
    [{ text: "❓ ЗАДАТЬ ВОПРОС", callback_data: "question" }],
  ],
};

export async function saveUser(env, telegramId) {
  await env.DB.prepare(
    `INSERT INTO users (telegram_id, created_at, last_seen_at)
     VALUES (?1, datetime('now'), datetime('now'))
     ON CONFLICT(telegram_id) DO UPDATE SET
       last_seen_at = datetime('now')`,
  )
    .bind(telegramId)
    .run();
}

export default async function handleStart(ctx) {
  // Сбой БД не должен мешать показать приветствие
  try {
    await saveUser(ctx.env, ctx.chatId);
  } catch (error) {
    console.error("Failed to save user:", error);
  }

  await ctx.send(GREETING, INLINE_KEYBOARD);
}
