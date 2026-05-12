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

  if (data.startsWith('cooking_')) {
    const orderId = parseInt(data.replace('cooking_', ''))
    await query(`UPDATE orders SET status = 'Cooking' WHERE id = $1`, [orderId])
    const newText = originalText.replace('ออเดอร์ใหม่!', 'กำลังทำ! 🍳')
    await editTelegramMessage(messageId, newText, 'cooking', orderId)
    await answerCallbackQuery(callbackQueryId, '🍳 รับออเดอร์แล้ว!')

  } else if (data.startsWith('completed_')) {
    const orderId = parseInt(data.replace('completed_', ''))
    await query(`UPDATE orders SET status = 'Completed' WHERE id = $1`, [orderId])
    const newText = originalText.replace('กำลังทำ! 🍳', 'เสร็จแล้ว! ✅')
    await editTelegramMessage(messageId, newText, 'completed')
    await answerCallbackQuery(callbackQueryId, '✅ เสร็จแล้ว!')
  }

  return { ok: true }
})
