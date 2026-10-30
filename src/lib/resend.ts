import { Resend } from "resend";
import { defaultLocale, intlLocales, isLocale, type Locale } from "@/i18n/config";
import { magicLinkEmailMessages, notificationEmailMessages } from "@/i18n/messages/email";
import { contentCheckMessages } from "@/i18n/messages/content-check";
import { prisma } from "./prisma";

export const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM || "SME Dashboard <system@smedash.com>";

async function getRecipientLocale(email: string, locale?: Locale): Promise<Locale> {
  if (locale) return locale;
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { locale: true } });
    return isLocale(user?.locale) ? user.locale : defaultLocale;
  } catch (error) {
    console.error("Failed to load recipient locale:", error);
    return defaultLocale;
  }
}

export async function sendMagicLinkEmail({
  to,
  url,
  locale = defaultLocale,
}: {
  to: string;
  url: string;
  locale?: Locale;
}) {
  const t = magicLinkEmailMessages[locale];
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: t.subject,
    html: `
      <!DOCTYPE html>
      <html lang="${locale}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">SME Dashboard</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${t.intro}
            </p>
            <a href="${url}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              ${t.cta}
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              ${t.ignore}
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
  locale,
}: {
  to: string;
  briefingTitle: string;
  briefingNumber: number;
  requesterName: string;
  dashboardUrl: string;
  locale?: Locale;
}) {
  const lang = await getRecipientLocale(to, locale);
  const t = notificationEmailMessages[lang];
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: t.newBriefing.subject(briefingTitle, briefingNumber),
    html: `
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">${t.newBriefing.heading}</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${t.newBriefing.intro(requesterName)}
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;"><strong>${t.briefingNumber}</strong> #${briefingNumber}</p>
              <p style="color: #52525b; font-size: 14px; margin: 0;"><strong>${t.briefingTitle}</strong> ${briefingTitle}</p>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              ${t.newBriefing.cta}
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              ${t.autoSent}
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
  locale,
}: {
  to: string;
  taskTitle: string;
  taskDescription: string | null;
  creatorName: string;
  priority: string;
  dueDate: string | null;
  dashboardUrl: string;
  locale?: Locale;
}) {
  const lang = await getRecipientLocale(to, locale);
  const t = notificationEmailMessages[lang];

  const priorityColors: Record<string, string> = {
    low: "#64748b",
    medium: "#3b82f6",
    high: "#f97316",
    urgent: "#ef4444",
  };

  const priorityLabel = t.taskPriorities[priority] || priority;
  const priorityColor = priorityColors[priority] || "#3b82f6";

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: t.taskAssignment.subject(taskTitle),
    html: `
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">${t.taskAssignment.heading}</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${t.taskAssignment.intro(creatorName)}
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #18181b; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">${taskTitle}</p>
              ${taskDescription ? `<p style="color: #52525b; font-size: 14px; margin: 0 0 12px 0;">${taskDescription}</p>` : ""}
              <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <span style="display: inline-block; padding: 4px 8px; background-color: ${priorityColor}20; color: ${priorityColor}; font-size: 12px; border-radius: 4px; font-weight: 500;">
                  ${t.taskAssignment.priority(priorityLabel)}
                </span>
                ${dueDate ? `<span style="display: inline-block; padding: 4px 8px; background-color: #e2e8f0; color: #475569; font-size: 12px; border-radius: 4px;">${t.taskAssignment.due(new Date(dueDate).toLocaleDateString(intlLocales[lang]))}</span>` : ""}
              </div>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              ${t.taskAssignment.cta}
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              ${t.autoSent}
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

export async function sendTaskCommentNotification({
  to,
  taskTitle,
  commentText,
  authorName,
  dashboardUrl,
  locale,
}: {
  to: string;
  taskTitle: string;
  commentText: string;
  authorName: string;
  dashboardUrl: string;
  locale?: Locale;
}) {
  const lang = await getRecipientLocale(to, locale);
  const t = notificationEmailMessages[lang];

  // Kommentar kürzen wenn zu lang
  const truncatedComment = commentText.length > 300 
    ? commentText.substring(0, 300) + "..." 
    : commentText;

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: t.taskComment.subject(taskTitle),
    html: `
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">${t.taskComment.heading}</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${t.taskComment.intro(authorName, taskTitle)}
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
              <p style="color: #52525b; font-size: 14px; margin: 0; white-space: pre-wrap;">${truncatedComment}</p>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              ${t.taskComment.cta}
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              ${t.autoSent}
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send task comment notification email:", error);
    throw error;
  }

  return data;
}

