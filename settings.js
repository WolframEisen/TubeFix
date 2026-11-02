// Gemeinsam genutzt von Popup, bridge.js und content.js: Standardwerte und Datumsformate.
const TubeFix = (() => {
  'use strict';

  const DEFAULTS = {
    listFormat: 'dmy',      // Datum in Videolisten
    watchFormat: 'wd-long', // Datum auf der Videoseite
    watchTime: true,        // Uhrzeit auf der Videoseite anzeigen
    showDesc: true,         // Auszug aus der Beschreibung auf der Startseite
    descSize: 1.5,          // Schriftgröße der Beschreibung in rem (1rem = 10px auf YouTube)
    showSubs: true,         // Abonnentenzahl hinter dem Kanalnamen
    quality: 'auto',        // bevorzugte Videoqualität (siehe QUALITIES)
    originalAudio: true,    // Originalton statt automatischer Synchronisation
  };

  // Wert für die Player-API -> Anzeige im Popup
  const QUALITIES = [
    ['auto', 'Automatisch (YouTube entscheidet)'],
    ['highest', 'Höchste verfügbare'],
    ['hd2160', '2160p (4K)'],
    ['hd1440', '1440p'],
    ['hd1080', '1080p'],
    ['hd720', '720p'],
    ['large', '480p'],
    ['medium', '360p'],
  ];

  // Formatname -> Optionen für toLocaleDateString (null = eigenes Format)
  const FORMATS = {
    dmy: { day: '2-digit', month: '2-digit', year: 'numeric' },
    'dmy-short': { day: '2-digit', month: '2-digit', year: '2-digit' },
    'd-month-y': { day: 'numeric', month: 'long', year: 'numeric' },
    'wd-dmy': { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' },
    'wd-long': { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    iso: null,
  };

  const pad = (n) => String(n).padStart(2, '0');

  // "2023-05-12" oder "2023-05-12T07:00:11-07:00"
  function parse(iso) {
    // Reines Datum als lokales Datum interpretieren, sonst verschiebt es sich per UTC.
    const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
    return isNaN(d) ? null : d;
  }

  function formatDate(iso, format, withTime) {
    const d = parse(iso);
    if (!d) return iso;
    const opts = format in FORMATS ? FORMATS[format] : FORMATS[DEFAULTS.listFormat];
    let text = opts
      ? d.toLocaleDateString('de-DE', opts)
      : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (withTime && iso.includes('T')) text += `, ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
    return text;
  }

  return { DEFAULTS, FORMATS: Object.keys(FORMATS), QUALITIES, formatDate };
})();
