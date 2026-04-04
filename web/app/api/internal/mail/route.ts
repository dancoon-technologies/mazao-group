import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

type MailBody = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
};

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function getBearerSecret(request: Request): string | null {
  const h = request.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return null;
  return h.slice('Bearer '.length).trim() || null;
}

export async function POST(request: Request) {
  const expected = process.env.INTERNAL_MAIL_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: 'Mail API is not configured (INTERNAL_MAIL_SECRET).' },
      { status: 503 }
    );
  }

  const token = getBearerSecret(request);
  if (!token || !safeEqual(token, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: MailBody;
  try {
    body = (await request.json()) as MailBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { to, subject, text, html, from, replyTo } = body;
  if (!to || !subject || text === undefined || text === null) {
    return NextResponse.json(
      { error: 'Missing required fields: to, subject, text' },
      { status: 400 }
    );
  }

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) {
    return NextResponse.json(
      { error: 'SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS).' },
      { status: 503 }
    );
  }

  const port = Number(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1';
  const fromAddr =
    (from || process.env.MAIL_FROM || process.env.NOTIFICATION_PROVIDER_FROM || user).trim();

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const recipients = Array.isArray(to) ? to : [to];

  try {
    await transporter.sendMail({
      from: fromAddr,
      to: recipients,
      subject,
      text,
      html: html || undefined,
      replyTo: replyTo || undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Send failed';
    console.error('[internal/mail]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
