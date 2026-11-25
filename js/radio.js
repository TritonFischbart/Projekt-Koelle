// WG-Radio: Sender aus Köln und NRW zum Hören direkt in der App.
// Eigene Sender und der Link zur gemeinsamen Playlist stehen in settings/radio.

export const DEFAULT_STATIONS = [
  { id: '1live', name: '1LIVE', icon: '🎧', hint: 'Pop, Hits, junges WDR-Radio', url: 'https://wdr-1live-live.icecastssl.wdr.de/wdr/1live/live/mp3/128/stream.mp3' },
  { id: 'wdr2', name: 'WDR 2 Rheinland', icon: '📻', hint: 'Musik und Nachrichten aus dem Rheinland', url: 'https://wdr-wdr2-rheinland.icecastssl.wdr.de/wdr/wdr2/rheinland/mp3/128/stream.mp3' },
  { id: 'wdr4', name: 'WDR 4', icon: '🎶', hint: 'Oldies und Schlager – an Karneval viel Kölsches', url: 'https://wdr-wdr4-live.icecastssl.wdr.de/wdr/wdr4/live/mp3/128/stream.mp3' },
  { id: 'cosmo', name: 'COSMO', icon: '🌍', hint: 'Musik aus aller Welt', url: 'https://wdr-cosmo-live.icecastssl.wdr.de/wdr/cosmo/live/mp3/128/stream.mp3' },
  { id: 'dlf', name: 'Deutschlandfunk', icon: '🗞️', hint: 'Nachrichten und Wortbeiträge', url: 'https://st01.sslstream.dlf.de/dlf/01/128/mp3/stream.mp3' },
  { id: 'nova', name: 'Deutschlandfunk Nova', icon: '💡', hint: 'Wissen, Gespräche, neue Musik', url: 'https://st03.sslstream.dlf.de/dlf/03/128/mp3/stream.mp3' },
];

// Eigene Sender: nur https (sonst blockiert das Handy den Ton auf einer https-Seite)
export function isStreamUrl(value) {
  try {
    const url = new URL(String(value).trim());
    return url.protocol === 'https:' && Boolean(url.hostname.includes('.'));
  } catch {
    return false;
  }
}

export function isWebUrl(value) {
  try {
    const url = new URL(String(value).trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// "https://open.spotify.com/playlist/…" -> "Spotify"
export function playlistService(value) {
  if (!isWebUrl(value)) return '';
  const host = new URL(value).hostname.replace(/^www\./, '');
  if (host.endsWith('spotify.com')) return 'Spotify';
  if (host.endsWith('music.apple.com')) return 'Apple Music';
  if (host.endsWith('youtube.com') || host === 'youtu.be') return host.startsWith('music.') ? 'YouTube Music' : 'YouTube';
  if (host.endsWith('deezer.com')) return 'Deezer';
  if (host.endsWith('soundcloud.com')) return 'SoundCloud';
  if (host.endsWith('tidal.com')) return 'Tidal';
  return host;
}

export function allStations(custom = []) {
  return [...DEFAULT_STATIONS, ...custom.map((s) => ({ ...s, icon: s.icon || '📡', custom: true }))];
}
