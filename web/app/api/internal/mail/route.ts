import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
/** Read SMTP env at request time (not module load); avoids stale/empty values with some hosts. */
export const dynamic = 'force-dynamic';

function firstNonEmpty(...values: (string | undefined)[]): string {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return '';
}

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

  const host = process.env.SMTP_HOST?.trim() ?? '';
  const user = process.env.SMTP_USER?.trim() ?? '';
  const pass = process.env.SMTP_PASSWORD?.trim() ?? '';
  if (!host || !user || !pass) {
    const missing: string[] = [];
    if (!host) missing.push('SMTP_HOST');
    if (!user) missing.push('SMTP_USER');
    if (!pass) missing.push('SMTP_PASSWORD');
    return NextResponse.json(
      {
        error:
          'SMTP is not configured for this Next.js server process. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD on this deployment.',
        missing,
        hint:
          'If Django uses WEB_MAIL_API_URL, it must point at this app. Preview vs Production on Vercel use separate env.',
      },
      { status: 503 }
    );
  }

  const port = Number(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1';
  const fromAddr = firstNonEmpty(from, process.env.SMTP_FROM, user);

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
