import { defineMessages } from "../config";

const brand = "SGsuite";
const website = "https://www.sg-suite.com";
const email = "system@sg-suite.com";
const street = "Eisenbahnstraße 1";
const city = "88677 Markdorf";
const phone = "+49 7544 5067064";

/** Absatz, Aufzählung oder Zwischenüberschrift innerhalb eines Abschnitts */
export type LegalBlock = string | { list: string[] } | { subheading: string };

export interface LegalSection {
  heading: string;
  body: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  description: string;
  intro: string;
  updated?: string;
  sections: LegalSection[];
}

/** Texte der Rechtsseiten (Impressum, Datenschutz, Nutzungsbedingungen) */
export const legalMessages = defineMessages({
  de: {
    nav: {
      back: "Zur Startseite",
      login: "Anmelden",
    },
    updatedLabel: "Stand",
    imprint: {
      title: "Impressum",
      description: `Impressum von ${brand}.`,
      intro: `Angaben gemäß den gesetzlichen Informationspflichten für das Angebot ${brand} unter ${website}.`,
      sections: [
        {
          heading: "Anbieter",
          body: [`${brand}\n${street}\n${city}\nDeutschland`, `Telefon: ${phone}\nWebsite: ${website}\nE-Mail: ${email}`],
        },
        {
          heading: "Kontakt zum Datenschutz",
          body: [
            "Anfragen zur Datenverarbeitung und zur Google-Verknüpfung richten Sie bitte an dieselbe Kontaktadresse. Die ausführliche Darstellung der Datenerhebung und -nutzung finden Sie in der Datenschutzerklärung.",
          ],
        },
      ],
    } satisfies LegalDocument,
    privacy: {
      title: "Datenschutzerklärung",
      description: `Datenschutzerklärung von ${brand}.`,
      intro: `Diese Datenschutzerklärung informiert über die Verarbeitung personenbezogener Daten bei Nutzung der Webanwendung ${brand} unter ${website}. ${brand} ist eine SEO-Arbeitsplattform für eingeladene Nutzer und kein öffentlicher Dienst.`,
      updated: "23. November 2026",
      sections: [
        {
          heading: "1. Verantwortlicher",
          body: [
            `Verantwortlicher für die Datenverarbeitung ist der Betreiber von ${brand}, erreichbar über die Website ${website} und per E-Mail an ${email}. Weitere Angaben stehen im Impressum.`,
          ],
        },
        {
          heading: "2. Zweck der Anwendung",
          body: [
            `${brand} dient der Auswertung von SEO- und Website-Kennzahlen sowie der Organisation zugehöriger Arbeitsprozesse. Dazu gehören insbesondere:`,
            {
              list: [
                "Anzeige von Suchperformance aus der Google Search Console",
                "Rankings, Keyword-, Backlink- und Monitoring-Daten externer SEO-Datendienste",
                "Aufgaben, Briefings, Redaktionsplanung, Reporting und KI-gestützte SEO-Hilfen",
              ],
            },
          ],
        },
        {
          heading: "3. Welche Daten wir erheben",
          body: [
            { subheading: "Konto und Anmeldung" },
            "Der Zugang erfolgt per Magic Link an eine zuvor freigeschaltete E-Mail-Adresse. Dabei werden E-Mail-Adresse, Zeitpunkt der Anmeldung und sitzungsbezogene Authentifizierungsdaten verarbeitet. Ein Passwort wird nicht gespeichert.",
            { subheading: "Google-Konto (OAuth)" },
            `Nutzer können ihr Google-Konto freiwillig mit ${brand} verknüpfen. In diesem Fall holt die App über Google OAuth folgende Daten ein:`,
            {
              list: [
                "Google-Nutzerkennung, Name, E-Mail-Adresse und Profilbild",
                "OAuth-Zugriffstoken und Refresh-Token zur späteren API-Nutzung",
                "Read-only-Daten der Google Search Console, insbesondere Properties, Suchanfragen, Seiten, Klicks, Impressionen, CTR, Positionen, Länder und Geräte",
              ],
            },
            `Es werden keine Schreibrechte auf Google-Konten oder Search-Console-Properties angefordert. ${brand} veröffentlicht, löscht oder verändert keine Google-Daten im Namen der Nutzer.`,
            { subheading: "Nutzungsdaten in der App" },
            "Zusätzlich können in der App selbst angelegte Arbeitsdaten gespeichert werden, zum Beispiel Aufgaben, Tickets, Briefings, hochgeladene Dateien, ausgewählte Properties, Ranking-Einstellungen oder interne Kommentare. Technische Protokolle können IP-Adresse, Browser und Zeitpunkt von Anfragen in dem für Betrieb und Sicherheit erforderlichen Umfang enthalten.",
          ],
        },
        {
          heading: "4. Zwecke der Verarbeitung",
          body: [
            `Die Daten werden ausschließlich für den Betrieb von ${brand} verwendet:`,
            {
              list: [
                "Anmeldung und Zugriffskontrolle für eingeladene Nutzer",
                `Zuordnung des Google-Kontos zum jeweiligen ${brand}-Nutzer`,
                "Anzeige und Auswertung von Search-Console-Kennzahlen",
                "Speicherung der ausgewählten Website/Property für nachfolgende Sitzungen",
                "Erfüllung interner SEO-, Content- und Projektaufgaben",
              ],
            },
            "Es findet keine Nutzung für Werbung, kein Verkauf von Daten und kein Profiling für Dritte statt.",
          ],
        },
        {
          heading: "5. Rechtsgrundlagen",
          body: [
            "Soweit die Datenschutz-Grundverordnung Anwendung findet, stützt sich die Verarbeitung insbesondere auf Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des Nutzungsvertrags bzw. der Einladung zur App) sowie auf Art. 6 Abs. 1 lit. a DSGVO, soweit Nutzer ihr Google-Konto über den OAuth-Zustimmungsbildschirm verknüpfen. Technische Betriebsdaten und notwendige Cookies beruhen auf Art. 6 Abs. 1 lit. f DSGVO bzw. § 25 Abs. 2 TDDDG (berechtigtes Interesse an sicherem Betrieb).",
          ],
        },
        {
          heading: "6. Speicherung, Empfänger und Dienste",
          body: [
            `Konto-, Token- und Arbeitsdaten werden in der für ${brand} genutzten Datenbank gespeichert und über die Hosting-Infrastruktur der App bereitgestellt. Dabei können folgende Auftragsverarbeiter bzw. Dienstleister zum Einsatz kommen:`,
            {
              list: [
                "Google Ireland Limited / Google LLC: Authentifizierung und API-Zugriff",
                "Vercel Inc.: Hosting, Serverfunktionen und Dateiablage",
                "Neon Inc.: PostgreSQL-Datenbank (Rechenzentrum Frankfurt am Main)",
                "Resend (Plus Five Five, Inc.): E-Mail-Versand für Magic Links und Benachrichtigungen",
                "DataForSEO, SEOspark, Topicloops und Conductor: Ranking-, Keyword-, SERP-, Backlink- und Monitoring-Daten",
                "Anthropic PBC, OpenAI, LLC und Google (Gemini): KI-Funktionen",
              ],
            },
            "An die SEO-Datendienste werden in der Regel nur Keywords, Domains und URLs übermittelt, keine personenbezogenen Daten der Nutzer. An die KI-Dienste werden die Inhalte übermittelt, die Nutzer für die jeweilige KI-Funktion eingeben oder auswählen. Soweit Dienstleister ihren Sitz in den USA haben, erfolgt die Übermittlung auf Grundlage des EU-U.S. Data Privacy Framework oder von EU-Standardvertragsklauseln.",
            `Google-Daten werden nur in dem Umfang abgerufen, der für die Anzeige in ${brand} erforderlich ist. Zugriffstoken werden serverseitig gespeichert, damit die App die Search Console im Auftrag des jeweiligen Nutzers erneut abfragen kann, ohne jedes Mal neu um Erlaubnis zu bitten. Mit wem Google-Nutzerdaten geteilt, übertragen oder offengelegt werden und welche Schutzmaßnahmen gelten, ist in den Abschnitten 7 und 8 beschrieben.`,
          ],
        },
        {
          heading: "7. Weitergabe, Übertragung und Offenlegung von Google-Nutzerdaten",
          body: [
            `Dieser Abschnitt beschreibt, mit wem wir Google-Nutzerdaten teilen, übertragen oder offenlegen. Wir verkaufen Google-Nutzerdaten nicht. Wir übertragen oder offenbaren Ihre Informationen nicht an Dritte zu anderen Zwecken als den hier genannten, nämlich dem Bereitstellen und Verbessern der Funktionen von ${brand}.`,
            "Google-Nutzerdaten im Sinne dieser Erklärung sind die über Google OAuth erhaltenen Angaben (Google-Nutzerkennung, Name, E-Mail-Adresse, Profilbild), OAuth-Zugriffstoken und Refresh-Token sowie die read-only Search-Console-Daten, die die App im Auftrag des Nutzers abruft.",
            "Diese Google-Nutzerdaten werden nur mit den folgenden Empfängern geteilt, übertragen oder offengelegt:",
            {
              list: [
                "Google Ireland Limited / Google LLC: Wir senden die vom Nutzer erteilten OAuth-Token an die Google-APIs zurück, um Search-Console-Daten im Auftrag des Nutzers abzurufen. Ohne diese Übertragung an Google kann die Verknüpfung nicht funktionieren.",
                `Hosting- und Datenbank-Auftragsverarbeiter: Konto-, Token- und abgerufene Google-Daten werden auf der Infrastruktur gespeichert und verarbeitet, mit der ${brand} betrieben wird: Vercel Inc. (Hosting, Serverfunktionen und Dateiablage) und Neon Inc. (PostgreSQL-Datenbank). Die Speicherung der Anwendungsdaten erfolgt in Frankfurt am Main in der AWS-Cloud. Diese Dienstleister verarbeiten die Daten ausschließlich in unserem Auftrag und nicht für eigene Zwecke.`,
                `KI-Dienstleister, nur auf ausdrückliche Nutzeranfrage: Wenn ein Nutzer in der App eine KI-Auswertung anstößt, können ausgewählte Search-Console-Kennzahlen an Anthropic PBC, OpenAI, LLC oder Google (Gemini) übertragen werden, etwa für den Superagent oder KI-Zusammenfassungen im Reporting, damit die angefragte Auswertung in ${brand} angezeigt werden kann. Diese Übertragung dient ausschließlich der jeweiligen Nutzerfunktion.`,
                `Teammitglieder desselben ${brand}-Kontos: Wenn der Kontoinhaber Properties mit eingeladenen Teammitgliedern teilt, können diese Mitglieder die zugehörigen Search-Console-Kennzahlen in der App sehen. OAuth-Token bleiben beim verknüpfenden Konto und werden nicht an Teammitglieder herausgegeben.`,
              ],
            },
            "E-Mail-Dienstleister und SEO-Datendienste erhalten keine Google-Nutzerdaten. Wir geben Google-Nutzerdaten nicht an Werbetreibende, Datenhändler, Auskunfteien oder Informationswiederverkäufer weiter. Es findet keine Nutzung oder Weitergabe für zielgerichtete, personalisierte, retargeting- oder interessenbasierte Werbung statt, ebenso keine Nutzung zur Kreditwürdigkeitsprüfung oder Kreditvergabe. Google-Nutzerdaten werden nicht verwendet, um nicht-personalisierte KI- oder ML-Modelle zu entwickeln, zu verbessern oder zu trainieren.",
          ],
        },
        {
          heading: "8. Schutzmaßnahmen für Google-Nutzerdaten und sensible Daten",
          body: [
            "Es bestehen Sicherheitsverfahren, um die Vertraulichkeit Ihrer Daten zu schützen. Wir setzen Verschlüsselung ein, um Ihre Informationen zu schützen. Sensible Daten im Sinne dieser Erklärung umfassen insbesondere OAuth-Token, Google-Profilangaben sowie die über die Google-APIs abgerufenen Search-Console-Daten.",
            "Im Einzelnen gelten folgende Schutzmaßnahmen:",
            {
              list: [
                `Verschlüsselung bei der Übertragung: Die gesamte Kommunikation mit ${brand} erfolgt über HTTPS/TLS.`,
                "Verschlüsselung bei der Speicherung: OAuth-Zugriffstoken und Refresh-Token werden serverseitig in der Datenbank gespeichert, nicht im Browser des Nutzers. Die genutzte Datenbank- und Hosting-Infrastruktur verschlüsselt Daten im Ruhezustand.",
                "Zugriffskontrolle: Nur angemeldete, eingeladene Nutzer erhalten Zugang zur App. Google-Daten einer Property sind nur für den verknüpfenden Nutzer und die vom Kontoinhaber dafür freigeschalteten Teammitglieder sichtbar. Administrative Zugriffe auf die Infrastruktur sind auf den Betrieb der Anwendung beschränkt.",
                "Datenminimierung: Es werden ausschließlich Lese-Berechtigungen (read-only) angefordert. Es gibt keine Schreibrechte auf Google-Konten oder Search-Console-Properties.",
                "Widerruf und Löschung: Nutzer können die Google-Verknüpfung in den Einstellungen jederzeit trennen. Token und verknüpfte Profildaten werden dann gelöscht oder unbrauchbar gemacht. Zusätzlich kann die Zustimmung im Google-Konto unter den Berechtigungen für Drittanbieter-Apps widerrufen werden.",
              ],
            },
          ],
        },
        {
          heading: "9. Speicherdauer und Widerruf",
          body: [
            `Kontodaten bleiben gespeichert, solange der Nutzer Zugang zu ${brand} hat. Google-Token und verknüpfte Profildaten werden gelöscht oder unbrauchbar gemacht, wenn der Nutzer die Google-Verknüpfung in den Einstellungen trennt oder sein Konto entfernt wird. Nutzer können die erteilte Google-Zustimmung zusätzlich in ihrem Google-Konto unter den Berechtigungen für Drittanbieter-Apps widerrufen. Nach einem Widerruf kann ${brand} keine Search-Console-Daten mehr laden.`,
          ],
        },
        {
          heading: "10. Rechte der betroffenen Personen",
          body: [
            `Betroffene Personen können Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch verlangen, soweit die gesetzlichen Voraussetzungen vorliegen. Anfragen richten Sie bitte an ${email}. Es besteht außerdem das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren.`,
          ],
        },
        {
          heading: "11. Keine Pflicht zur Google-Verknüpfung",
          body: [
            `Die Anmeldung bei ${brand} ist ohne Google-Konto möglich. Die Verknüpfung mit Google ist optional und nur nötig, wenn Search-Console-Daten in der App angezeigt werden sollen. Ohne diese Verknüpfung bleiben die übrigen Funktionen der Arbeitsplattform nutzbar, soweit sie keine Google-Daten voraussetzen.`,
          ],
        },
        {
          heading: "12. Cookies und lokale Speicherung",
          body: [
            `${brand} setzt ausschließlich technisch notwendige Cookies ein. Statistik-, Tracking- oder Marketing-Dienste werden nicht verwendet, deshalb ist kein Einwilligungsbanner erforderlich.`,
            { subheading: "Notwendige Cookies" },
            "Notwendige Cookies sind für Betrieb, Sicherheit und Anmeldung erforderlich (Art. 6 Abs. 1 lit. f DSGVO, § 25 Abs. 2 TDDDG). Dazu gehören:",
            {
              list: [
                "Sitzungs- und CSRF-Cookies der Anmeldung (NextAuth)",
                "Spracheinstellung der Oberfläche (locale, 12 Monate)",
              ],
            },
            { subheading: "Lokale Speicherung im Browser" },
            "In der App werden die ausgewählte Property, die Darstellungseinstellungen (z. B. helles oder dunkles Design) und einzelne Ansichtseinstellungen im lokalen Speicher des Browsers abgelegt. Diese Daten verlassen das Endgerät nicht und können über die Browser-Einstellungen jederzeit gelöscht werden.",
            "Bei inhaltlichen Änderungen dieser Erklärung aktualisieren wir diese Seite und passen das Datum oben an.",
          ],
        },
      ],
    } satisfies LegalDocument,
    terms: {
      title: "Nutzungsbedingungen",
      description: `Nutzungsbedingungen von ${brand}.`,
      intro: `Diese Nutzungsbedingungen gelten für die Website und die Webanwendung ${brand} unter ${website}. Mit dem Aufruf der öffentlichen Seiten, der Annahme einer Einladung oder der Anmeldung akzeptierst du diese Bedingungen.`,
      updated: "23. November 2026",
      sections: [
        {
          heading: "1. Anbieter",
          body: [
            `Anbieter und Vertragspartner ist der Betreiber von ${brand}, ${street}, ${city}, Deutschland, erreichbar unter ${email}. Weitere Angaben stehen im Impressum.`,
          ],
        },
        {
          heading: "2. Leistungsbeschreibung",
          body: [
            `${brand} ist eine SEO-Arbeitsplattform. Sie dient der Auswertung von Website- und Suchkennzahlen sowie der Organisation zugehöriger Arbeitsprozesse, insbesondere Aufgaben, Projekte, Reporting und interne SEO-Hilfen. Die konkreten Funktionen und Limits richten sich nach dem jeweils freigeschalteten Funktionsumfang bzw. der individuellen Vereinbarung.`,
            "Die öffentliche Website informiert über das Angebot. Der Zugang zur Anwendung erfolgt ausschließlich auf Einladung und nach erfolgreicher Anmeldung. Eine offene Registrierung gibt es nicht.",
          ],
        },
        {
          heading: "3. Konto und Zugang",
          body: [
            "Für die Nutzung der Anwendung ist ein Konto erforderlich. Die Anmeldung erfolgt in der Regel per Magic Link an eine hinterlegte E-Mail-Adresse. Zugangsdaten und Einladungen dürfen nicht an unbefugte Dritte weitergegeben werden.",
            `Du bist für alle Handlungen verantwortlich, die über dein Konto vorgenommen werden, soweit du diese zu vertreten hast. Missbrauch oder unbefugten Zugriff musst du unverzüglich an ${email} melden. Wir können Konten sperren oder löschen, wenn gegen diese Bedingungen verstoßen wird oder die Sicherheit der Plattform gefährdet ist.`,
          ],
        },
        {
          heading: "4. Vertrag und Vergütung",
          body: [
            "Der Vertrag kommt mit der Freischaltung des Zugangs auf Einladung zustande. Umfang, Laufzeit und eine etwaige Vergütung ergeben sich aus der individuellen Vereinbarung zwischen dem Anbieter und dem Kunden.",
            "Ist keine abweichende Vereinbarung getroffen, kann die Nutzung von beiden Seiten jederzeit zum Ende des laufenden Abrechnungszeitraums beendet werden. Mit Beendigung wird der Zugang deaktiviert.",
          ],
        },
        {
          heading: "5. Google-Anbindung",
          body: [
            `Die Verknüpfung eines Google-Kontos ist optional. Sie ist nur nötig, wenn Search-Console-Daten in der App angezeigt werden sollen. ${brand} fordert ausschließlich Lesezugriff an und veröffentlicht, löscht oder verändert keine Google-Daten im Namen der Nutzer. Die Verknüpfung kann jederzeit in den Einstellungen oder im Google-Konto getrennt werden.`,
          ],
        },
        {
          heading: "6. Zulässige Nutzung",
          body: [
            "Die Plattform darf nur für rechtmäßige SEO- und Projektarbeit genutzt werden. Unzulässig sind insbesondere:",
            {
              list: [
                "Zugriff ohne Berechtigung oder Umgehung von Zugangskontrollen",
                "Missbrauch von Integrationen, Schnittstellen oder KI-Funktionen",
                "Hochladen oder Verarbeiten rechtswidriger Inhalte",
                "Störung des Betriebs, automatisierte Angriffe oder übermäßige Last",
                "Weitergabe von Zugängen außerhalb des freigeschalteten Teams",
              ],
            },
            "Du sicherst zu, dass du für die angebundenen Websites, Google-Properties und übrigen Arbeitsdaten berechtigt bist.",
          ],
        },
        {
          heading: "7. Verfügbarkeit und Änderungen",
          body: [
            "Wir bemühen uns um einen möglichst unterbrechungsfreien Betrieb, schulden aber keine ununterbrochene Verfügbarkeit. Wartung, Sicherheitsupdates oder Störungen Dritter (Hosting, Google, SEO-Datendienste, KI-Dienste, E-Mail) können den Zugang vorübergehend einschränken. Funktionen können weiterentwickelt, angepasst oder – mit angemessener Vorankündigung, soweit zumutbar – eingestellt werden, sofern der Vertragszweck erhalten bleibt.",
          ],
        },
        {
          heading: "8. Haftung",
          body: [
            `Für Vorsatz und grobe Fahrlässigkeit haften wir unbeschränkt, ebenso für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit und nach dem Produkthaftungsgesetz. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. ${brand} übernimmt keine Gewähr für Rankings, Traffic oder sonstige SEO-Ergebnisse. Ergebnisse von KI-Funktionen und Daten externer Dienste können fehlerhaft oder unvollständig sein und sind vor der Verwendung zu prüfen.`,
          ],
        },
        {
          heading: "9. Datenschutz",
          body: ["Angaben zur Verarbeitung personenbezogener Daten, zur Google-Verknüpfung und zu Cookies stehen in der Datenschutzerklärung."],
        },
        {
          heading: "10. Schlussbestimmungen",
          body: [
            "Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Ist der Nutzer Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand Markdorf. Zwingende Verbraucherschutzvorschriften am Wohnsitz bleiben unberührt.",
            "Sollte eine Bestimmung unwirksam sein, bleibt der Rest dieser Bedingungen wirksam. Bei inhaltlichen Änderungen aktualisieren wir diese Seite und passen das Datum oben an. Fortgesetzte Nutzung nach Veröffentlichung gilt als Zustimmung, soweit gesetzlich zulässig; bei wesentlichen Änderungen weisen wir zusätzlich hin.",
            `Fragen zu diesen Nutzungsbedingungen richte bitte an ${email}.`,
          ],
        },
      ],
    } satisfies LegalDocument,
  },
  en: {
    nav: {
      back: "Back to homepage",
      login: "Sign in",
    },
    updatedLabel: "Last updated",
    imprint: {
      title: "Legal notice",
      description: `Legal notice of ${brand}.`,
      intro: `Information pursuant to the statutory disclosure obligations for the ${brand} service at ${website}.`,
      sections: [
        {
          heading: "Provider",
          body: [`${brand}\n${street}\n${city}\nGermany`, `Phone: ${phone}\nWebsite: ${website}\nEmail: ${email}`],
        },
        {
          heading: "Data protection contact",
          body: [
            "Please send enquiries about data processing and the Google connection to the same contact address. A detailed description of data collection and use can be found in the privacy policy.",
          ],
        },
      ],
    },
    privacy: {
      title: "Privacy policy",
      description: `Privacy policy of ${brand}.`,
      intro: `This privacy policy explains how personal data is processed when using the ${brand} web application at ${website}. ${brand} is an SEO work platform for invited users and not a public service.`,
      updated: "23 November 2026",
      sections: [
        {
          heading: "1. Controller",
          body: [
            `The controller responsible for data processing is the operator of ${brand}, reachable via the website ${website} and by email at ${email}. Further details can be found in the legal notice.`,
          ],
        },
        {
          heading: "2. Purpose of the application",
          body: [
            `${brand} is used to evaluate SEO and website metrics and to organise the related work processes. These include in particular:`,
            {
              list: [
                "Displaying search performance from Google Search Console",
                "Ranking, keyword, backlink and monitoring data from external SEO data services",
                "Tasks, briefings, editorial planning, reporting and AI-assisted SEO helpers",
              ],
            },
          ],
        },
        {
          heading: "3. What data we collect",
          body: [
            { subheading: "Account and sign-in" },
            "Access is granted via a magic link sent to a previously approved email address. The email address, time of sign-in and session-related authentication data are processed. No password is stored.",
            { subheading: "Google account (OAuth)" },
            `Users can voluntarily link their Google account to ${brand}. In this case the app obtains the following data via Google OAuth:`,
            {
              list: [
                "Google user ID, name, email address and profile picture",
                "OAuth access token and refresh token for later API use",
                "Read-only Google Search Console data, in particular properties, queries, pages, clicks, impressions, CTR, positions, countries and devices",
              ],
            },
            `No write permissions are requested for Google accounts or Search Console properties. ${brand} does not publish, delete or modify any Google data on behalf of users.`,
            { subheading: "Usage data in the app" },
            "In addition, work data created in the app itself may be stored, for example tasks, tickets, briefings, uploaded files, selected properties, ranking settings or internal comments. Technical logs may contain the IP address, browser and time of requests to the extent necessary for operation and security.",
          ],
        },
        {
          heading: "4. Purposes of processing",
          body: [
            `The data is used exclusively to operate ${brand}:`,
            {
              list: [
                "Sign-in and access control for invited users",
                `Assigning the Google account to the respective ${brand} user`,
                "Displaying and analysing Search Console metrics",
                "Storing the selected website/property for subsequent sessions",
                "Performing internal SEO, content and project tasks",
              ],
            },
            "The data is not used for advertising, not sold and not used for profiling on behalf of third parties.",
          ],
        },
        {
          heading: "5. Legal bases",
          body: [
            "Where the General Data Protection Regulation applies, processing is based in particular on Art. 6 (1) (b) GDPR (performance of the user agreement or the invitation to the app) and on Art. 6 (1) (a) GDPR where users link their Google account via the OAuth consent screen. Technical operating data and necessary cookies are based on Art. 6 (1) (f) GDPR or Section 25 (2) TDDDG (legitimate interest in secure operation).",
          ],
        },
        {
          heading: "6. Storage, recipients and services",
          body: [
            `Account, token and work data are stored in the database used for ${brand} and provided via the app's hosting infrastructure. The following processors or service providers may be used:`,
            {
              list: [
                "Google Ireland Limited / Google LLC: authentication and API access",
                "Vercel Inc.: hosting, server functions and file storage",
                "Neon Inc.: PostgreSQL database (data centre in Frankfurt am Main)",
                "Resend (Plus Five Five, Inc.): email delivery for magic links and notifications",
                "DataForSEO, SEOspark, Topicloops and Conductor: ranking, keyword, SERP, backlink and monitoring data",
                "Anthropic PBC, OpenAI, LLC and Google (Gemini): AI features",
              ],
            },
            "As a rule, only keywords, domains and URLs are transmitted to the SEO data services, not personal data of users. The AI services receive the content that users enter or select for the respective AI feature. Where service providers are based in the USA, transfers are based on the EU-U.S. Data Privacy Framework or EU standard contractual clauses.",
            `Google data is only retrieved to the extent required for display in ${brand}. Access tokens are stored server-side so that the app can query Search Console again on behalf of the respective user without asking for permission each time. Sections 7 and 8 describe with whom Google user data is shared, transferred or disclosed and which safeguards apply.`,
          ],
        },
        {
          heading: "7. Sharing, transfer and disclosure of Google user data",
          body: [
            `This section describes with whom we share, transfer or disclose Google user data. We do not sell Google user data. We do not transfer or disclose your information to third parties for purposes other than those stated here, namely providing and improving the features of ${brand}.`,
            "Google user data within the meaning of this policy is the information obtained via Google OAuth (Google user ID, name, email address, profile picture), OAuth access and refresh tokens, and the read-only Search Console data that the app retrieves on behalf of the user.",
            "This Google user data is only shared, transferred or disclosed to the following recipients:",
            {
              list: [
                "Google Ireland Limited / Google LLC: We send the OAuth tokens granted by the user back to the Google APIs to retrieve Search Console data on behalf of the user. The connection cannot work without this transfer to Google.",
                `Hosting and database processors: Account, token and retrieved Google data are stored and processed on the infrastructure used to operate ${brand}: Vercel Inc. (hosting, server functions and file storage) and Neon Inc. (PostgreSQL database). Application data is stored in Frankfurt am Main in the AWS cloud. These providers process the data exclusively on our behalf and not for their own purposes.`,
                `AI providers, only at the user's explicit request: When a user triggers an AI analysis in the app, selected Search Console metrics may be transferred to Anthropic PBC, OpenAI, LLC or Google (Gemini), for example for the Superagent or AI summaries in reporting, so that the requested analysis can be displayed in ${brand}. This transfer serves exclusively the respective user function.`,
                `Team members of the same ${brand} account: If the account owner shares properties with invited team members, these members can see the associated Search Console metrics in the app. OAuth tokens remain with the linking account and are not handed over to team members.`,
              ],
            },
            "Email service providers and SEO data services do not receive any Google user data. We do not pass Google user data on to advertisers, data brokers, credit agencies or information resellers. There is no use or disclosure for targeted, personalised, retargeting or interest-based advertising, nor any use for creditworthiness checks or lending. Google user data is not used to develop, improve or train non-personalised AI or ML models.",
          ],
        },
        {
          heading: "8. Safeguards for Google user data and sensitive data",
          body: [
            "Security procedures are in place to protect the confidentiality of your data. We use encryption to protect your information. Sensitive data within the meaning of this policy includes in particular OAuth tokens, Google profile information and the Search Console data retrieved via the Google APIs.",
            "Specifically, the following safeguards apply:",
            {
              list: [
                `Encryption in transit: All communication with ${brand} takes place via HTTPS/TLS.`,
                "Encryption at rest: OAuth access and refresh tokens are stored server-side in the database, not in the user's browser. The database and hosting infrastructure used encrypts data at rest.",
                "Access control: Only signed-in, invited users have access to the app. Google data of a property is only visible to the linking user and the team members approved by the account owner. Administrative access to the infrastructure is limited to operating the application.",
                "Data minimisation: Only read-only permissions are requested. There are no write permissions for Google accounts or Search Console properties.",
                "Revocation and deletion: Users can disconnect the Google connection in the settings at any time. Tokens and linked profile data are then deleted or rendered unusable. In addition, consent can be revoked in the Google account under third-party app permissions.",
              ],
            },
          ],
        },
        {
          heading: "9. Retention period and revocation",
          body: [
            `Account data remains stored as long as the user has access to ${brand}. Google tokens and linked profile data are deleted or rendered unusable when the user disconnects the Google connection in the settings or their account is removed. Users can additionally revoke the Google consent granted in their Google account under third-party app permissions. After revocation, ${brand} can no longer load any Search Console data.`,
          ],
        },
        {
          heading: "10. Rights of data subjects",
          body: [
            `Data subjects may request access, rectification, erasure, restriction of processing, data portability and object to processing where the legal requirements are met. Please send requests to ${email}. There is also the right to lodge a complaint with a data protection supervisory authority.`,
          ],
        },
        {
          heading: "11. No obligation to link a Google account",
          body: [
            `Signing in to ${brand} is possible without a Google account. Linking Google is optional and only necessary if Search Console data is to be displayed in the app. Without this connection, the other features of the work platform remain usable insofar as they do not require Google data.`,
          ],
        },
        {
          heading: "12. Cookies and local storage",
          body: [
            `${brand} only uses technically necessary cookies. No statistics, tracking or marketing services are used, so no consent banner is required.`,
            { subheading: "Necessary cookies" },
            "Necessary cookies are required for operation, security and sign-in (Art. 6 (1) (f) GDPR, Section 25 (2) TDDDG). These are:",
            {
              list: [
                "Session and CSRF cookies for sign-in (NextAuth)",
                "Interface language setting (locale, 12 months)",
              ],
            },
            { subheading: "Local storage in the browser" },
            "In the app, the selected property, display settings (e.g. light or dark theme) and individual view settings are stored in the browser's local storage. This data does not leave the device and can be deleted at any time via the browser settings.",
            "If the content of this policy changes, we update this page and adjust the date at the top.",
          ],
        },
      ],
    },
    terms: {
      title: "Terms of use",
      description: `Terms of use of ${brand}.`,
      intro: `These terms of use apply to the website and the ${brand} web application at ${website}. By accessing the public pages, accepting an invitation or signing in, you accept these terms.`,
      updated: "23 November 2026",
      sections: [
        {
          heading: "1. Provider",
          body: [
            `The provider and contractual partner is the operator of ${brand}, ${street}, ${city}, Germany, reachable at ${email}. Further details can be found in the legal notice.`,
          ],
        },
        {
          heading: "2. Description of services",
          body: [
            `${brand} is an SEO work platform. It is used to evaluate website and search metrics and to organise the related work processes, in particular tasks, projects, reporting and internal SEO helpers. The specific features and limits depend on the scope of functions activated or the individual agreement.`,
            "The public website provides information about the offering. Access to the application is granted exclusively by invitation and after successful sign-in. There is no open registration.",
          ],
        },
        {
          heading: "3. Account and access",
          body: [
            "An account is required to use the application. Sign-in usually takes place via a magic link sent to a registered email address. Access data and invitations must not be passed on to unauthorised third parties.",
            `You are responsible for all actions taken via your account insofar as you are responsible for them. You must report misuse or unauthorised access to ${email} without delay. We may suspend or delete accounts if these terms are violated or the security of the platform is at risk.`,
          ],
        },
        {
          heading: "4. Contract and fees",
          body: [
            "The contract is concluded when access is activated by invitation. Scope, term and any fees are set out in the individual agreement between the provider and the customer.",
            "Unless otherwise agreed, either party may end the use at any time with effect from the end of the current billing period. Upon termination, access is deactivated.",
          ],
        },
        {
          heading: "5. Google connection",
          body: [
            `Linking a Google account is optional. It is only necessary if Search Console data is to be displayed in the app. ${brand} requests read-only access exclusively and does not publish, delete or modify any Google data on behalf of users. The connection can be removed at any time in the settings or in the Google account.`,
          ],
        },
        {
          heading: "6. Permitted use",
          body: [
            "The platform may only be used for lawful SEO and project work. The following are prohibited in particular:",
            {
              list: [
                "Access without authorisation or circumvention of access controls",
                "Misuse of integrations, interfaces or AI features",
                "Uploading or processing unlawful content",
                "Disrupting operations, automated attacks or excessive load",
                "Sharing access outside the activated team",
              ],
            },
            "You warrant that you are authorised to use the connected websites, Google properties and other work data.",
          ],
        },
        {
          heading: "7. Availability and changes",
          body: [
            "We strive for operation that is as uninterrupted as possible, but do not guarantee uninterrupted availability. Maintenance, security updates or third-party disruptions (hosting, Google, SEO data services, AI services, email) may temporarily restrict access. Features may be further developed, adapted or – with reasonable advance notice where reasonable – discontinued, provided the purpose of the contract is preserved.",
          ],
        },
        {
          heading: "8. Liability",
          body: [
            `We are liable without limitation for intent and gross negligence, as well as for damage resulting from injury to life, body or health and under the Product Liability Act. In the event of a slightly negligent breach of material contractual obligations, liability is limited to the typical, foreseeable damage. Otherwise, liability for slight negligence is excluded. ${brand} assumes no guarantee for rankings, traffic or other SEO results. Results of AI features and data from external services may be incorrect or incomplete and must be checked before use.`,
          ],
        },
        {
          heading: "9. Data protection",
          body: ["Information on the processing of personal data, the Google connection and cookies can be found in the privacy policy."],
        },
        {
          heading: "10. Final provisions",
          body: [
            "The law of the Federal Republic of Germany applies, excluding the UN Convention on Contracts for the International Sale of Goods. If the user is a merchant, a legal entity under public law or a special fund under public law, the place of jurisdiction is Markdorf. Mandatory consumer protection provisions at the place of residence remain unaffected.",
            "Should any provision be invalid, the remainder of these terms remains effective. If the content changes, we update this page and adjust the date at the top. Continued use after publication constitutes acceptance where legally permissible; we will additionally point out material changes.",
            `Please send questions about these terms of use to ${email}.`,
          ],
        },
      ],
    },
  },
});
