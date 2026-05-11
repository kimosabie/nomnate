import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-notify-secret')
  if (!secret || secret !== process.env.FEEDBACK_NOTIFY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { type, message, pageUrl, userName, familyName } = await req.json()

    const typeEmoji: Record<string, string> = {
      bug: '🐛', idea: '💡', feedback: '⭐'
    }
    const typeLabel: Record<string, string> = {
      bug: 'Bug Report', idea: 'New Idea', feedback: 'General Feedback'
    }

    const emoji = typeEmoji[type] ?? '📬'
    const label = typeLabel[type] ?? 'Feedback'

    const safeMessage = escapeHtml(String(message ?? ''))
    const safeUserName = escapeHtml(String(userName ?? 'Unknown'))
    const safeFamilyName = escapeHtml(String(familyName ?? 'Unknown'))
    const safePageUrl = escapeHtml(String(pageUrl ?? ''))
    const safeLabel = escapeHtml(label)

    await resend.emails.send({
      from: 'NomNate Feedback <onboarding@resend.dev>',
      to: process.env.ADMIN_EMAIL!,
      subject: `${emoji} ${safeLabel} — NomNate`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <div style="background:#E8621A;border-radius:12px;padding:20px;margin-bottom:24px;">
            <h1 style="color:white;margin:0;font-size:24px;">${emoji} New ${safeLabel}</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">NomNate Feedback</p>
          </div>
          <div style="background:#FFF9F6;border:1px solid #F5D5C0;border-radius:12px;padding:20px;margin-bottom:16px;">
            <h2 style="color:#1A1A1A;font-size:16px;margin:0 0 12px;">Message</h2>
            <p style="color:#444;font-size:15px;line-height:1.6;margin:0;">${safeMessage}</p>
          </div>
          <div style="background:#f9f9f9;border-radius:12px;padding:16px;margin-bottom:24px;">
            <table style="width:100%;font-size:13px;color:#666;">
              <tr><td style="padding:4px 0;font-weight:600;width:120px;">Type</td><td>${safeLabel}</td></tr>
              <tr><td style="padding:4px 0;font-weight:600;">From</td><td>${safeUserName}</td></tr>
              <tr><td style="padding:4px 0;font-weight:600;">Family</td><td>${safeFamilyName}</td></tr>
              <tr><td style="padding:4px 0;font-weight:600;">Page</td><td>${safePageUrl}</td></tr>
            </table>
          </div>
          <div style="text-align:center;">
            <a href="https://www.nomnate.co.za/admin/feedback"
               style="background:#E8621A;color:white;padding:12px 24px;border-radius:50px;
                      text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">
              View all feedback →
            </a>
          </div>
          <p style="text-align:center;color:#aaa;font-size:12px;margin-top:24px;">
            NomNate — Family dinner, decided together
          </p>
        </div>
      `
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Resend error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
