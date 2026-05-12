export async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  await $fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    body: { chat_id: chatId, text, parse_mode: 'HTML' }
  })
}
