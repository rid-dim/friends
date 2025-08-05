// Hilfsfunktionen zur Verarbeitung von "presence"-Nachrichten

/**
 * Erzeugt einen anzeigbaren Text für den "last seen"-Status.
 *
 * Regeln laut Anforderung:
 *  - Wenn der Kontakt in den letzten 24 h gesehen wurde:
 *      * < 60 min  → "last seen X minutes ago"
 *      * ≥ 60 min  → "last seen X hours ago"
 *  - Wenn der Kontakt vor mehr als 24 h gesehen wurde:
 *      * "last seen at: <lokale Datum-/Zeitdarstellung>"
 *
 * @param lastSeenTs   Zeitstempel (ms seit Epoch) der letzten Presence-Nachricht
 * @param nowMs        Aktuelle Zeit in ms (Standard: Date.now())
 * @param locale       Locale-String, z. B. "en-US" oder "de-DE" (Standard: Browser-Locale)
 * @returns Text für die Anzeige
 */
export function createLastSeenText(
  lastSeenTs: number,
  nowMs: number = Date.now(),
  locale: string | undefined = undefined
): string {
  const diffMs = nowMs - lastSeenTs;
  const oneMinute = 60 * 1000;
  const oneHour = 60 * oneMinute;
  const oneDay = 24 * oneHour;

  if (diffMs < oneDay) {
    if (diffMs < oneHour) {
      const minutes = Math.max(1, Math.floor(diffMs / oneMinute));
      return `last seen ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }
    const hours = Math.floor(diffMs / oneHour);
    return `last seen ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  // > 24 h
  const date = new Date(lastSeenTs);
  return `last seen at: ${date.toLocaleString(locale)}`;
}


