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
    from: "SME Dashboard <mail@tasketeer.com>",
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

export async function sendNewBriefingNotification({
  to,
  briefingTitle,
  briefingNumber,
  requesterName,
  dashboardUrl,
}: {
  to: string;
  briefingTitle: string;
  briefingNumber: number;
  requesterName: string;
  dashboardUrl: string;
}) {
  const { data, error } = await resend.emails.send({
    from: "SME Dashboard <mail@tasketeer.com>",
    to: to,
    subject: `Neue Briefing-Bestellung: ${briefingTitle} (#${briefingNumber})`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">Neue Briefing-Bestellung</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Ein neues Briefing wurde von <strong>${requesterName}</strong> bestellt.
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;"><strong>Briefing-Nr.:</strong> #${briefingNumber}</p>
              <p style="color: #52525b; font-size: 14px; margin: 0;"><strong>Titel:</strong> ${briefingTitle}</p>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Briefing ansehen
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              Diese E-Mail wurde automatisch vom SME Dashboard versendet.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send briefing notification email:", error);
    throw error;
  }

  return data;
}

export async function sendTaskAssignmentNotification({
  to,
  taskTitle,
  taskDescription,
  creatorName,
  priority,
  dueDate,
  dashboardUrl,
}: {
  to: string;
  taskTitle: string;
  taskDescription: string | null;
  creatorName: string;
  priority: string;
  dueDate: string | null;
  dashboardUrl: string;
}) {
  const priorityLabels: Record<string, string> = {
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
    urgent: "Dringend",
  };
  
  const priorityColors: Record<string, string> = {
    low: "#64748b",
    medium: "#3b82f6",
    high: "#f97316",
    urgent: "#ef4444",
  };

  const priorityLabel = priorityLabels[priority] || priority;
  const priorityColor = priorityColors[priority] || "#3b82f6";

  const { data, error } = await resend.emails.send({
    from: "SME Dashboard <mail@tasketeer.com>",
    to: to,
    subject: `Neuer Task zugewiesen: ${taskTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">Neuer Task zugewiesen</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Dir wurde ein neuer Task von <strong>${creatorName}</strong> zugewiesen.
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #18181b; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">${taskTitle}</p>
              ${taskDescription ? `<p style="color: #52525b; font-size: 14px; margin: 0 0 12px 0;">${taskDescription}</p>` : ""}
              <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <span style="display: inline-block; padding: 4px 8px; background-color: ${priorityColor}20; color: ${priorityColor}; font-size: 12px; border-radius: 4px; font-weight: 500;">
                  Priorität: ${priorityLabel}
                </span>
                ${dueDate ? `<span style="display: inline-block; padding: 4px 8px; background-color: #e2e8f0; color: #475569; font-size: 12px; border-radius: 4px;">Fällig: ${new Date(dueDate).toLocaleDateString("de-DE")}</span>` : ""}
              </div>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Task ansehen
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              Diese E-Mail wurde automatisch vom SME Dashboard versendet.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send task assignment notification email:", error);
    throw error;
  }

  return data;
}

export async function sendWelcomeEmail({
  to,
  invitedBy,
  loginUrl,
}: {
  to: string;
  invitedBy: { name?: string | null; email: string };
  loginUrl: string;
}) {
  const invitedByName = invitedBy.name || invitedBy.email;
  
  const { data, error } = await resend.emails.send({
    from: "SME Dashboard <mail@tasketeer.com>",
    to: to,
    subject: "Willkommen im SME Dashboard",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">Willkommen im SME Dashboard</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Du wurdest von <strong>${invitedByName}</strong> zum SME Dashboard eingeladen.
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Ab sofort kannst Du Dich mit Deiner E-Mail-Adresse <strong>${to}</strong> im SME Dashboard anmelden.
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Klicke auf den Button unten, um zur Anmeldeseite zu gelangen. Du erhältst dann einen Magic Link per E-Mail, mit dem Du Dich einloggen kannst.
            </p>
            <a href="${loginUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-bottom: 24px;">
              Zur Anmeldeseite
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0; border-top: 1px solid #e4e4e7; padding-top: 24px;">
              Falls Du Fragen hast, wende Dich bitte an ${invitedByName}.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send welcome email:", error);
    throw error;
  }

  return data;
}


