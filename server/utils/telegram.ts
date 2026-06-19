const KITCHEN_URL = 'https://food-order-kohl-mu.vercel.app/kitchen'
const DISABLE_TELEGRAM = true; // ตั้งค่าเป็น false เมื่อต้องการเปิดใช้งานส่งข้อความ Telegram อีกครั้ง

function getToken() { return process.env.TELEGRAM_BOT_TOKEN }
function getChatId() { return process.env.TELEGRAM_CHAT_ID }

export async function sendTelegramOrderMessage(text: string, orderId: number): Promise<number | null> {
  if (DISABLE_TELEGRAM) return null
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

export async function editTelegramMessage(messageId: number, text: string, status: 'pending' | 'cooking' | 'completed', orderId?: number) {
  if (DISABLE_TELEGRAM) return
  const token = getToken()
  const chatId = getChatId()
  if (!token || !chatId) return

  let reply_markup = { inline_keyboard: [] as any[] }
  if (status === 'pending' && orderId) {
    reply_markup.inline_keyboard = [[
      { text: '🍳 เริ่มทำ', callback_data: `cooking_${orderId}` },
      { text: '👨‍🍳 เปิดครัว', url: KITCHEN_URL }
    ]]
  } else if (status === 'cooking' && orderId) {
    reply_markup.inline_keyboard = [[
      { text: '✅ เสร็จแล้ว', callback_data: `completed_${orderId}` },
      { text: '👨‍🍳 เปิดครัว', url: KITCHEN_URL }
    ]]
  }

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
