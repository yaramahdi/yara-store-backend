const WEBHOOK_URL = process.env.N8N_ORDER_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.N8N_ORDER_WEBHOOK_SECRET;

async function notifyN8nOrderCreated(order) {
  if (!WEBHOOK_URL) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const payload = {
      event: 'order.created',
      order: order.toObject ? order.toObject() : order,
    };

    const headers = { 'Content-Type': 'application/json' };
    if (WEBHOOK_SECRET) headers['x-yara-webhook-secret'] = WEBHOOK_SECRET;

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`n8n webhook returned HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { notifyN8nOrderCreated };
