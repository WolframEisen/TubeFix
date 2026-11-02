# TubeFix – Vivaldi-Erweiterung für YouTube

Passt YouTube an. Aktuelle Funktionen:

- **Genaues Upload-Datum** unter dem Videotitel (z. B. „Freitag, 12. Mai 2023 um 16:00 Uhr“).
- In Videolisten (Startseite, Suche, Seitenleiste, Kanäle) wird „vor 2 Wochen“ durch das Datum
  ersetzt (z. B. „12.05.2023“, Maus drüber zeigt Datum mit Uhrzeit). Geladen wird nur, was sichtbar ist;
  bekannte Daten werden lokal zwischengespeichert.
- Startseite: normales YouTube-Layout, unter den Infos zusätzlich ein Auszug aus der Beschreibung.
  Die Zeilenzahl lässt sich oben in `style.css` einstellen (`--tfx-desc-lines`).
- Videotitel werden erst nach 4 statt 2 Zeilen abgeschnitten (`--tfx-title-lines` in `style.css`).

- Abonnentenzahl hinter dem Kanalnamen in Videolisten (eine Anfrage pro Kanal, eine Woche zwischengespeichert).
- Bevorzugte Videoqualität und Originalton statt „Automatisch synchronisiert“.

## Installation in Vivaldi

1. `vivaldi://extensions` öffnen
2. Oben rechts **Entwicklermodus** einschalten
3. **Entpackte Erweiterung laden** → diesen Ordner (`tubefix`) auswählen
4. YouTube-Tab neu laden

Nach Änderungen am Code: in `vivaldi://extensions` bei der Erweiterung auf ⟳ klicken und YouTube neu laden.

## Einstellungen

Klick auf das Erweiterungs-Symbol öffnet ein Popup: Datumsformat (Listen / Videoseite, optional mit Uhrzeit),
Abonnentenzahl, Beschreibung auf der Startseite (ein/aus, Schriftgröße), bevorzugte Qualität und Originalton. „Über“ öffnet eine kurze Beschreibung der Erweiterung.

## Dateien

- `manifest.json` – Erweiterungs-Definition (Manifest V3)
- `content.js` – läuft in der YouTube-Seite: lädt Datum und Beschreibung und fügt sie ein
- `bridge.js` – reicht die gespeicherten Einstellungen an die Seite weiter (CSS-Variable bzw. Attribute auf `<html>`)
- `settings.js` – Standardwerte und Datumsformate, gemeinsam für Popup und Seite
- `style.css` – Styles auf YouTube
- `popup.html` / `popup.js` – Einstellungen
- `about.html` / `about.js` – Über-Seite
- `ui.css` – Styles für Popup und Über-Seite
- `icons/` – Logo; `make_icons.py` erzeugt die PNGs neu
