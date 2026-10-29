import { defineMessages } from "../config";

/** Texte der Anmeldeseiten (Login, Auth-Bestätigung, Verify) */
export const authMessages = defineMessages({
  de: {
    loading: "Wird geladen...",
    backToLogin: "Zurück zur Anmeldung",
    login: {
      subtitle: "Melde Dich an, um fortzufahren",
      emailLabel: "E-Mail Adresse",
      emailPlaceholder: "deine@email.de",
      sending: "Wird gesendet...",
      sendMagicLink: "Magic Link senden",
      hint: "Du erhältst einen Link per E-Mail zum Anmelden.",
      checkEmailTitle: "Check Deine E-Mails",
      sentTo: "Wir haben Dir einen Magic Link an",
      sentToSuffix: "gesendet.",
      useOtherEmail: "Andere E-Mail verwenden",
      errors: {
        verification:
          "Der Anmeldelink ist ungültig oder wurde bereits verwendet. Bitte fordere einen neuen Link an.",
        accessDenied:
          "Diese E-Mail-Adresse ist nicht für den Zugriff autorisiert. Bitte kontaktiere den Administrator.",
        generic: "Ein Fehler ist bei der Anmeldung aufgetreten. Bitte versuche es erneut.",
        sendFailed: "Es gab ein Problem beim Senden des Magic Links.",
        unexpected: "Ein unerwarteter Fehler ist aufgetreten.",
      },
    },
    confirm: {
      invalidLinkError: "Ungültiger Anmeldelink. Bitte fordere einen neuen Link an.",
      invalidLinkTitle: "Ungültiger Link",
      title: "Anmeldung bestätigen",
      signingInAs: "Du meldest Dich an als:",
      signingIn: "Wird angemeldet...",
      signInNow: "Jetzt anmelden",
      hint: "Klicke auf den Button, um die Anmeldung abzuschließen.",
      notYou: "Das bist nicht Du? Andere E-Mail verwenden",
    },
    verify: {
      title: "Überprüfe Dein Postfach",
      description:
        "Ein Anmeldelink wurde an Deine E-Mail-Adresse gesendet. Klicke auf den Link in der E-Mail, um Dich anzumelden.",
      tipLabel: "Tipp:",
      tip: "Schau auch im Spam-Ordner nach, falls Du die E-Mail nicht findest.",
    },
  },
  en: {
    loading: "Loading...",
    backToLogin: "Back to sign-in",
    login: {
      subtitle: "Sign in to continue",
      emailLabel: "Email address",
      emailPlaceholder: "your@email.com",
      sending: "Sending...",
      sendMagicLink: "Send magic link",
      hint: "You will receive a sign-in link by email.",
      checkEmailTitle: "Check your email",
      sentTo: "We have sent a magic link to",
      sentToSuffix: "",
      useOtherEmail: "Use a different email",
      errors: {
        verification:
          "The sign-in link is invalid or has already been used. Please request a new link.",
        accessDenied:
          "This email address is not authorized for access. Please contact the administrator.",
        generic: "An error occurred while signing in. Please try again.",
        sendFailed: "There was a problem sending the magic link.",
        unexpected: "An unexpected error occurred.",
      },
    },
    confirm: {
      invalidLinkError: "Invalid sign-in link. Please request a new link.",
      invalidLinkTitle: "Invalid link",
      title: "Confirm sign-in",
      signingInAs: "You are signing in as:",
      signingIn: "Signing in...",
      signInNow: "Sign in now",
      hint: "Click the button to complete the sign-in.",
      notYou: "Not you? Use a different email",
    },
    verify: {
      title: "Check your inbox",
      description:
        "A sign-in link has been sent to your email address. Click the link in the email to sign in.",
      tipLabel: "Tip:",
      tip: "Also check your spam folder if you can't find the email.",
    },
  },
});
