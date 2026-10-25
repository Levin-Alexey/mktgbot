const topicKey = (chatId) => `topic:${chatId}`;

// Пишет в топик пользователя в группе; если топика ещё нет (или он удалён) - создаёт новый
export async function postToUserTopic(ctx, topicTitle, text) {
  const { env, chatId } = ctx;
  const groupId = env.APPLICATIONS_CHAT_ID;
  if (!groupId) {
    console.error("Missing APPLICATIONS_CHAT_ID");
    return;
  }

  const savedTopic = await env.KV.get(topicKey(chatId));
  if (savedTopic) {
    const sent = await ctx.tg("sendMessage", {
      chat_id: groupId,
      message_thread_id: Number(savedTopic),
      text,
    });
    if (sent) {
      return;
    }
  }

  const topic = await ctx.tg("createForumTopic", {
    chat_id: groupId,
    name: `${topicTitle} · ${chatId}`.slice(0, 128),
  });
  if (!topic?.message_thread_id) {
    return;
  }

  await env.KV.put(topicKey(chatId), String(topic.message_thread_id));
  await ctx.tg("sendMessage", {
    chat_id: groupId,
    message_thread_id: topic.message_thread_id,
    text,
  });
}

export function describeUser(ctx) {
  const username = ctx.from?.username ? `@${ctx.from.username}` : "без username";
  return `Telegram: ${username} (ID ${ctx.chatId})`;
}
