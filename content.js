// Läuft in der YouTube-Seite ("MAIN"-World, damit wir an Player-API und ytcfg kommen):
// - genaues Upload-Datum unter dem Videotitel und in den Videolisten
// - Auszug aus der Beschreibung auf der Startseite
// - Abonnentenzahl hinter dem Kanalnamen in den Videolisten
// - bevorzugte Videoqualität und Originalton statt automatischer Synchronisation
(() => {
  'use strict';

  const BADGE_ID = 'tfx-exact-date';
  const DATE_CLASS = 'tfx-date';
  const DESC_CLASS = 'tfx-desc';
  const SUBS_CLASS = 'tfx-subs';
  const HOME_SELECTOR = 'ytd-browse[page-subtype="home"]';
  const ITEM_SELECTOR =
    'yt-lockup-view-model, ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer';
  // "vor 2 Wochen", "Live gestreamt vor 3 Tagen", "2 weeks ago", "Streamed 3 days ago"
  const RELATIVE_RE =
    /^((live\s+)?gestreamt\s+|streamed\s+|premiere\s+)?vor\s+\d+\s+\S+$|^((streamed|premiered)\s+)?\d+\s+\S+\s+ago$/i;
  // "1,23 Mio. Abonnenten", "2930 Abonnenten", "1.2M subscribers"
  const SUBS_RE = /^([\d.,\s]+\s*(?:Mio\.|Mrd\.|Tsd\.|[KMB])?)\s*(?:Abonnent(?:en|innen|in)?|subscribers?)$/i;
  const MAX_PARALLEL = 4;
  const DESC_MAX = 300;
  const CHANNEL_TTL = 7 * 24 * 60 * 60 * 1000; // Abonnentenzahlen eine Woche merken
  const QUALITY_ORDER = ['highres', 'hd2880', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Einstellungen (legt bridge.js als data-Attribute auf <html> ab) ----------

  function setting(key) {
    const raw = document.documentElement.dataset[`tfx${key[0].toUpperCase()}${key.slice(1)}`];
    const def = TubeFix.DEFAULTS[key];
    if (raw === undefined) return def;
    if (typeof def === 'boolean') return raw === '1';
    if (typeof def === 'number') return Number(raw);
    return raw;
  }

  // ---------- Caches, bleiben über Seitenaufrufe erhalten ----------

  function persistentCache(key, max) {
    let map;
    try {
      map = new Map(JSON.parse(localStorage.getItem(key)) || []);
    } catch {
      map = new Map();
    }
    let timer = 0;
    return {
      get: (k) => map.get(k),
      has: (k) => map.has(k),
      set(k, v) {
        map.delete(k);
        map.set(k, v);
        clearTimeout(timer);
        timer = setTimeout(() => {
          while (map.size > max) map.delete(map.keys().next().value);
          try {
            localStorage.setItem(key, JSON.stringify([...map]));
          } catch {}
        }, 1000);
      },
    };
  }

  // Caches älterer Versionen (noch unter dem Arbeitstitel "YouTube Style") aufräumen
  for (const key of ['yts-date-cache', 'yts-video-cache', 'yts-video-cache-v2', 'yts-channel-cache']) {
    localStorage.removeItem(key);
  }

  const videos = persistentCache('tfx-video-cache', 3000); // videoId -> { date, desc, channelId, author }
  const channels = persistentCache('tfx-channel-cache', 2000); // channelId -> { subs, t }

  // ---------- Datenquellen ----------

  // Beschreibung kürzen: Links raus, Zeilenumbrüche zusammenfassen.
  function shorten(text) {
    const t = (text || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
    return t.length > DESC_MAX ? `${t.slice(0, DESC_MAX).trimEnd()}…` : t;
  }

  function infoFromResponse(pr) {
    const mf = pr?.microformat?.playerMicroformatRenderer;
    const vd = pr?.videoDetails;
    return {
      date: mf?.publishDate || mf?.uploadDate || null,
      desc: shorten(vd?.shortDescription),
      channelId: vd?.channelId || null,
      author: vd?.author || null,
    };
  }

  function getPlayer() {
    return document.getElementById('movie_player');
  }

  // Player-Response des gerade geladenen Videos (nur Watch-Seite).
  function infoFromPlayer(id) {
    const pr = getPlayer()?.getPlayerResponse?.();
    return pr?.videoDetails?.videoId === id ? infoFromResponse(pr) : null;
  }

  // Interne YouTube-API (dieselbe, die die Seite selbst benutzt).
  async function innertube(endpoint, body) {
    const key = window.ytcfg?.get?.('INNERTUBE_API_KEY');
    const context = window.ytcfg?.get?.('INNERTUBE_CONTEXT');
    if (!key || !context) return null;
    const res = await fetch(`/youtubei/v1/${endpoint}?key=${key}&prettyPrint=false`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, ...body }),
    });
    return res.ok ? res.json() : null;
  }

  // Fallback: Watch-Seite laden und Daten aus dem HTML ziehen.
  async function infoFromPage(id) {
    const res = await fetch(`/watch?v=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
    const html = await res.text();
    const str = (name) => {
      const raw = html.match(new RegExp(`"${name}":"((?:[^"\\\\]|\\\\.)*)"`))?.[1];
      try {
        return raw ? JSON.parse(`"${raw}"`) : null;
      } catch {
        return null;
      }
    };
    return {
      date: str('publishDate') ?? str('uploadDate'),
      desc: shorten(str('shortDescription')),
      channelId: str('channelId'),
      author: str('author'),
    };
  }

  async function fetchInfo(id) {
    let info = null;
    try {
      info = infoFromResponse(await innertube('player', { videoId: id }));
    } catch {}
    if (!info?.date) info = await infoFromPage(id);
    if (!info.date && !info.desc) return null;
    videos.set(id, info);
    return info;
  }

  // Erster Text im Kanal-Header, der wie eine Abonnentenzahl aussieht.
  function findSubs(node, depth = 0) {
    if (typeof node === 'string') return node.trim().match(SUBS_RE)?.[1].trim() ?? null;
    if (!node || typeof node !== 'object' || depth > 30) return null;
    for (const value of Object.values(node)) {
      const found = findSubs(value, depth + 1);
      if (found) return found;
    }
    return null;
  }

  async function fetchSubs(channelId) {
    const json = await innertube('browse', { browseId: channelId });
    if (!json) throw new Error('Kanal nicht geladen');
    const subs = findSubs(json.header) ?? null; // null = Kanal blendet die Zahl aus
    channels.set(channelId, { subs, t: Date.now() });
    return subs;
  }

  // Warteschlange: höchstens MAX_PARALLEL Anfragen gleichzeitig, doppelte Anfragen zusammengefasst.
  const pending = new Map();
  const queue = [];
  let active = 0;

  function enqueue(key, task) {
    if (!pending.has(key)) {
      const p = new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        pump();
      }).finally(() => pending.delete(key));
      pending.set(key, p);
    }
    return pending.get(key);
  }

  function pump() {
    while (active < MAX_PARALLEL && queue.length) {
      const job = queue.shift();
      active++;
      job
        .task()
        .then(job.resolve, job.reject)
        .finally(() => {
          active--;
          pump();
        });
    }
  }

  function requestInfo(id) {
    if (videos.has(id)) return Promise.resolve(videos.get(id));
    return enqueue(`v:${id}`, () => fetchInfo(id));
  }

  function channelFresh(channelId) {
    const entry = channels.get(channelId);
    return !!entry && Date.now() - entry.t < CHANNEL_TTL;
  }

  function requestSubs(channelId) {
    if (channelFresh(channelId)) return Promise.resolve(channels.get(channelId).subs);
    return enqueue(`c:${channelId}`, () => fetchSubs(channelId));
  }

  // ---------- Formatierung ----------

  const formatList = (iso) => TubeFix.formatDate(iso, setting('listFormat'), false);
  const formatWatch = (iso) => TubeFix.formatDate(iso, setting('watchFormat'), setting('watchTime'));
  const formatFull = (iso) => TubeFix.formatDate(iso, 'wd-long', true); // Tooltip in den Listen

  // ---------- Watch-Seite: Datum unter dem Titel ----------

  let runToken = 0;

  function currentVideoId() {
    if (location.pathname !== '/watch') return null;
    return new URLSearchParams(location.search).get('v');
  }

  async function getWatchInfo(id, token) {
    if (videos.has(id)) return videos.get(id);
    // Nach einer Navigation braucht der Player kurz, bis er das neue Video kennt.
    for (let i = 0; i < 10 && token === runToken; i++) {
      const info = infoFromPlayer(id);
      if (info?.date) {
        videos.set(id, info);
        return info;
      }
      await sleep(200);
    }
    return requestInfo(id);
  }

  function renderWatch(id, date) {
    const title = document.querySelector('ytd-watch-metadata #title');
    if (!title) return false;

    let el = document.getElementById(BADGE_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = BADGE_ID;
    }
    if (el.previousElementSibling !== title) title.after(el);
    el.textContent = formatWatch(date);
    el.dataset.videoId = id;
    return true;
  }

  async function updateWatch() {
    const token = ++runToken;
    const id = currentVideoId();
    const old = document.getElementById(BADGE_ID);

    if (!id) {
      old?.remove();
      return;
    }
    if (old && old.dataset.videoId !== id) old.remove();

    let date;
    try {
      date = (await getWatchInfo(id, token))?.date;
    } catch (err) {
      console.warn('[TubeFix] Upload-Datum konnte nicht geladen werden:', err);
      return;
    }
    if (token !== runToken || !date) return;

    // Warten, bis der Titelbereich gerendert ist.
    for (let i = 0; i < 50 && token === runToken; i++) {
      if (renderWatch(id, date)) return;
      await sleep(200);
    }
  }

  // ---------- Videolisten (Startseite, Suche, Seitenleiste, Kanäle) ----------

  const failedVideos = new Set();
  const failedChannels = new Set();

  // Erst laden, wenn das Video (fast) sichtbar ist.
  const visibility = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        visibility.unobserve(e.target);
        fillItem(e.target);
      }
    },
    { rootMargin: '400px' }
  );

  function videoIdOf(item) {
    const a = item.querySelector('a[href*="/watch?v="]');
    return a ? new URL(a.href, location.origin).searchParams.get('v') : null;
  }

  // Das <span> mit "vor 2 Wochen" – oder unser bereits ersetztes Datum.
  function dateSpanOf(item) {
    const ours = item.querySelector(`span.${DATE_CLASS}`);
    if (ours) {
      const text = ours.textContent.trim();
      if (text === ours.dataset.tfxText || RELATIVE_RE.test(text)) return ours;
      ours.classList.remove(DATE_CLASS); // YouTube hat das Element für etwas anderes wiederverwendet
    }
    for (const s of item.querySelectorAll('span')) {
      if (s.childElementCount === 0 && RELATIVE_RE.test(s.textContent.trim())) return s;
    }
    return null;
  }

  // Wohin die Beschreibung kommt – nur auf der Startseite und wenn eingeschaltet.
  function descTargetOf(item) {
    if (!setting('showDesc') || !item.closest(HOME_SELECTOR)) return null;
    return (
      item.querySelector('#meta') ||
      item.querySelector('[class*="text-container"]') ||
      item.querySelector('h3')?.parentElement ||
      null
    );
  }

  // Das Element mit dem Kanalnamen (sichtbar, nicht im Titel).
  function channelNameOf(item, author) {
    if (!author) return null;
    for (const el of item.querySelectorAll('a, span, yt-formatted-string')) {
      if (el.childElementCount !== 0 || el.classList.contains(SUBS_CLASS)) continue;
      if (el.textContent.trim() !== author || el.closest('h3, #video-title')) continue;
      if (el.offsetParent !== null) return el;
    }
    return null;
  }

  // Abonnenten noch zu laden? (Kanal bekannt, noch nicht im Cache, nicht fehlgeschlagen)
  function subsPending(info) {
    return (
      setting('showSubs') &&
      !!info.channelId &&
      !channelFresh(info.channelId) &&
      !failedChannels.has(info.channelId)
    );
  }

  function needsWork(item, id) {
    const span = dateSpanOf(item);
    const dateDone =
      !span || (span.dataset.tfxId === id && span.textContent.trim() === span.dataset.tfxText);
    const target = descTargetOf(item);
    const descDone = !target || target.querySelector(`:scope > .${DESC_CLASS}`)?.dataset.tfxId === id;

    let subsDone = !setting('showSubs');
    const info = videos.get(id);
    if (!subsDone && info) {
      const cid = info.channelId;
      if (!cid || failedChannels.has(cid)) subsDone = true;
      else if (channelFresh(cid)) {
        const name = channelNameOf(item, info.author);
        const subs = channels.get(cid).subs;
        const shown = name?.nextElementSibling;
        subsDone =
          !name || !subs || (shown?.classList.contains(SUBS_CLASS) && shown.dataset.tfxCid === cid);
      }
    }
    return !dateDone || !descDone || !subsDone;
  }

  function setDateText(span, date) {
    span.dataset.tfxText = formatList(date);
    span.textContent = span.dataset.tfxText;
    span.title = formatFull(date);
  }

  function renderItem(item, id, info) {
    const span = dateSpanOf(item);
    if (span && info.date) {
      span.classList.add(DATE_CLASS);
      span.dataset.tfxId = id;
      setDateText(span, info.date);
    }

    const target = descTargetOf(item);
    if (target) {
      let el = target.querySelector(`:scope > .${DESC_CLASS}`);
      if (!el) {
        el = document.createElement('div');
        el.className = DESC_CLASS;
        target.append(el);
      }
      el.dataset.tfxId = id;
      el.textContent = info.desc || '';
    }
  }

  function renderSubs(item, info, subs) {
    const name = channelNameOf(item, info.author);
    let el = name?.nextElementSibling;
    if (!el?.classList.contains(SUBS_CLASS)) {
      item.querySelectorAll(`.${SUBS_CLASS}`).forEach((old) => old.remove());
      if (!name || !subs || !setting('showSubs')) return;
      el = document.createElement('span');
      el.className = SUBS_CLASS;
      name.after(el);
    }
    if (!subs || !setting('showSubs')) {
      el.remove();
      return;
    }
    el.dataset.tfxCid = info.channelId;
    el.textContent = ` · ${subs} Abos`;
  }

  async function fillItem(item) {
    const id = item.dataset.tfxWaiting;
    if (!id) return;
    try {
      const info = await requestInfo(id);
      if (!info) {
        failedVideos.add(id);
        return;
      }
      if (videoIdOf(item) !== id) return;
      renderItem(item, id, info);

      if (setting('showSubs') && info.channelId && !failedChannels.has(info.channelId)) {
        let subs = null;
        try {
          subs = await requestSubs(info.channelId);
        } catch {
          failedChannels.add(info.channelId);
        }
        if (videoIdOf(item) === id) renderSubs(item, info, subs);
      }
    } catch {
      failedVideos.add(id);
    } finally {
      if (item.dataset.tfxWaiting === id) delete item.dataset.tfxWaiting;
    }
  }

  function scanLists() {
    for (const item of document.querySelectorAll(ITEM_SELECTOR)) {
      const id = videoIdOf(item);
      if (!id || failedVideos.has(id) || item.dataset.tfxWaiting === id) continue;
      if (!needsWork(item, id)) continue;

      const info = videos.get(id);
      if (info && !subsPending(info)) {
        // alles im Cache: sofort anzeigen
        renderItem(item, id, info);
        if (setting('showSubs') && info.channelId) {
          renderSubs(item, info, channels.get(info.channelId)?.subs ?? null);
        }
      } else {
        item.dataset.tfxWaiting = id;
        visibility.observe(item);
      }
    }
  }

  // ---------- Wiedergabe: Qualität und Originalton ----------

  const handled = new Map(); // videoId -> { quality, audio } – schon eingestellt?

  function applyQuality(player) {
    const pref = setting('quality');
    if (pref === 'auto') return true;
    const levels = (player.getAvailableQualityLevels?.() || []).filter((q) => q !== 'auto');
    if (!levels.length) return false; // Player noch nicht so weit
    let target = levels[0]; // YouTube sortiert von hoch nach niedrig
    if (pref !== 'highest') {
      const max = QUALITY_ORDER.indexOf(pref);
      target = levels.find((q) => QUALITY_ORDER.indexOf(q) >= max) ?? levels[levels.length - 1];
    }
    player.setPlaybackQualityRange?.(target, target);
    player.setPlaybackQuality?.(target);
    return true;
  }

  // Alle Texte eines Audiotrack-Objekts (die Feldnamen der Player-API sind teils verschleiert).
  function trackStrings(track, depth = 0, out = []) {
    if (!track || typeof track !== 'object' || depth > 2) return out;
    for (const v of Object.values(track)) {
      if (typeof v === 'string') out.push(v);
      else trackStrings(v, depth + 1, out);
    }
    return out;
  }

  function isTrack(track, trackId) {
    return trackStrings(track).includes(trackId);
  }

  // ID der Originaltonspur aus den Videodaten, z. B. "en.4"
  function originalTrackId(player, id) {
    const pr = player.getPlayerResponse?.();
    if (pr?.videoDetails?.videoId !== id) return null;
    const tracks = (pr.streamingData?.adaptiveFormats || []).map((f) => f.audioTrack).filter(Boolean);
    const original =
      tracks.find((t) => /original/i.test(t.displayName || '')) || tracks.find((t) => t.audioIsDefault);
    return original?.id ?? null;
  }

  function applyOriginalAudio(player, id) {
    if (!setting('originalAudio')) return true;
    const tracks = player.getAvailableAudioTracks?.() || [];
    if (!tracks.length) return false; // Player noch nicht so weit
    if (tracks.length === 1) return true; // keine Synchronisation vorhanden

    const originalId = originalTrackId(player, id);
    if (!originalId) return true;
    if (isTrack(player.getAudioTrack?.(), originalId)) return true;
    const original = tracks.find((t) => isTrack(t, originalId));
    if (original) player.setAudioTrack(original);
    return true;
  }

  function applyPlayback() {
    if (location.pathname !== '/watch') return;
    const player = getPlayer();
    if (!player?.getVideoData || player.classList.contains('ad-showing')) return; // Werbung abwarten
    const id = player.getVideoData()?.video_id;
    if (!id || id !== currentVideoId()) return;

    const state = handled.get(id) ?? {};
    handled.set(id, state);
    try {
      if (!state.audio) state.audio = applyOriginalAudio(player, id);
      if (!state.quality) state.quality = applyQuality(player);
    } catch (err) {
      console.warn('[TubeFix] Wiedergabe-Einstellung fehlgeschlagen:', err);
      state.audio = state.quality = true;
    }
  }

  // ---------- Einstellungen geändert ----------

  function rerenderDates() {
    for (const span of document.querySelectorAll(`span.${DATE_CLASS}`)) {
      const date = videos.get(span.dataset.tfxId)?.date;
      if (date) setDateText(span, date);
    }
    const badge = document.getElementById(BADGE_ID);
    const date = badge && videos.get(badge.dataset.videoId)?.date;
    if (date) badge.textContent = formatWatch(date);
  }

  let playbackSettings = '';

  function onSettings() {
    rerenderDates();
    if (!setting('showSubs')) document.querySelectorAll(`.${SUBS_CLASS}`).forEach((el) => el.remove());
    if (!setting('showDesc')) document.querySelectorAll(`.${DESC_CLASS}`).forEach((el) => el.remove());
    scanLists();

    // Qualität/Tonspur nur neu setzen, wenn sich genau diese Einstellungen geändert haben.
    const now = `${setting('quality')}|${setting('originalAudio')}`;
    if (now !== playbackSettings) {
      playbackSettings = now;
      handled.clear();
      applyPlayback();
    }
  }

  // ---------- Start ----------

  document.addEventListener('tfx-settings', onSettings);
  playbackSettings = `${setting('quality')}|${setting('originalAudio')}`;

  // YouTube ist eine Single-Page-App: Seitenwechsel lösen keinen echten Reload aus.
  document.addEventListener('yt-navigate-finish', updateWatch);
  document.addEventListener('yt-page-data-updated', updateWatch);
  updateWatch();

  // Player regelmäßig prüfen: neues Video, Ende der Werbung, Autoplay.
  setInterval(applyPlayback, 1000);

  // Neue Listeneinträge (Scrollen, Navigation) erkennen – gebündelt, damit es nicht ständig läuft.
  let scanTimer = 0;
  new MutationObserver(() => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      scanLists();
    }, 300);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  scanLists();
})();
