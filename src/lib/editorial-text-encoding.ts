/**
 * UTF-8-Mojibake (UTF-8 fälschlich als Windows-1252/Latin-1 gelesen) reparieren.
 * Genutzt von: Redaktionsplan-Import (inkl. Merge), fix-encoding API.
 */

const WIN1252_REVERSE: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

function hasMojibakePattern(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp >= 0xc0 && cp <= 0xff) return true;
  }
  return false;
}

export function fixMojibake(text: string): string {
  if (!hasMojibakePattern(text)) return text;

  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp >= 0xa0 && cp <= 0xff) {
      bytes.push(cp);
    } else {
      const win1252byte = WIN1252_REVERSE[cp];
      if (win1252byte !== undefined) {
        bytes.push(win1252byte);
      } else {
        return text;
      }
    }
  }

  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    if (decoded !== text) return decoded;
  } catch {
    /* keine gültige UTF-8-Bytefolge */
  }

  return text;
}

/**
 * Für den Abgleich Excel ↔ Datenbank: dieselbe Pipeline wie beim Import,
 * plus Unicode-NFC (zusammengesetzte Zeichen vereinheitlichen).
 */
export function titleMatchKey(value: string | undefined | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return fixMojibake(trimmed).normalize("NFC");
}

/** Optionale Textfelder aus der Excel (Meta, H1, Schema, …). */
export function cleanImportedOptionalText(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return fixMojibake(trimmed).normalize("NFC");
}
