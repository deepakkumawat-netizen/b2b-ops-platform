// Emails are written as plain text; this builds the HTML twin for emails
// that carry a call-to-action (e.g. the teacher details form), so the link
// shows as a big button instead of a long raw URL. The plain-text version
// is still sent alongside for mail apps that don't show HTML.
export interface MailButton {
  label: string;
  url: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buttonHtml({ label, url }: MailButton): string {
  const href = escapeHtml(url);
  return (
    `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:18px 0"><tr>` +
    `<td style="border-radius:8px;background:#4f46e5">` +
    `<a href="${href}" style="display:inline-block;padding:13px 26px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(label)}</a>` +
    `</td></tr></table>` +
    `<p style="margin:0 0 14px;font-size:12.5px;color:#6b7280">Button not working? Copy this link into your browser:<br>` +
    `<a href="${href}" style="color:#4f46e5;word-break:break-all">${href}</a></p>`
  );
}

/** Makes plain links in a line (already HTML-escaped) clickable. */
function linkify(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#4f46e5;word-break:break-all">${url}</a>`);
}

/** The line that is exactly the button's URL becomes the button; if the
 * text never shows the URL on its own line, the button goes at the end. */
export function emailHtml(text: string, button: MailButton): string {
  let placed = false;
  const parts = text.split('\n').map((line) => {
    if (!placed && line.trim() === button.url) {
      placed = true;
      return buttonHtml(button);
    }
    return `${linkify(escapeHtml(line))}<br>`;
  });
  if (!placed) parts.push(buttonHtml(button));
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111827;max-width:600px">` +
    parts.join('\n') +
    `</div>`
  );
}
