import { defineMessages } from "../config";

export const magicLinkEmailMessages = defineMessages({
  de: {
    subject: "Dein Magic Link zum Einloggen",
    intro: "Klicke auf den Button unten, um Dich einzuloggen. Dieser Link ist 24 Stunden gültig.",
    cta: "Jetzt einloggen",
    ignore: "Falls Du diesen Link nicht angefordert hast, kannst Du diese E-Mail ignorieren.",
  },
  en: {
    subject: "Your magic link to sign in",
    intro: "Click the button below to sign in. This link is valid for 24 hours.",
    cta: "Sign in now",
    ignore: "If you didn't request this link, you can safely ignore this email.",
  },
});

export const notificationEmailMessages = defineMessages({
  de: {
    autoSent: "Diese E-Mail wurde automatisch vom SME Dashboard versendet.",
    briefingNumber: "Briefing-Nr.:",
    briefingTitle: "Titel:",
    newBriefing: {
      subject: (title: string, number: number) => `Neue Briefing-Bestellung: ${title} (#${number})`,
      heading: "Neue Briefing-Bestellung",
      intro: (requester: string) => `Ein neues Briefing wurde von <strong>${requester}</strong> bestellt.`,
      cta: "Briefing ansehen",
    },
    briefingCompleted: {
      subject: (title: string, number: number) => `Briefing fertiggestellt: ${title} (#${number})`,
      heading: "Briefing fertiggestellt!",
      intro: "Dein Briefing wurde fertiggestellt und steht zum Download bereit.",
      body: "Du kannst das Briefing jetzt als PDF herunterladen oder direkt im Dashboard ansehen.",
      cta: "Briefing ansehen & PDF downloaden",
    },
    taskAssignment: {
      subject: (title: string) => `Neuer Task zugewiesen: ${title}`,
      heading: "Neuer Task zugewiesen",
      intro: (creator: string) => `Dir wurde ein neuer Task von <strong>${creator}</strong> zugewiesen.`,
      priority: (label: string) => `Priorität: ${label}`,
      due: (date: string) => `Fällig: ${date}`,
      cta: "Task ansehen",
    },
    taskComment: {
      subject: (title: string) => `Neuer Kommentar: ${title}`,
      heading: "Neuer Kommentar",
      intro: (author: string, title: string) =>
        `<strong>${author}</strong> hat einen Kommentar zum Task <strong>${title}</strong> hinzugefügt:`,
      cta: "Task ansehen",
    },
    taskPriorities: {
      low: "Niedrig",
      medium: "Mittel",
      high: "Hoch",
      urgent: "Dringend",
    } as Record<string, string>,
    ticketAssignment: {
      subject: (title: string) => `Ticket zugewiesen: ${title}`,
      heading: "Ticket zugewiesen",
      intro: (creator: string) => `Dir wurde ein Ticket von <strong>${creator}</strong> zugewiesen.`,
      type: (label: string) => `Typ: ${label}`,
      priority: (label: string) => `Priorität: ${label}`,
      cta: "Ticket ansehen",
    },
    ticketTypes: {
      bug: "Bug",
      feature: "Feature-Wunsch",
    } as Record<string, string>,
    ticketPriorities: {
      low: "Niedrig",
      medium: "Mittel",
      high: "Hoch",
    } as Record<string, string>,
    ticketStatuses: {
      open: "Offen",
      in_progress: "In Bearbeitung",
      closed: "Geschlossen",
    } as Record<string, string>,
    ticketUpdate: {
      types: {
        status: "Status geändert",
        comment: "Neuer Kommentar",
        assignee: "Zuweisung geändert",
        general: "Ticket aktualisiert",
      } as Record<string, string>,
      fallbackType: "Ticket aktualisiert",
      intro: (updater: string, title: string) =>
        `<strong>${updater}</strong> hat das Ticket <strong>${title}</strong> aktualisiert.`,
      generalDetails: "Das Ticket wurde aktualisiert.",
      statusChanged: (from: string, to: string) => `Status geändert: ${from} → ${to}`,
      cta: "Ticket ansehen",
    },
    welcome: {
      subject: "Willkommen im SME Dashboard",
      heading: "Willkommen im SME Dashboard",
      invited: (by: string) => `Du wurdest von <strong>${by}</strong> zum SME Dashboard eingeladen.`,
      access: (email: string) =>
        `Ab sofort kannst Du Dich mit Deiner E-Mail-Adresse <strong>${email}</strong> im SME Dashboard anmelden.`,
      howTo:
        "Klicke auf den Button unten, um zur Anmeldeseite zu gelangen. Du erhältst dann einen Magic Link per E-Mail, mit dem Du Dich einloggen kannst.",
      cta: "Zur Anmeldeseite",
      questions: (by: string) => `Falls Du Fragen hast, wende Dich bitte an ${by}.`,
    },
    keywordJob: {
      totalKeywords: "Keywords gesamt",
      processed: "Erfolgreich verarbeitet",
      openQueries: "Suchanfragen öffnen",
    },
    searchIntent: {
      subject: (count: string) => `Search Intent fertig – ${count} Keywords verarbeitet`,
      heading: "Search Intent geladen",
      intro: (property: string) =>
        `Die Search Intent Daten für <strong>${property}</strong> wurden erfolgreich verarbeitet.`,
      categories: "Kategorien",
      footer: 'Die Intent-Daten sind jetzt auf der Suchanfragen-Seite verfügbar (Spalte "Intent") und können gefiltert werden.',
    },
    googleTrends: {
      subject: (count: number) => `Google Trends fertig – ${count} Keywords verarbeitet`,
      heading: "Google Trends geladen",
      intro: (property: string) =>
        `Die Google Trends Daten für <strong>${property}</strong> wurden erfolgreich verarbeitet.`,
      locationLanguage: "Location / Sprache",
      locationLanguageValue: "Schweiz / Deutsch",
      footer: "Die Trends-Daten sind jetzt auf der Suchanfragen-Seite verfügbar und werden im Excel-Export mit ausgegeben.",
    },
    contentReview: {
      subject: (title: string) => `Content-Check: ${title}`,
      heading: "Content-Check",
      body: (by: string, title: string, status: string) =>
        `<strong>${by}</strong> hat den Artikel <strong>${title}</strong> auf den Status <strong>${status}</strong> gesetzt.`,
      cta: "Im Content-Check öffnen",
    },
    revisionRequest: {
      subject: (title: string) => `Überarbeitung angefordert: ${title}`,
      heading: "Überarbeitung angefordert",
      body: (by: string, title: string, count: number, status: string) =>
        `<strong>${by}</strong> hat eine Überarbeitung für <strong>${title}</strong> angefordert
        (${count} offene Kommentare, aktueller Status: ${status}).`,
      cta: "Artikel öffnen",
    },
  },
  en: {
    autoSent: "This email was sent automatically by the SME Dashboard.",
    briefingNumber: "Briefing no.:",
    briefingTitle: "Title:",
    newBriefing: {
      subject: (title, number) => `New briefing order: ${title} (#${number})`,
      heading: "New briefing order",
      intro: (requester) => `A new briefing was ordered by <strong>${requester}</strong>.`,
      cta: "View briefing",
    },
    briefingCompleted: {
      subject: (title, number) => `Briefing completed: ${title} (#${number})`,
      heading: "Briefing completed!",
      intro: "Your briefing has been completed and is ready for download.",
      body: "You can now download the briefing as a PDF or view it directly in the dashboard.",
      cta: "View briefing & download PDF",
    },
    taskAssignment: {
      subject: (title) => `New task assigned: ${title}`,
      heading: "New task assigned",
      intro: (creator) => `<strong>${creator}</strong> assigned a new task to you.`,
      priority: (label) => `Priority: ${label}`,
      due: (date) => `Due: ${date}`,
      cta: "View task",
    },
    taskComment: {
      subject: (title) => `New comment: ${title}`,
      heading: "New comment",
      intro: (author, title) => `<strong>${author}</strong> added a comment to the task <strong>${title}</strong>:`,
      cta: "View task",
    },
    taskPriorities: {
      low: "Low",
      medium: "Medium",
      high: "High",
      urgent: "Urgent",
    },
    ticketAssignment: {
      subject: (title) => `Ticket assigned: ${title}`,
      heading: "Ticket assigned",
      intro: (creator) => `<strong>${creator}</strong> assigned a ticket to you.`,
      type: (label) => `Type: ${label}`,
      priority: (label) => `Priority: ${label}`,
      cta: "View ticket",
    },
    ticketTypes: {
      bug: "Bug",
      feature: "Feature request",
    },
    ticketPriorities: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    ticketStatuses: {
      open: "Open",
      in_progress: "In progress",
      closed: "Closed",
    },
    ticketUpdate: {
      types: {
        status: "Status changed",
        comment: "New comment",
        assignee: "Assignment changed",
        general: "Ticket updated",
      },
      fallbackType: "Ticket updated",
      intro: (updater, title) => `<strong>${updater}</strong> updated the ticket <strong>${title}</strong>.`,
      generalDetails: "The ticket has been updated.",
      statusChanged: (from, to) => `Status changed: ${from} → ${to}`,
      cta: "View ticket",
    },
    welcome: {
      subject: "Welcome to the SME Dashboard",
      heading: "Welcome to the SME Dashboard",
      invited: (by) => `<strong>${by}</strong> has invited you to the SME Dashboard.`,
      access: (email) => `You can now sign in to the SME Dashboard with your email address <strong>${email}</strong>.`,
      howTo:
        "Click the button below to go to the sign-in page. You will then receive a magic link by email that lets you sign in.",
      cta: "Go to sign-in page",
      questions: (by) => `If you have any questions, please contact ${by}.`,
    },
    keywordJob: {
      totalKeywords: "Total keywords",
      processed: "Successfully processed",
      openQueries: "Open queries",
    },
    searchIntent: {
      subject: (count) => `Search intent done – ${count} keywords processed`,
      heading: "Search intent loaded",
      intro: (property) => `The search intent data for <strong>${property}</strong> has been processed successfully.`,
      categories: "Categories",
      footer: 'The intent data is now available on the queries page ("Intent" column) and can be filtered.',
    },
    googleTrends: {
      subject: (count) => `Google Trends done – ${count} keywords processed`,
      heading: "Google Trends loaded",
      intro: (property) => `The Google Trends data for <strong>${property}</strong> has been processed successfully.`,
      locationLanguage: "Location / language",
      locationLanguageValue: "Switzerland / German",
      footer: "The trends data is now available on the queries page and is included in the Excel export.",
    },
    contentReview: {
      subject: (title) => `Content check: ${title}`,
      heading: "Content check",
      body: (by, title, status) =>
        `<strong>${by}</strong> set the article <strong>${title}</strong> to the status <strong>${status}</strong>.`,
      cta: "Open in content check",
    },
    revisionRequest: {
      subject: (title) => `Revision requested: ${title}`,
      heading: "Revision requested",
      body: (by, title, count, status) =>
        `<strong>${by}</strong> requested a revision for <strong>${title}</strong>
        (${count} open comments, current status: ${status}).`,
      cta: "Open article",
    },
  },
});
