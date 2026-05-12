const KITCHEN_URL = 'https://food-order-kohl-mu.vercel.app/kitchen'

function getToken() { return process.env.TELEGRAM_BOT_TOKEN }
function getChatId() { return process.env.TELEGRAM_CHAT_ID }

export async function sendTelegramOrderMessage(text: string, orderId: number): Promise<number | null> {
  const token = getToken()
  const chatId = getChatId()
  if (!token || !chatId) return null

  const res: any = await $fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    body: {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '🍳 เริ่มทำ', callback_data: `cooking_${orderId}` },
          { text: '👨‍🍳 เปิดครัว', url: KITCHEN_URL }
        ]]
      }
    }
  })
  return res?.result?.message_id ?? null
}

export async function editTelegramMessage(messageId: number, text: string, status: 'cooking' | 'completed', orderId?: number) {
  const token = getToken()
  const chatId = getChatId()
  if (!token || !chatId) return

  const reply_markup = status === 'cooking'
    ? { inline_keyboard: [[
        { text: '✅ เสร็จแล้ว', callback_data: `completed_${orderId}` },
        { text: '👨‍🍳 เปิดครัว', url: KITCHEN_URL }
      ]] }
    : { inline_keyboard: [] }

  await $fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    body: { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', reply_markup }
  })
}

export async function answerCallbackQuery(callbackQueryId: string, text: string) {
  const token = getToken()
  if (!token) return
  await $fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    body: { callback_query_id: callbackQueryId, text, show_alert: false }
  })
}
