# TubeFix

<img src="icons/icon128.png" alt="TubeFix-Logo" width="64" align="right">

Eine kleine Browser-Erweiterung, die ein paar Dinge an YouTube verbessert.
Läuft in Vivaldi, Chrome, Edge, Brave und anderen Chromium-Browsern.

> **Testversion:** TubeFix ist noch nicht im Chrome Web Store, sondern wird von Hand installiert (dauert 2 Minuten).
> Über Rückmeldungen freue ich mich – was klappt, was nicht, was fehlt?

## Was TubeFix macht

- **Genaues Upload-Datum** unter dem Videotitel, z. B. „Freitag, 12. Mai 2023, 16:00 Uhr“ statt „vor 3 Jahren“.
- **Datum statt „vor 2 Wochen“** in Videolisten (Startseite, Suche, Seitenleiste, Kanäle).
  Mit der Maus drüberfahren zeigt Datum und Uhrzeit.
- **Auszug aus der Beschreibung** unter jedem Video auf der Startseite.
- **Abonnentenzahl** hinter dem Kanalnamen.
- **Längere Titel:** Videotitel werden erst nach 4 statt nach 2 Zeilen abgeschnitten.
- **Bevorzugte Qualität:** Videos starten in der Auflösung deiner Wahl, z. B. immer 1080p.
- **Originalton:** Bei „Automatisch synchronisiert“-Videos schaltet TubeFix auf die Originaltonspur um.

Alles lässt sich über das TubeFix-Symbol in der Browserleiste einstellen (Datumsformat, Schriftgröße,
Qualität, Originalton, einzelne Funktionen an/aus).

## Installation

**1. Herunterladen**

Oben auf dieser Seite auf den grünen Knopf **Code** → **Download ZIP** klicken und die ZIP-Datei entpacken.
Den entpackten Ordner an einen Ort legen, wo er bleiben kann (z. B. Dokumente) – der Browser lädt die
Erweiterung direkt aus diesem Ordner. Wird er gelöscht oder verschoben, ist TubeFix weg.

**2. Im Browser laden**

1. Die Erweiterungsseite öffnen – diese Adresse in die Adressleiste eintippen:
   - Vivaldi: `vivaldi://extensions`
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
2. **Entwicklermodus** einschalten (Schalter oben rechts, bei Edge links unten).
3. Auf **Entpackte Erweiterung laden** klicken und den entpackten Ordner auswählen –
   den Ordner, in dem die Datei `manifest.json` liegt.
4. YouTube öffnen bzw. neu laden. Fertig.

Tipp: Damit das Symbol immer sichtbar ist, im Browser auf das Puzzleteil-Symbol klicken und TubeFix anheften.

**Hinweis:** Chrome und Edge zeigen beim Start manchmal eine Warnung zu „Erweiterungen im Entwicklermodus“.
Das ist bei allen von Hand installierten Erweiterungen so und kann weggeklickt werden.

## Aktualisieren

Neue Version wie oben herunterladen, den Inhalt des alten Ordners damit ersetzen und auf der
Erweiterungsseite bei TubeFix auf den Neu-laden-Pfeil ⟳ klicken. Die Einstellungen bleiben erhalten.

## Datenschutz

- TubeFix spricht nur mit youtube.com – mit denselben Schnittstellen, die die YouTube-Seite selbst benutzt.
- Es werden keine Daten an andere Server geschickt, es gibt kein Tracking.
- Bereits geladene Daten (Datum, Beschreibung, Abonnentenzahl) werden lokal im Browser zwischengespeichert,
  damit die Seite beim nächsten Mal schneller ist.

## Bekannte Einschränkungen

- Die Zeitangaben werden am Text erkannt – das klappt, wenn YouTube auf Deutsch oder Englisch eingestellt ist.
- Shorts und laufende Livestreams bekommen kein Datum.
- Wenn YouTube sein Seitenlayout ändert, kann einzelnes vorübergehend nicht mehr funktionieren.

## Für Entwickler

Manifest V3, kein Build-Schritt. Aufbau:

- `content.js` – läuft in der YouTube-Seite: lädt Datum, Beschreibung und Abonnentenzahlen, steuert Qualität und Tonspur
- `bridge.js` – reicht die gespeicherten Einstellungen an die Seite weiter (data-Attribute bzw. CSS-Variable auf `<html>`)
- `settings.js` – Standardwerte und Datumsformate, gemeinsam für Popup und Seite
- `style.css` – Styles auf YouTube
- `popup.html` / `popup.js` – Einstellungen; `about.html` / `about.js` – Über-Seite; `ui.css` – deren Styles
- `icons/` – Logo; `make_icons.py` erzeugt die PNGs neu (benötigt Pillow)
