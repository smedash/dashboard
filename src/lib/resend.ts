import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMagicLinkEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  const { data, error } = await resend.emails.send({
    from: "SME Dashboard <auth@tasketeer.com>",
    to: to,
    subject: "Dein Magic Link zum Einloggen",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">SME Dashboard</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Klicke auf den Button unten, um Dich einzuloggen. Dieser Link ist 24 Stunden gültig.
            </p>
            <a href="${url}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Jetzt einloggen
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              Falls Du diesen Link nicht angefordert hast, kannst Du diese E-Mail ignorieren.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send magic link email:", error);
    throw error;
  }

  return data;
}


