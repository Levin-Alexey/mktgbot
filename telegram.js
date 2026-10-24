// Возвращает поле result ответа Telegram или null при ошибке
export async function callTelegram(apiUrl, method, body) {
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
    return null;
  }

  const data = await response.json().catch(() => null);
  return data?.result ?? true;
}
