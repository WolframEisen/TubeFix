// Einstellungen im Popup. Jedes Feld hat als id den Namen der Einstellung (siehe settings.js).
// Jede Änderung wird sofort gespeichert; bridge.js bekommt sie mit und aktualisiert offene YouTube-Tabs.
(() => {
  'use strict';

  const SAMPLE = '2023-05-12T16:00:00'; // Beispieldatum für die Vorschau im Auswahlfeld
  const $ = (id) => document.getElementById(id);
  const fields = Object.keys(TubeFix.DEFAULTS).map($).filter(Boolean);

  function addOptions(select, entries) {
    for (const [value, label] of entries) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
  }

  function showSize(rem) {
    $('descSizeValue').textContent = `${rem.toFixed(1)} rem (${Math.round(rem * 10)} px)`;
  }

  function show(s) {
    for (const field of fields) {
      if (field.type === 'checkbox') field.checked = s[field.id];
      else field.value = s[field.id];
    }
    showSize(s.descSize);
    updateDisabled();
  }

  // Schriftgröße nur einstellbar, wenn die Beschreibung angezeigt wird.
  function updateDisabled() {
    $('descSize').disabled = !$('showDesc').checked;
  }

  function valueOf(field) {
    if (field.type === 'checkbox') return field.checked;
    if (field.type === 'range') return Number(field.value);
    return field.value;
  }

  const dateFormats = TubeFix.FORMATS.map((f) => [f, TubeFix.formatDate(SAMPLE, f, false)]);
  addOptions($('listFormat'), dateFormats);
  addOptions($('watchFormat'), dateFormats);
  addOptions($('quality'), TubeFix.QUALITIES);
  chrome.storage.sync.get(TubeFix.DEFAULTS).then(show);

  for (const field of fields) {
    field.addEventListener(field.type === 'range' ? 'input' : 'change', () => {
      if (field.id === 'descSize') showSize(valueOf(field));
      if (field.id === 'showDesc') updateDisabled();
      chrome.storage.sync.set({ [field.id]: valueOf(field) });
    });
  }

  $('reset').addEventListener('click', () => {
    chrome.storage.sync.set(TubeFix.DEFAULTS);
    show(TubeFix.DEFAULTS);
  });
  $('about').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('about.html') });
    window.close();
  });
})();
