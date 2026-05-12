import { query } from '~/server/utils/db'
import { editTelegramMessage, answerCallbackQuery } from '~/server/utils/telegram'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const cbq = body?.callback_query
  if (!cbq) return { ok: true }

  const callbackQueryId: string = cbq.id
  const data: string = cbq.data || ''
  const messageId: number = cbq.message?.message_id
  const originalText: string = cbq.message?.text || ''

  // ตอบ Telegram ทันทีก่อน ไม่งั้น timeout
  if (data.startsWith('cooking_')) {
    await answerCallbackQuery(callbackQueryId, '🍳 รับออเดอร์แล้ว!')
    const orderId = parseInt(data.replace('cooking_', ''))
    await query(`UPDATE orders SET status = 'Cooking' WHERE id = $1`, [orderId])
    const newText = originalText.replace('ออเดอร์ใหม่!', 'กำลังทำ! 🍳')
    await editTelegramMessage(messageId, newText, 'cooking', orderId)

  } else if (data.startsWith('completed_')) {
    await answerCallbackQuery(callbackQueryId, '✅ เสร็จแล้ว!')
    const orderId = parseInt(data.replace('completed_', ''))
    await query(`UPDATE orders SET status = 'Completed' WHERE id = $1`, [orderId])
    const newText = originalText.replace('กำลังทำ! 🍳', 'เสร็จแล้ว! ✅')
    await editTelegramMessage(messageId, newText, 'completed')
  }

  return { ok: true }
})
