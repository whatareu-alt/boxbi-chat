import type { Bindings } from '../types';

// ─── Email helper (Resend.com with console fallback) ─────────────────────────

export async function sendEmail(env: Bindings, to: string, subject: string, html: string): Promise<void> {
    if (!env.RESEND_API_KEY) {
        console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
        return;
    }
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Boxbi <noreply@boxbi.online>', to: [to], subject, html }),
    });
    if (!res.ok) console.error('[EMAIL] Resend error:', await res.text());
}

export function otpEmailHtml(otp: string, purpose: string): string {
    return `<div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#6366f1">Boxbi Messenger</h2>
        <p>${purpose}</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:24px;text-align:center;font-size:32px;letter-spacing:8px;font-weight:bold;color:#111">${otp}</div>
        <p style="color:#6b7280;font-size:13px">This code expires in 5 minutes. Do not share it with anyone.</p>
    </div>`;
}
