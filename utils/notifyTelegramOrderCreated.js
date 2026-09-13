const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

// يبني رسالة تيليجرام واضحة من بيانات الطلب — نفس تفاصيل فاتورة الواتساب
// بس موجّهة ليارا نفسها (إشعار داخلي وقت وصول طلب جديد)
function buildMessage(order) {
  const lines = (order.items || []).map((item) => {
    const parts = [`- ${item.name}`];
    if (item.selectedColor?.name) parts.push(`اللون: ${item.selectedColor.name}`);
    if (item.selectedSize) parts.push(`المقاس: ${item.selectedSize}`);
    parts.push(`الكمية: ${item.quantity}`);
    parts.push(`${item.price} ₪`);
    return parts.join(' | ');
  });

  let msg = `🛍️ طلب جديد #${order.orderNumber || ''}\n\n`;
  msg += `👤 ${order.customer?.name || ''}\n`;
  if (order.customer?.phone)   msg += `📞 ${order.customer.phone}\n`;
  if (order.customer?.address) msg += `📍 ${order.customer.address}\n`;
  msg += `\nالمنتجات:\n${lines.join('\n')}\n\n`;

  if (order.discountCode) {
    msg += `المجموع قبل الخصم: ${order.subtotal} ₪\n`;
    msg += `كود الخصم: ${order.discountCode} (${order.discountPercent}%-)\n`;
  }
  msg += `المجموع: ${order.totalPrice} ₪`;

  return msg;
}

async function notifyTelegramOrderCreated(order) {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: buildMessage(order),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Telegram API returned HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { notifyTelegramOrderCreated };
