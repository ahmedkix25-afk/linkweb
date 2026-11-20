import { NextRequest, NextResponse } from 'next/server';

interface OrderNotificationPayload {
  orderNumber: string;
  customerName: string;
  phone: string;
  governorate: string;
  address: string;
  productName: string;
  productSlug: string;
  quantity: number;
  totalPrice: number;
  currency: string;
  notes?: string;
  orderTime?: string;
  isTest?: boolean;
}

export async function GET() {
  return NextResponse.json({
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    email: Boolean(process.env.RESEND_API_KEY && process.env.ADMIN_NOTIFICATION_EMAIL),
    webhook: Boolean(process.env.ORDER_WEBHOOK_URL),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<OrderNotificationPayload>;

    if (!body.customerName || !body.phone || !body.productName) {
      return NextResponse.json(
        { ok: false, error: 'Missing required notification fields.' },
        { status: 400 }
      );
    }

    const orderTime =
      body.orderTime ||
      new Intl.DateTimeFormat('ar-EG', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date());

    const totalFormatted = `${new Intl.NumberFormat('en-US').format(Number(body.totalPrice || 0))} ${body.currency || 'ج.م'}`;
    const header = body.isTest ? '🔔 إشعار تجريبي — نظام صفحات البيع' : '🛒 طلب جديد — الدفع عند الاستلام';

    const textMessage = [
      header,
      `رقم الطلب: ${body.orderNumber || 'TEST'}`,
      `المنتج: ${body.productName}`,
      `الكمية: ${body.quantity || 1}`,
      `الإجمالي: ${totalFormatted}`,
      `————————————`,
      `العميل: ${body.customerName}`,
      `الموبايل: ${body.phone}`,
      `المحافظة: ${body.governorate || '-'}`,
      `العنوان: ${body.address || '-'}`,
      body.notes ? `ملاحظات: ${body.notes}` : null,
      `وقت الطلب: ${orderTime}`,
    ]
      .filter(Boolean)
      .join('\n');

    const results: Record<string, { configured: boolean; sent: boolean; error?: string }> = {
      telegram: { configured: false, sent: false },
      email: { configured: false, sent: false },
      webhook: { configured: false, sent: false },
    };

    // 1. Telegram Bot Notification
    const tgToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const tgChatId = process.env.TELEGRAM_CHAT_ID?.trim();
    if (tgToken && tgChatId) {
      results.telegram.configured = true;
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: textMessage,
          }),
        });
        const tgJson = (await tgRes.json().catch(() => ({}))) as {
          ok?: boolean;
          description?: string;
        };
        if (tgRes.ok && tgJson.ok !== false) {
          results.telegram.sent = true;
        } else {
          results.telegram.error = tgJson.description || `Telegram HTTP ${tgRes.status}`;
        }
      } catch (err) {
        results.telegram.error = err instanceof Error ? err.message : 'Telegram request failed';
      }
    }

    // 2. Resend Email Notification
    const resendKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'orders@resend.dev';
    if (resendKey && adminEmail) {
      results.email.configured = true;
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [adminEmail],
            subject: `${body.isTest ? '[تجربة] ' : ''}طلب جديد: ${body.productName} (${totalFormatted})`,
            text: textMessage,
          }),
        });
        if (emailRes.ok) {
          results.email.sent = true;
        } else {
          results.email.error = `Email HTTP ${emailRes.status}`;
        }
      } catch (err) {
        results.email.error = err instanceof Error ? err.message : 'Email request failed';
      }
    }

    // 3. Generic Webhook (WhatsApp Cloud Bridge / Make / Zapier)
    const webhookUrl = process.env.ORDER_WEBHOOK_URL;
    if (webhookUrl) {
      results.webhook.configured = true;
      try {
        const whRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            orderTime,
            formattedMessage: textMessage,
          }),
        });
        if (whRes.ok) {
          results.webhook.sent = true;
        } else {
          results.webhook.error = `Webhook HTTP ${whRes.status}`;
        }
      } catch (err) {
        results.webhook.error = err instanceof Error ? err.message : 'Webhook request failed';
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 500 }
    );
  }
}