export async function sendBriefingCompletedNotification({
  to,
  briefingTitle,
  briefingNumber,
  dashboardUrl,
  locale,
}: {
  to: string;
  briefingTitle: string;
  briefingNumber: number;
  dashboardUrl: string;
  locale?: Locale;
}) {
  const lang = await getRecipientLocale(to, locale);
  const t = notificationEmailMessages[lang];
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: t.briefingCompleted.subject(briefingTitle, briefingNumber),
    html: `
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background-color: #10b981; border-radius: 50%; padding: 12px;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0; text-align: center;">${t.briefingCompleted.heading}</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
              ${t.briefingCompleted.intro}
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;"><strong>${t.briefingNumber}</strong> #${briefingNumber}</p>
              <p style="color: #52525b; font-size: 14px; margin: 0;"><strong>${t.briefingTitle}</strong> ${briefingTitle}</p>
            </div>
            <p style="color: #52525b; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
              ${t.briefingCompleted.body}
            </p>
            <div style="text-align: center;">
              <a href="${dashboardUrl}" style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                ${t.briefingCompleted.cta}
              </a>
            </div>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
              ${t.autoSent}
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send briefing completed notification email:", error);
    throw error;
  }

  return data;
}

// ===== Ticket Notifications =====

export async function sendTicketAssignmentNotification({
  to,
  ticketTitle,
  ticketType,
  priority,
  creatorName,
  dashboardUrl,
  locale,
}: {
  to: string;
  ticketTitle: string;
  ticketType: string;
  priority: string;
  creatorName: string;
  dashboardUrl: string;
  locale?: Locale;
}) {
  const lang = await getRecipientLocale(to, locale);
  const t = notificationEmailMessages[lang];

  const priorityColors: Record<string, string> = {
    low: "#64748b",
    medium: "#3b82f6",
    high: "#ef4444",
  };

  const typeLabel = t.ticketTypes[ticketType] || ticketType;
  const priorityLabel = t.ticketPriorities[priority] || priority;
  const priorityColor = priorityColors[priority] || "#3b82f6";

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: t.ticketAssignment.subject(ticketTitle),
    html: `
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">${t.ticketAssignment.heading}</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${t.ticketAssignment.intro(creatorName)}
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #18181b; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">${ticketTitle}</p>
              <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <span style="display: inline-block; padding: 4px 8px; background-color: #e2e8f0; color: #475569; font-size: 12px; border-radius: 4px;">
                  ${t.ticketAssignment.type(typeLabel)}
                </span>
                <span style="display: inline-block; padding: 4px 8px; background-color: ${priorityColor}20; color: ${priorityColor}; font-size: 12px; border-radius: 4px; font-weight: 500;">
                  ${t.ticketAssignment.priority(priorityLabel)}
                </span>
              </div>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              ${t.ticketAssignment.cta}
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              ${t.autoSent}
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send ticket assignment notification email:", error);
    throw error;
  }

  return data;
}

