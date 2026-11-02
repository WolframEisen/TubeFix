// Brücke zwischen Erweiterungs-Speicher und YouTube-Seite.
// content.js läuft in der Seiten-Welt und kommt nicht an chrome.storage – dieses Skript schon.
// Es legt die Einstellungen als data-Attribute auf <html> ab (z. B. showSubs -> data-tfx-show-subs)
// und meldet Änderungen per Event.
(() => {
  'use strict';

  function apply(s) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(s)) {
      const name = `tfx${key[0].toUpperCase()}${key.slice(1)}`;
      root.dataset[name] = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    }
    root.style.setProperty('--tfx-desc-size', `${s.descSize}rem`);
    document.dispatchEvent(new CustomEvent('tfx-settings'));
  }

  const load = () => chrome.storage.sync.get(TubeFix.DEFAULTS).then(apply);

  load();
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') load();
  });
})();