export async function sendTicketUpdateNotification({
  to,
  ticketTitle,
  updateType,
  updateDetails,
  statusChange,
  updaterName,
  dashboardUrl,
  locale,
}: {
  to: string;
  ticketTitle: string;
  updateType: string; // "status", "comment", "assignee", "general"
  updateDetails?: string;
  statusChange?: { from: string; to: string };
  updaterName: string;
  dashboardUrl: string;
  locale?: Locale;
}) {
  const lang = await getRecipientLocale(to, locale);
  const t = notificationEmailMessages[lang];

  const subjectPrefix = t.ticketUpdate.types[updateType] || t.ticketUpdate.fallbackType;
  const details = statusChange
    ? t.ticketUpdate.statusChanged(
        t.ticketStatuses[statusChange.from] || statusChange.from,
        t.ticketStatuses[statusChange.to] || statusChange.to
      )
    : updateDetails ?? t.ticketUpdate.generalDetails;

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: `${subjectPrefix}: ${ticketTitle}`,
    html: `
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">${subjectPrefix}</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${t.ticketUpdate.intro(updaterName, ticketTitle)}
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
              <p style="color: #52525b; font-size: 14px; margin: 0; white-space: pre-wrap;">${details}</p>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              ${t.ticketUpdate.cta}
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              ${t.autoSent}
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send ticket update notification email:", error);
    throw error;
  }

  return data;
}

export async function sendWelcomeEmail({
  to,
  invitedBy,
  loginUrl,
  locale,
}: {
  to: string;
  invitedBy: { name?: string | null; email: string };
  loginUrl: string;
  locale?: Locale;
}) {
  const lang = await getRecipientLocale(to, locale);
  const t = notificationEmailMessages[lang];
  const invitedByName = invitedBy.name || invitedBy.email;
  
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: t.welcome.subject,
    html: `
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">${t.welcome.heading}</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${t.welcome.invited(invitedByName)}
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${t.welcome.access(to)}
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${t.welcome.howTo}
            </p>
            <a href="${loginUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-bottom: 24px;">
              ${t.welcome.cta}
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0; border-top: 1px solid #e4e4e7; padding-top: 24px;">
              ${t.welcome.questions(invitedByName)}
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

export async function sendSearchIntentCompletedNotification({
  to,
  totalKeywords,
  processedKeywords,
  property,
  dashboardUrl,
  locale,
}: {
  to: string;
  totalKeywords: number;
  processedKeywords: number;
  property: string;
  dashboardUrl: string;
  locale?: Locale;
}) {
  const lang = await getRecipientLocale(to, locale);
  const t = notificationEmailMessages[lang];
  const intlLocale = intlLocales[lang];
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: t.searchIntent.subject(processedKeywords.toLocaleString(intlLocale)),
    html: `
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">${t.searchIntent.heading}</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              ${t.searchIntent.intro(property)}
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0;">
              <tr>
                <td style="color: #71717a; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e4e4e7;">${t.keywordJob.totalKeywords}</td>
                <td style="color: #18181b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e4e4e7; text-align: right; font-weight: 600;">${totalKeywords.toLocaleString(intlLocale)}</td>
              </tr>
              <tr>
                <td style="color: #71717a; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e4e4e7;">${t.keywordJob.processed}</td>
                <td style="color: #18181b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e4e4e7; text-align: right; font-weight: 600;">${processedKeywords.toLocaleString(intlLocale)}</td>
              </tr>
              <tr>
                <td style="color: #71717a; font-size: 14px; padding: 8px 0;">${t.searchIntent.categories}</td>
                <td style="color: #18181b; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">I / N / C / T</td>
              </tr>
            </table>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #7c3aed; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-bottom: 24px;">
              ${t.keywordJob.openQueries}
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0; border-top: 1px solid #e4e4e7; padding-top: 24px;">
              ${t.searchIntent.footer}
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send Search Intent notification:", error);
    throw error;
  }

  return data;
}

export async function sendGoogleTrendsCompletedNotification({
  to,
  totalKeywords,
  processedKeywords,
  property,
  dashboardUrl,
  locale,
}: {
  to: string;
  totalKeywords: number;
  processedKeywords: number;
  property: string;
  dashboardUrl: string;
  locale?: Locale;
}) {
  const lang = await getRecipientLocale(to, locale);
  const t = notificationEmailMessages[lang];
  const intlLocale = intlLocales[lang];
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: t.googleTrends.subject(processedKeywords),
    html: `
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">${t.googleTrends.heading}</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              ${t.googleTrends.intro(property)}
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0;">
              <tr>
                <td style="color: #71717a; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e4e4e7;">${t.keywordJob.totalKeywords}</td>
                <td style="color: #18181b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e4e4e7; text-align: right; font-weight: 600;">${totalKeywords.toLocaleString(intlLocale)}</td>
              </tr>
              <tr>
                <td style="color: #71717a; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e4e4e7;">${t.keywordJob.processed}</td>
                <td style="color: #18181b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e4e4e7; text-align: right; font-weight: 600;">${processedKeywords.toLocaleString(intlLocale)}</td>
              </tr>
              <tr>
                <td style="color: #71717a; font-size: 14px; padding: 8px 0;">${t.googleTrends.locationLanguage}</td>
                <td style="color: #18181b; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">${t.googleTrends.locationLanguageValue}</td>
              </tr>
            </table>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-bottom: 24px;">
              ${t.keywordJob.openQueries}
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0; border-top: 1px solid #e4e4e7; padding-top: 24px;">
              ${t.googleTrends.footer}
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send Google Trends notification:", error);
    throw error;
  }

  return data;
}

function emailShell(lang: Locale, title: string, bodyHtml: string, ctaLabel: string, ctaUrl: string) {
  return `
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">${title}</h1>
            ${bodyHtml}
            <a href="${ctaUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              ${ctaLabel}
            </a>
          </div>
        </body>
      </html>
    `;
}

function reviewStatusLabel(lang: Locale, status: string) {
  return contentCheckMessages[lang].statuses[status] ?? status;
}

export async function sendContentReviewNotification({
  to,
  articleTitle,
  newStatus,
  changedByName,
  dashboardUrl,
  locale,
}: {
  to: string;
  articleTitle: string;
  newStatus: string;
  changedByName: string;
  dashboardUrl: string;
  locale?: Locale;
}) {
  const lang = await getRecipientLocale(to, locale);
  const t = notificationEmailMessages[lang];
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: t.contentReview.subject(articleTitle),
    html: emailShell(
      lang,
      t.contentReview.heading,
      `<p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        ${t.contentReview.body(changedByName, articleTitle, reviewStatusLabel(lang, newStatus))}
      </p>`,
      t.contentReview.cta,
      dashboardUrl
    ),
  });

  if (error) {
    console.error("Failed to send content review notification:", error);
    throw error;
  }

  return data;
}

export async function sendRevisionRequestNotification({
  to,
  articleTitle,
  currentStatus,
  requestedByName,
  unresolvedCount,
  dashboardUrl,
  locale,
}: {
  to: string;
  articleTitle: string;
  currentStatus: string;
  requestedByName: string;
  unresolvedCount: number;
  dashboardUrl: string;
  locale?: Locale;
}) {
  const lang = await getRecipientLocale(to, locale);
  const t = notificationEmailMessages[lang];
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: t.revisionRequest.subject(articleTitle),
    html: emailShell(
      lang,
      t.revisionRequest.heading,
      `<p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        ${t.revisionRequest.body(requestedByName, articleTitle, unresolvedCount, reviewStatusLabel(lang, currentStatus))}
      </p>`,
      t.revisionRequest.cta,
      dashboardUrl
    ),
  });

  if (error) {
    console.error("Failed to send revision request notification:", error);
    throw error;
  }

  return data;
}
