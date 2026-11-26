// Hauptprogramm: Anmeldung, Anzeige und Bedienung der Website.

// Die Nummer hinter ?v= bei jeder Änderung erhöhen (auch in index.html),
// damit Handys sofort die neuen Dateien laden statt alter gespeicherter.
import { PEOPLE, CATEGORIES, CHORES, PUSH_TYPES } from './config.js?v=53';
import { parseEuro, formatEuro, splitAmount, itemShares, expenseShares, computeBalances, suggestTransfers } from './money.js?v=53';
import {
  mondayOf, addDays, isoWeek, weekKey, weekIndex, planWeek, weeksUntilDue,
  guessAreaIcon, DEFAULT_AREA_ICON, AREA_ICON_CHOICES,
} from './chores.js?v=53';
import { fetchEvents, groupByDay, newEventLink, eventResource, eventFormValues } from './calendar.js?v=53';
import { SHOP_CATEGORIES, guessCategory, parseShoppingInput } from './shopcats.js?v=53';
import { isAwayForWeek, isAwayOn, upcomingAbsences } from './absences.js?v=53';
import { compressImage, RECEIPT_OPTIONS } from './images.js?v=53';
import { INVITE_TEMPLATES, isInviteActive, inviteWhen, guessInviteEmoji, inviteParticipants, isRatingOpen, ratingSummary, bestEvenings } from './invites.js?v=53';
import { allStations, isStreamUrl, isWebUrl, playlistService } from './radio.js?v=53';
import { visibleQuickNotes, agoText, QUICK_NOTE_MAX } from './quicknotes.js?v=53';
import { monthKey, addMonths, initialLastBooked, dueMonths, recurringExpenseId } from './recurring.js?v=53';
import { monthStats, monthTrend, currentMonth } from './stats.js?v=53';
import { toPlain, expensesCsv } from './export.js?v=53';
import { firebaseConfig } from './firebase-config.js?v=53';
import { weisheitDesTages } from './koelsch.js?v=53';
import { noteTextHtml, continueList } from './notetext.js?v=53';
import { loadTips, upcomingTips, tipDay, searchTips, TIP_FILTERS } from './tipps.js?v=53';
import { guessDateFromText, pollExpired, pollDay } from './polls.js?v=53';

const PERSON_IDS = PEOPLE.map((p) => p.id);
// Versionsnummer aus der Adresse dieser Datei (app.js?v=53) – zeigt, ob das Handy die neueste Version hat
const APP_VERSION = new URL(import.meta.url).searchParams.get('v') ?? '?';
const $ = (selector) => document.querySelector(selector);

const state = {
  user: null,
  me: null,
  members: {},
  expenses: [],
  payments: [],
  settlements: [],
  chores: {},
  choreWeekOffset: 0,
  areas: null,
  shopping: [],
  favorites: [],
  quickEdit: false,
  shopCatItem: null,
  notes: [],
  recurring: [],
  backup: null,
  monthOffset: 0,
  formMode: 'expense',
  pendingShopIds: [],
  items: [],
  shopOrder: null,
  loaded: {},
  editingNote: null,
  noteImages: [],
  pendingImages: [],
  removedImages: [],
  calendar: { config: null, events: null, error: null, loading: false, loadedAt: 0 },
  tab: 'start',
  absences: [],
  trips: [],
  quickNotes: [],
  radioSettings: null,
  receiptCache: {},
  formReceipts: [],
  pendingReceipts: [],
  removedReceipts: [],
  polls: [],
  invites: [],
  pushSettings: {},
  pushBusy: false,
  editingId: null,
};

let backend = null;
let unsubscribers = [];

// ---------- Kleine Helfer ----------

// Einklappbare Karten: Tipp auf die Überschrift klappt zu/auf. Jedes Handy merkt sich das selbst.
const FOLD_KEY = 'koelle.folded';
let folds = {};
try { folds = JSON.parse(localStorage.getItem(FOLD_KEY)) ?? {}; } catch { /* privater Modus */ }
const isFolded = (id, byDefault = false) => folds[id] ?? byDefault;
function toggleFold(id, byDefault = false) {
  folds[id] = !isFolded(id, byDefault);
  try { localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); } catch { /* privater Modus */ }
}
function foldButton(id, label, byDefault = false, cls = '') {
  const folded = isFolded(id, byDefault);
  const chev = '<span class="fold-chev" aria-hidden="true"></span>';
  // Pfeil ans letzte Wort kleben, damit er bei Umbruch nicht allein in der neuen Zeile steht
  const content = label.includes('<') ? `${label}${chev}` : label.replace(/(\S+)$/, `<span class="nowrap">$1${chev}</span>`);
  return `<button type="button" class="fold-btn${cls}" data-action="fold" data-fold="${id}" data-default="${byDefault ? 1 : 0}" aria-expanded="${!folded}">${content}</button>`;
}
// Karte mit Überschrift zum Einklappen. Zugeklappt steht nur eine kurze Zusammenfassung da.
function foldCard(id, { title, action = '', body, summary = '', byDefault = false }) {
  const folded = isFolded(id, byDefault);
  return `
    <section class="card foldable${folded ? ' folded' : ''}">
      <div class="card-head"><h2>${foldButton(id, title, byDefault)}</h2>${action}</div>
      ${folded ? (summary ? `<p class="fold-sum">${summary}</p>` : '') : body}
    </section>`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const person = (id) => PEOPLE.find((p) => p.id === id);
const personName = (id) => person(id)?.name ?? 'Unbekannt';
const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'string') return Date.parse(ts) || 0;
  return Number(ts) || 0;
}

function avatar(id, small = false) {
  const p = person(id);
  return `<span class="avatar${small ? ' small' : ''}" style="--c:${p?.color ?? '#888'}" aria-hidden="true">${esc(p?.name?.[0] ?? '?')}</span>`;
}

function forWhom(ids) {
  const sorted = PERSON_IDS.filter((id) => ids.includes(id));
  if (sorted.length === PERSON_IDS.length) return 'für alle';
  return `für ${sorted.map(personName).join(' & ')}`;
}

function amountClass(cents) {
  return cents > 0 ? 'plus' : cents < 0 ? 'minus' : 'even';
}

const activeExpenses = () => state.expenses.filter((e) => !e.settlementId);
const activePayments = () => state.payments.filter((p) => !p.settlementId);

let toastTimer;
let toastUndo = null;
function toast(message, isError = false, undo = null) {
  const el = $('#toast');
  $('#toast-text').textContent = message;
  toastUndo = undo;
  $('#toast-undo').hidden = !undo;
  el.className = `toast show${isError ? ' error' : ''}${undo ? ' has-action' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; toastUndo = null; }, undo ? 6000 : 2800);
}

// Löschen mit "Rückgängig": die gelöschten Einträge werden kurz gemerkt.
function removeWithUndo(message, items) {
  items.forEach(({ col, doc }) => backend.remove(col, doc.id).catch(showError));
  toast(message, false, () => {
    items.forEach(({ col, doc }) => {
      const { id, ...data } = doc;
      backend.set(col, id, data).catch(showError);
    });
    toast('Wiederhergestellt ✓');
  });
}

function showError(err) {
  console.error(err);
  if (err?.code === 'permission-denied') return showNoAccess();
  toast(`Das hat nicht geklappt: ${err?.message ?? err}`, true);
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => { el.hidden = el.id !== `screen-${name}`; });
}

// ---------- Start & Anmeldung ----------

async function start() {
  const params = new URLSearchParams(location.search);
  const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('HIER');
  try {
    if (params.has('demo')) {
      backend = (await import('./demo.js?v=53')).createDemoBackend();
    } else if (configured) {
      backend = (await import('./firebase.js?v=53')).createFirebaseBackend(firebaseConfig);
    } else {
      showScreen('setup');
      return;
    }
  } catch (err) {
    console.error(err);
    $('#setup-text').textContent = 'Die Verbindung zur Datenbank konnte nicht geladen werden. Bist du online?';
    showScreen('setup');
    return;
  }
  $('#demo-banner').hidden = !backend.isDemo;
  backend.onPushMessage?.((n) => toast(`${n.title ?? ''} ${n.body ?? ''}`.trim()));
  backend.onUser(handleUser);
}

function handleUser(user) {
  stopListeners();
  state.user = user;
  state.me = null;
  if (!user) {
    showScreen('login');
    return;
  }
  showScreen('loading');
  listen('members', (docs) => {
    state.members = Object.fromEntries(docs.map((d) => [d.id, d]));
    route();
  });
  listen('expenses', (docs) => { state.expenses = docs; state.loaded.expenses = true; scheduleRecurring(); renderAll(); });
  listen('recurring', (docs) => { state.recurring = docs; state.loaded.recurring = true; scheduleRecurring(); renderAll(); });
  listen('notes', (docs) => { state.notes = docs; renderAll(); });
  listen('noteImages', (docs) => { state.noteImages = docs; renderAll(); });
  listen('absences', (docs) => { state.absences = docs; renderAll(); });
  listen('shoppingTrips', (docs) => { state.trips = docs; renderAll(); });
  listen('quickNotes', (docs) => {
    state.quickNotes = docs;
    cleanupQuickNotes();
    renderAll();
  });
  listen('polls', (docs) => { state.polls = docs; renderAll(); });
  listen('invites', (docs) => { state.invites = docs; renderAll(); });
  listen('pushSettings', (docs) => { state.pushSettings = Object.fromEntries(docs.map((d) => [d.id, d])); renderAll(); });
  listen('payments', (docs) => { state.payments = docs; renderAll(); });
  listen('settlements', (docs) => { state.settlements = docs; renderAll(); });
  listen('chores', (docs) => { state.chores = Object.fromEntries(docs.map((d) => [d.id, d])); renderAll(); });
  listen('settings', (docs) => {
    const plan = docs.find((d) => d.id === 'putzplan');
    state.areas = plan?.areas?.length ? plan.areas : null;
    state.backup = docs.find((d) => d.id === 'backup') ?? null;
    state.shopOrder = docs.find((d) => d.id === 'einkauf')?.order ?? null;
    state.radioSettings = docs.find((d) => d.id === 'radio') ?? null;
    const kal = docs.find((d) => d.id === 'kalender');
    const config = kal?.calendarId && kal?.apiKey ? { calendarId: kal.calendarId, apiKey: kal.apiKey } : null;
    const changed = JSON.stringify(config) !== JSON.stringify(state.calendar.config);
    state.calendar.config = config;
    if (changed) {
      state.calendar.events = null;
      state.calendar.error = null;
      loadEvents();
    }
    renderAll();
  });
  listen('shopping', (docs) => { state.shopping = docs; renderAll(); });
  listen('favorites', (docs) => { state.favorites = docs; renderAll(); });
}

function listen(name, callback) {
  unsubscribers.push(backend.watch(name, callback, showError));
}

function stopListeners() {
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];
}

// Entscheidet, welcher Bildschirm gezeigt wird, sobald die Mitglieder geladen sind.
function route() {
  const mine = PEOPLE.find((p) => state.members[p.id]?.uid === state.user.uid);
  if (mine) {
    const firstTime = !state.me;
    state.me = mine.id;
    if (firstTime) {
      showScreen('app');
      renderHeader();
      switchTab(state.tab);
      refreshPushToken();
    }
    renderAll();
    return;
  }

  state.me = null;
  const free = PEOPLE.filter((p) => !state.members[p.id]?.uid);
  if (!free.length) {
    showNoAccess('Alle drei Plätze sind schon vergeben.');
    return;
  }
  $('#pick-list').innerHTML = free.map((p) => `
    <button class="pick-btn" data-action="claim" data-person="${p.id}">
      ${avatar(p.id)}<span>${esc(p.name)}</span>
    </button>`).join('');
  showScreen('pick');
}

function showNoAccess(extra = '') {
  stopListeners();
  $('#noaccess-text').textContent =
    `Du bist als ${state.user?.email ?? 'unbekannt'} angemeldet. Diese Adresse ist (noch) nicht für die WG freigeschaltet. ${extra}`;
  showScreen('noaccess');
}

async function doLogin() {
  $('#login-error').textContent = '';
  try {
    await backend.login();
  } catch (err) {
    console.error(err);
    $('#login-error').textContent =
      err?.code === 'auth/unauthorized-domain'
        ? 'Diese Website-Adresse ist in Firebase noch nicht freigegeben (siehe ANLEITUNG.md, „Autorisierte Domains“).'
        : err?.code === 'auth/network-request-failed'
          ? 'Keine Internetverbindung?'
          : `Anmeldung fehlgeschlagen: ${err?.message ?? err}`;
  }
}

function claim(id) {
  if (!confirm(`Bist du ${personName(id)}? Das lässt sich später nicht einfach ändern.`)) return;
  backend.set('members', id, {
    uid: state.user.uid,
    email: state.user.email ?? '',
    claimedAt: backend.now(),
  }).catch(showError);
}

function renderHeader() {
  const button = $('#me-button');
  button.innerHTML = avatar(state.me);
  button.setAttribute('aria-label', `Angemeldet als ${personName(state.me)} – Einstellungen`);
}

// direction: 1 = von rechts hereinschieben (nach links gewischt), -1 = von links
function switchTab(tab, direction = 0) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach((section) => { section.hidden = section.id !== `tab-${tab}`; });
  if (direction) {
    const section = $(`#tab-${tab}`);
    section.classList.remove('slide-from-right', 'slide-from-left');
    void section.offsetWidth; // Animation neu starten
    section.classList.add(direction > 0 ? 'slide-from-right' : 'slide-from-left');
  }
  const barTab = tab === 'kalender' ? 'start' : tab; // Einstellungen: kein Knopf unten markiert
  document.querySelectorAll('.tabbar button').forEach((b) => {
    if (b.dataset.tab === barTab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('.fab').hidden = tab !== 'ausgaben';
  if (tab !== 'putzplan') state.choreWeekOffset = 0;
  if (['kalender', 'start'].includes(tab) && Date.now() - state.calendar.loadedAt > 60000) loadEvents();
  window.scrollTo(0, 0);
}

function renderAll() {
  if (!state.me) return;
  renderAusgaben();
  renderEinkauf();
  renderPutzplan();
  renderKalender();
  renderInfos();
  renderSettings();
  renderStart();
  renderPanel();
  renderRadio();
  const open = myOpenChores().length;
  const tabButton = document.querySelector('.tabbar [data-tab=putzplan]');
  tabButton.classList.toggle('has-badge', open > 0);
  // Punkt an "Start", solange eine Abstimmung auf deine Stimme wartet
  // Punkt an "Start": Abstimmung oder Aktion wartet auf deine Antwort
  document.querySelector('.tabbar [data-tab=start]').classList.toggle('has-badge',
    openPolls().some((p) => p.votes?.[state.me] == null)
    || activeInvites().some((i) => i.createdBy !== state.me && !i.responses?.[state.me])
    || ratableInvites().some((i) => !i.ratings?.[state.me]));
}

// ---------- Wischen zwischen den Bereichen ----------

const TAB_ORDER = ['start', 'ausgaben', 'einkauf', 'putzplan', 'infos'];
let swipe = null;

// Als App vom Home-Bildschirm gestartet? Dann gibt es keine "Zurück"-Geste am Rand,
// und man darf auch direkt vom Rand wischen. Im Browser bleibt ein schmaler Streifen frei.
const IS_HOME_SCREEN_APP = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const EDGE = IS_HOME_SCREEN_APP ? 0 : 16;

// ---------- Nach unten ziehen = aktualisieren ----------
const PULL_DISTANCE = 90;
const PULL_ENABLED = IS_HOME_SCREEN_APP;

function showPull(dy, dx) {
  const el = $('#pull-refresh');
  if (dy < 15 || dx > dy) { hidePull(); return; }
  const top = $('#screen-app .topbar')?.getBoundingClientRect().bottom ?? 0;
  const progress = Math.min(dy / PULL_DISTANCE, 1);
  el.hidden = false;
  el.style.top = `${top + 8 + progress * 24}px`;
  el.style.opacity = String(0.3 + progress * 0.7);
  el.classList.toggle('ready', progress >= 1);
  el.querySelector('.pull-icon').style.transform = `rotate(${progress * 270}deg) scale(${0.6 + progress * 0.4})`;
  el.querySelector('.pull-text').textContent = progress >= 1 ? 'Loslassen zum Aktualisieren' : 'Zum Aktualisieren ziehen';
}

function hidePull() {
  const el = $('#pull-refresh');
  if (el && !el.classList.contains('busy')) el.hidden = true;
}

function refreshApp() {
  const el = $('#pull-refresh');
  // Ohne Netz würde ein Neuladen eine leere Seite zeigen – dann nur die Termine neu holen.
  if (!navigator.onLine) {
    loadEvents();
    toast('Kein Internet – die Daten kommen, sobald du wieder online bist.');
    return;
  }
  el.hidden = false;
  el.classList.add('busy', 'ready');
  el.querySelector('.pull-icon').style.transform = '';
  el.querySelector('.pull-text').textContent = 'Wird aktualisiert …';
  // Ganze App neu laden: holt alle Daten, die Termine und auch eine neue App-Version.
  setTimeout(() => location.reload(), 150);
}

function onTouchStart(event) {
  swipe = null;
  if (event.touches.length !== 1 || $('#screen-app').hidden) return;
  const t = event.touches[0];
  // Nicht am Bildschirmrand (dort ist die "Zurück"-Geste des Handys) und nicht in Eingabefeldern
  if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
  if (event.target.closest('input, textarea, select, dialog, .tabbar, .no-swipe')) return;
  swipe = { x: t.clientX, y: t.clientY, lastX: t.clientX, lastY: t.clientY, time: Date.now(),
    // Nach unten ziehen zum Aktualisieren: nur in der Home-Bildschirm-App (im Browser
    // hat das Handy das schon selbst) und nur ganz oben auf der Seite.
    pull: PULL_ENABLED && window.scrollY <= 0 && !document.querySelector('dialog[open]') };
  // Wird die Seite während des Wischens neu gezeichnet (neue Daten kommen an), hängt das
  // berührte Element nicht mehr in der Seite – seine Ereignisse erreichen dann `document`
  // nicht mehr. Deshalb direkt am berührten Element mithören.
  const el = event.target;
  const done = (e) => {
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', done);
    el.removeEventListener('touchcancel', done);
    if (!el.isConnected) onTouchEnd(e);
  };
  el.addEventListener('touchmove', onTouchMove, { passive: true });
  el.addEventListener('touchend', done, { passive: true });
  el.addEventListener('touchcancel', done, { passive: true });
}

// Letzte Fingerposition merken: Manche Handys melden das Ende einer Bewegung als
// "abgebrochen" (touchcancel), wenn der Browser selbst scrollen will.
function onTouchMove(event) {
  if (!swipe || event.touches.length !== 1 || event.handledBySwipe) return;
  event.handledBySwipe = true; // nicht doppelt zählen (Element und document)
  swipe.lastX = event.touches[0].clientX;
  swipe.lastY = event.touches[0].clientY;
  if (swipe.pull) showPull(swipe.lastY - swipe.y, Math.abs(swipe.lastX - swipe.x));
}

function onTouchEnd(event) {
  if (!swipe) return;
  const t = event.changedTouches?.[0];
  const x = t ? t.clientX : swipe.lastX;
  const y = t ? t.clientY : swipe.lastY;
  const dx = x - swipe.x;
  const dy = y - swipe.y;
  const quick = Date.now() - swipe.time < 800;
  const pull = swipe.pull;
  swipe = null;
  if (pull) {
    hidePull();
    if (dy >= PULL_DISTANCE && Math.abs(dx) < dy / 2) { refreshApp(); return; }
  }
  // Nur deutliches, eher waagerechtes Wischen zählt
  if (!quick || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
  if (document.querySelector('dialog[open]')) return;
  if (state.tab === 'settings') return; // Einstellungen liegen außerhalb der Reihe
  const current = state.tab === 'kalender' ? 'start' : state.tab;
  const next = TAB_ORDER[TAB_ORDER.indexOf(current) + (dx < 0 ? 1 : -1)];
  if (next) switchTab(next, dx < 0 ? 1 : -1);
}

// ---------- Ausgaben anzeigen ----------

function renderAusgaben() {
  if (!state.me) return;
  const expenses = activeExpenses();
  const payments = activePayments();
  const balances = computeBalances(PERSON_IDS, expenses, payments);
  const transfers = suggestTransfers(balances, PERSON_IDS);

  $('#tab-ausgaben').innerHTML = [
    heroCard(balances[state.me]),
    balancesCard(balances),
    transfersCard(transfers, expenses.length + payments.length > 0),
    entriesCard(expenses, payments),
    moreCard(),
  ].join('');
}

// Seltener Gebrauchtes öffnet sich als Fenster von unten, statt die Seite lang zu machen.
function moreCard() {
  const rows = [];
  if (state.expenses.length) {
    const month = currentMonth();
    rows.push(['month', '📊', 'Monatsübersicht', `${monthName(month)}: ${formatEuro(monthStats(state.expenses, month).total)}`]);
  }
  const rec = state.recurring.length;
  rows.push(['recurring', '🔁', 'Daueraufträge', rec ? `${rec} ${rec === 1 ? 'Auftrag' : 'Aufträge'} · jeden Monat automatisch` : 'z. B. Internet, Strom oder Netflix']);
  const done = state.settlements.length;
  if (done) rows.push(['history', '🗂️', 'Frühere Abrechnungen', `${done} ${done === 1 ? 'Abrechnung' : 'Abrechnungen'}`]);
  return `
    <section class="card">
      <ul class="entries">${rows.map(([id, icon, title, sub]) => `
        <li><button class="entry" data-action="panel-open" data-panel="${id}">
          <span class="entry-icon" aria-hidden="true">${icon}</span>
          <span class="entry-main"><span class="entry-title">${title}</span><span class="entry-sub">${sub}</span></span>
          <span class="entry-arrow" aria-hidden="true">›</span>
        </button></li>`).join('')}</ul>
    </section>`;
}

// ---------- Fenster von unten (Inhalt wird bei neuen Daten mit aktualisiert) ----------

const PANELS = {
  month: () => ({ title: '📊 Monatsübersicht', body: monthBody() }),
  recurring: () => ({ title: '🔁 Daueraufträge', body: recurringBody() }),
  history: () => ({ title: '🗂️ Frühere Abrechnungen', body: historyBody() }),
  'note-new': () => ({ title: '＋ Neue Notiz', body: noteNewBody() }),
  'note-sort': () => ({ title: '↕️ Notizen sortieren', body: noteSortBody() }),
  best: () => ({ title: '🏆 Beste WG-Abende', body: bestEveningsBody() }),
  receipts: () => ({
    title: '🧾 Kassenbons',
    body: `<div class="note-thumbs">${(state.receiptCache[state.receiptPanel] ?? []).map((r, i) => `
      <button type="button" class="receipt-view" data-action="receipt-panel-view" data-key="${i}" aria-label="Kassenbon ${i + 1} groß ansehen"><img src="${esc(r.data)}" alt="Kassenbon ${i + 1}"></button>`).join('')}</div>
      <p class="hint">Antippen = groß ansehen.</p>`,
  }),
};

function openPanel(id) {
  if (!PANELS[id]) return;
  state.panel = id;
  if (id === 'month') state.monthOffset = 0;
  renderPanel();
  const dialog = $('#panel-dialog');
  if (!dialog.open) dialog.showModal();
}

function renderPanel() {
  if (!state.panel || !state.me) return;
  const content = PANELS[state.panel]();
  $('#panel-title').textContent = content.title;
  $('#panel-body').innerHTML = content.body;
}

function closePanel() {
  if ($('#panel-dialog').open) $('#panel-dialog').close();
}

function heroCard(balance) {
  const text = balance > 0 ? 'du bekommst noch' : balance < 0 ? 'du schuldest noch' : 'du bist ausgeglichen';
  return `
    <section class="card hero ${amountClass(balance)}">
      <p class="hero-label">Hallo ${esc(personName(state.me))}, ${text}</p>
      <p class="hero-amount">${balance === 0 ? '🎉' : formatEuro(Math.abs(balance))}</p>
    </section>`;
}

function balancesCard(balances) {
  const rows = PEOPLE.map((p) => {
    const b = balances[p.id];
    const label = b > 0 ? 'bekommt' : b < 0 ? 'schuldet' : 'ausgeglichen';
    return `
      <li class="row">
        ${avatar(p.id)}
        <span class="row-name">${esc(p.name)}${p.id === state.me ? ' (du)' : ''}<small>${label}</small></span>
        <span class="amount ${amountClass(b)}">${b === 0 ? '–' : `${b > 0 ? '+' : '−'} ${formatEuro(Math.abs(b))}`}</span>
      </li>`;
  }).join('');
  return `<section class="card"><h2>Kontostände</h2><ul class="rows">${rows}</ul></section>`;
}

function transfersCard(transfers, hasEntries) {
  const list = transfers.length
    ? `<ul class="transfers">${transfers.map((t) => `
        <li class="transfer">
          <span class="transfer-who">
            ${avatar(t.from, true)}<span class="arrow">→</span>${avatar(t.to, true)}
            <span class="transfer-text"><strong>${esc(personName(t.from))}</strong> zahlt <strong>${esc(personName(t.to))}</strong></span>
          </span>
          <span class="transfer-right">
            <span class="amount">${formatEuro(t.amountCents)}</span>
            <button class="btn small" data-action="mark-paid" data-from="${t.from}" data-to="${t.to}" data-amount="${t.amountCents}">Überwiesen ✓</button>
          </span>
        </li>`).join('')}</ul>`
    : '<p class="empty">Niemand schuldet jemandem etwas. 🎉</p>';

  const settle = hasEntries
    ? `<button class="btn outline full" data-action="settle-all">Alles ausgeglichen – neu starten</button>
       <p class="hint">Setzt alles auf 0. Die Einträge bleiben unter „Frühere Abrechnungen“ sichtbar.</p>`
    : '';

  return `<section class="card"><h2>So gleicht ihr aus</h2>${list}${settle}</section>`;
}

// ---------- Monatsübersicht ----------

function monthName(key, short = false) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', short ? { month: 'short' } : { month: 'long', year: 'numeric' });
}

function barList(entries, label) {
  const max = Math.max(...entries.map(([, cents]) => cents), 1);
  return `<ul class="bars">${entries.map(([key, cents]) => `
    <li>
      <div class="bar-label"><span>${label(key)}</span><span class="amount">${formatEuro(cents)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, (cents / max) * 100)}%"></div></div>
    </li>`).join('')}</ul>`;
}

function monthBody() {
  if (!state.expenses.length) return '<p class="empty">Noch keine Ausgaben.</p>';
  const month = addMonths(currentMonth(), state.monthOffset);
  const stats = monthStats(state.expenses, month);
  const trend = monthTrend(state.expenses, month, 6);
  const trendMax = Math.max(...trend.map((t) => t.total), 1);

  const categories = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]);
  const payers = PERSON_IDS.filter((id) => stats.byPayer[id]).map((id) => [id, stats.byPayer[id]]);

  return `
    <div class="month-panel">
      <div class="week-nav">
        <button class="icon-btn" data-action="month" data-step="-1" aria-label="Monat zurück">‹</button>
        <button class="week-title" data-action="month" data-step="0">
          <strong>${monthName(month)}</strong>
          <small>${state.monthOffset ? 'Tippen = aktueller Monat' : 'aktueller Monat'}</small>
        </button>
        <button class="icon-btn" data-action="month" data-step="1" aria-label="Monat vor"${state.monthOffset >= 0 ? ' disabled' : ''}>›</button>
      </div>
      <p class="month-total">${formatEuro(stats.total)}<small>${stats.count} Ausgaben</small></p>
      <div class="trend" aria-label="Ausgaben der letzten 6 Monate">${trend.map((t) => `
        <div class="trend-col${t.month === month ? ' active' : ''}">
          <div class="trend-bar" style="height:${Math.max(4, (t.total / trendMax) * 100)}%"></div>
          <span>${monthName(t.month, true)}</span>
        </div>`).join('')}</div>
      ${stats.count ? `
        <h3 class="sub-title">Wofür</h3>
        ${barList(categories, (id) => `${categoryOf(id).icon} ${esc(categoryOf(id).name)}`)}
        <h3 class="sub-title">Wer hat bezahlt</h3>
        ${barList(payers, (id) => esc(personName(id)))}` : '<p class="empty">In diesem Monat gibt es keine Ausgaben.</p>'}
      <p class="hint">Zählt alle Ausgaben, auch schon abgerechnete.</p>
    </div>`;
}

// ---------- Daueraufträge ----------

function recurringBody() {
  const items = [...state.recurring].sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  const list = items.length
    ? `<ul class="entries">${items.map((r) => `
        <li><button class="entry" data-action="edit-recurring" data-id="${esc(r.id)}">
          <span class="entry-icon" aria-hidden="true">🔁</span>
          <span class="entry-main">
            <span class="entry-title">${esc(r.description)}</span>
            <span class="entry-sub">jeden ${r.dayOfMonth}. · ${esc(personName(r.paidBy))} zahlt · ${esc(forWhom(r.splitAmong ?? []))}</span>
          </span>
          <span class="entry-right"><span class="amount">${formatEuro(r.amountCents)}</span></span>
        </button></li>`).join('')}</ul>`
    : '<p class="empty">Noch keine. Zum Beispiel Internet, Strom oder Netflix.</p>';
  return `
    ${list}
    <button class="btn outline full" data-action="add-recurring">＋ Neuer Dauerauftrag</button>
    <p class="hint">Werden am gewählten Tag jeden Monat automatisch als Ausgabe eingetragen. Antippen zum Ändern oder Löschen.</p>`;
}

// Fällige Daueraufträge eintragen – kurz warten, bis die Daten vom Server da sind.
let recurringTimer;
const bookedThisSession = new Set();
function scheduleRecurring() {
  if (!state.loaded.expenses || !state.loaded.recurring) return;
  clearTimeout(recurringTimer);
  recurringTimer = setTimeout(bookRecurring, backend.isDemo ? 300 : 3000);
}

function bookRecurring() {
  for (const rec of state.recurring) {
    const months = dueMonths(rec);
    if (!months.length) continue;
    for (const month of months) {
      const id = recurringExpenseId(rec.id, month);
      if (bookedThisSession.has(id) || state.expenses.some((e) => e.id === id)) continue;
      bookedThisSession.add(id);
      backend.set('expenses', id, {
        description: rec.description,
        amountCents: rec.amountCents,
        paidBy: rec.paidBy,
        splitAmong: rec.splitAmong,
        category: rec.category,
        date: `${month}-${String(rec.dayOfMonth).padStart(2, '0')}`,
        recurringId: rec.id,
        createdAt: backend.now(),
        createdBy: 'auto',
        settlementId: null,
      }).catch(showError);
      toast(`Dauerauftrag eingetragen: ${rec.description}`);
    }
    backend.update('recurring', rec.id, { lastBooked: months[months.length - 1] }).catch(showError);
  }
}

function sortedEntries(expenses, payments) {
  return [
    ...expenses.map((e) => ({ type: 'expense', item: e })),
    ...payments.map((p) => ({ type: 'payment', item: p })),
  ].sort((a, b) => (b.item.date ?? '').localeCompare(a.item.date ?? '')
    || toMillis(b.item.createdAt) - toMillis(a.item.createdAt));
}

function expenseRow(e, readonly) {
  const c = categoryOf(e.category);
  const myShare = expenseShares(e, PERSON_IDS)[state.me];
  const inner = `
    <span class="entry-icon" aria-hidden="true">${c.icon}</span>
    <span class="entry-main">
      <span class="entry-title">${e.recurringId ? '🔁 ' : ''}${esc(e.description)}${e.receipts ? ' <span class="receipt-flag" title="mit Kassenbon">🧾</span>' : ''}</span>
      <span class="entry-sub">${esc(personName(e.paidBy))} hat bezahlt · ${esc(forWhom(e.splitAmong ?? []))}${e.items ? ' (nach Posten)' : e.shares ? ' (ungleich)' : ''} · ${formatDate(e.date)}</span>
    </span>
    <span class="entry-right">
      <span class="amount">${formatEuro(e.amountCents)}</span>
      <span class="entry-share">${myShare ? `dein Anteil ${formatEuro(myShare)}` : 'ohne dich'}</span>
    </span>`;
  return readonly
    ? (e.receipts
      ? `<li><button class="entry" data-action="receipt-show" data-id="${esc(e.id)}" aria-label="Kassenbon ansehen">${inner}</button></li>`
      : `<li><div class="entry">${inner}</div></li>`)
    : `<li><button class="entry" data-action="edit-expense" data-id="${esc(e.id)}">${inner}</button></li>`;
}

function paymentRow(p, readonly) {
  return `
    <li><div class="entry">
      <span class="entry-icon" aria-hidden="true">💸</span>
      <span class="entry-main">
        <span class="entry-title">${esc(personName(p.from))} → ${esc(personName(p.to))}</span>
        <span class="entry-sub">Überweisung · ${formatDate(p.date)}</span>
      </span>
      <span class="entry-right">
        <span class="amount">${formatEuro(p.amountCents)}</span>
        ${readonly ? '' : `<button class="link-btn" data-action="undo-payment" data-id="${esc(p.id)}">Rückgängig</button>`}
      </span>
    </div></li>`;
}

function entryList(expenses, payments, readonly) {
  return `<ul class="entries">${sortedEntries(expenses, payments)
    .map(({ type, item }) => (type === 'expense' ? expenseRow(item, readonly) : paymentRow(item, readonly)))
    .join('')}</ul>`;
}

function entriesCard(expenses, payments) {
  const body = expenses.length + payments.length
    ? entryList(expenses, payments, false)
    : '<p class="empty">Noch keine Ausgaben. Tippe unten auf „＋ Ausgabe“.</p>';
  return `<section class="card">
    <div class="card-head"><h2>Einträge</h2><button class="link-btn" data-action="search-open">🔍 Suchen</button></div>
    ${body}
  </section>`;
}

function historyBody() {
  const openIds = new Set([...document.querySelectorAll('details.history[open]')].map((d) => d.dataset.id));
  if (!state.settlements.length) return '<p class="empty">Noch keine Abrechnungen.</p>';
  const items = [...state.settlements]
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    .map((s) => {
      const day = new Date(toMillis(s.createdAt)).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
      const expenses = state.expenses.filter((e) => e.settlementId === s.id);
      const payments = state.payments.filter((p) => p.settlementId === s.id);
      return `
        <details class="history" data-id="${esc(s.id)}"${openIds.has(s.id) ? ' open' : ''}>
          <summary><span>Abrechnung vom ${day}</span><span class="muted">${s.expenseCount} Ausgaben · ${formatEuro(s.totalCents ?? 0)}</span></summary>
          ${entryList(expenses, payments, true)}
        </details>`;
    }).join('');
  return `${items}<p class="hint">Antippen, um die Einträge einer Abrechnung zu sehen.</p>`;
}

// ---------- Putzplan ----------

// Die Bereiche aus der App – oder die Standard-Bereiche aus config.js.
const choreAreas = () => state.areas ?? CHORES;

// Alle Aufgaben einer Woche mit der Person, die (nach Tausch) dran ist.
const EVERY_LABELS = { 1: 'jede Woche', 2: 'alle 2 Wochen', 4: 'alle 4 Wochen' };

// Alle in dieser Woche fälligen Aufgaben mit der Person, die (nach Tausch) dran ist.
function weekChores(monday) {
  const key = weekKey(monday);
  const idx = weekIndex(monday);
  // Wer in dieser Woche (fast) die ganze Zeit weg ist, bekommt keine Aufgabe.
  const present = PERSON_IDS.filter((id) => !isAwayForWeek(state.absences, id, monday));
  return planWeek(PERSON_IDS, present, choreAreas(), idx).map(({ area: chore, base, planned }) => {
    const docId = `${key}_${chore.id}`;
    const saved = state.chores[docId];
    const away = !present.includes(base);
    return {
      chore,
      docId,
      week: key,
      planned,
      awayPerson: away ? base : null,
      assignee: saved?.assignee ?? planned,
      doneBy: saved?.doneBy ?? null,
      saved,
    };
  });
}

const thisMonday = () => mondayOf(new Date());
const myOpenChores = () => weekChores(thisMonday()).filter((c) => c.assignee === state.me && !c.doneBy);


function weekTitle(offset, monday) {
  if (offset === 0) return 'Diese Woche';
  if (offset === 1) return 'Nächste Woche';
  if (offset === -1) return 'Letzte Woche';
  return `KW ${isoWeek(monday).week}`;
}

function weekRange(monday) {
  const opts = { day: 'numeric', month: 'short' };
  return `KW ${isoWeek(monday).week} · ${monday.toLocaleDateString('de-DE', opts)} – ${addDays(monday, 6).toLocaleDateString('de-DE', opts)}`;
}

function saveChore(c, changes) {
  backend.set('chores', c.docId, {
    week: c.week,
    chore: c.chore.id,
    assignee: c.assignee,
    doneBy: c.doneBy,
    doneAt: c.saved?.doneAt ?? null,
    ...changes,
    updatedBy: state.me,
    updatedAt: backend.now(),
  }).catch(showError);
}

function findChore(docId) {
  const monday = addDays(thisMonday(), state.choreWeekOffset * 7);
  return weekChores(monday).find((c) => c.docId === docId);
}

function choreDoneThisWeek(docId) {
  const c = weekChores(thisMonday()).find((x) => x.docId === docId);
  if (!c) return;
  saveChore(c, { doneBy: state.me, doneAt: backend.now() });
  toast(`${c.chore.name} erledigt – danke! 💪`);
}

function choreDone(docId) {
  const c = findChore(docId);
  if (!c) return;
  saveChore(c, { doneBy: state.me, doneAt: backend.now() });
  toast(`${c.chore.name} erledigt – danke! 💪`);
}

function choreUndo(docId) {
  const c = findChore(docId);
  if (c) saveChore(c, { doneBy: null, doneAt: null });
}

function choreTake(docId) {
  const c = findChore(docId);
  if (!c || !confirm(`Übernimmst du ${c.chore.name} für ${personName(c.assignee)}?`)) return;
  saveChore(c, { assignee: state.me });
  toast(`Du hast ${c.chore.name} übernommen ✓`);
}

function choreGiveBack(docId) {
  const c = findChore(docId);
  if (!c || !confirm(`${c.chore.name} wieder an ${personName(c.planned)} zurückgeben?`)) return;
  saveChore(c, { assignee: c.planned });
}

function choreItem(c, offset) {
  const mine = c.assignee === state.me;
  const swapped = c.assignee !== c.planned;
  const who = `
    <span class="chore-who">
      ${avatar(c.assignee, true)}
      <span>${mine ? 'Du' : esc(personName(c.assignee))}${swapped ? ` <em>(übernommen von ${esc(personName(c.planned))})</em>` : ''}${c.awayPerson && !swapped ? ` <em>(statt ${esc(personName(c.awayPerson))} – nicht da)</em>` : ''}</span>
    </span>`;

  let actions = '';
  if (c.doneBy) {
    actions = `
      <span class="done-label">✓ erledigt${c.doneBy !== c.assignee ? ` von ${esc(personName(c.doneBy))}` : ''}</span>
      <button class="link-btn" data-action="chore-undo" data-id="${c.docId}">Rückgängig</button>`;
  } else {
    if (mine && offset <= 0) actions += `<button class="btn small primary" data-action="chore-done" data-id="${c.docId}">Erledigt ✓</button>`;
    if (!mine) actions += `<button class="btn small" data-action="chore-take" data-id="${c.docId}">Ich übernehme</button>`;
    if (swapped && (mine || c.planned === state.me)) actions += `<button class="link-btn" data-action="chore-giveback" data-id="${c.docId}">Zurückgeben</button>`;
  }

  return `
    <li class="chore${c.doneBy ? ' done' : ''}${mine ? ' mine' : ''}">
      <span class="entry-icon" aria-hidden="true">${c.doneBy ? '✅' : c.chore.icon}</span>
      <span class="entry-main">
        <span class="entry-title">${esc(c.chore.name)}</span>
        <span class="entry-sub">${esc(c.chore.details)}${(c.chore.every ?? 1) > 1 ? ` · ${EVERY_LABELS[c.chore.every] ?? ''}` : ''}</span>
        ${who}
      </span>
      <span class="chore-actions">${actions}</span>
    </li>`;
}

function choreHero() {
  const all = weekChores(thisMonday()).filter((c) => c.assignee === state.me);
  const open = all.filter((c) => !c.doneBy);
  if (!all.length) {
    return '<section class="card hero even"><p class="hero-label">Diese Woche hast du keine Aufgabe</p><p class="hero-amount">😎</p></section>';
  }
  if (!open.length) {
    return '<section class="card hero even"><p class="hero-label">Deine Aufgaben für diese Woche sind erledigt</p><p class="hero-amount">💪</p></section>';
  }
  return `
    <section class="card hero plus">
      <p class="hero-label">Diese Woche bist du dran mit</p>
      <p class="hero-amount chore-hero">${open.map((c) => `${c.chore.icon} ${esc(c.chore.name)}`).join('<br>')}</p>
    </section>`;
}

// "Diese Woche nicht dran: 🍾 Altglas (wieder in KW 47)"
function notDueLine(monday) {
  const idx = weekIndex(monday);
  const due = new Set(weekChores(monday).map((c) => c.chore.id));
  const rest = choreAreas()
    .map((area, i) => ({ area, i }))
    .filter(({ area }) => !due.has(area.id));
  if (!rest.length) return '';
  return `<p class="not-due">Diese Woche nicht dran: ${rest.map(({ area, i }) => {
    const next = addDays(monday, weeksUntilDue(area.every, i, idx) * 7);
    return `${area.icon} ${esc(area.name)} <small>(wieder in KW ${isoWeek(next).week})</small>`;
  }).join(', ')}</p>`;
}

function upcomingCard() {
  const columns = `style="grid-template-columns: 52px repeat(${choreAreas().length}, minmax(0, 1fr))"`;
  const rows = [1, 2, 3, 4].map((n) => {
    const monday = addDays(thisMonday(), n * 7);
    const byArea = Object.fromEntries(weekChores(monday).map((c) => [c.chore.id, c]));
    const cells = choreAreas().map((area) => {
      const c = byArea[area.id];
      return c
        ? `<span class="plan-cell">${avatar(c.assignee, true)}<span>${esc(personName(c.assignee))}</span></span>`
        : '<span class="plan-cell off">–</span>';
    }).join('');
    return `<li class="plan-row" ${columns}><span class="plan-week">KW ${isoWeek(monday).week}</span>${cells}</li>`;
  }).join('');
  const head = choreAreas().map((c) => `<span class="plan-cell head">${c.icon} ${esc(c.name)}</span>`).join('');
  return foldCard('plan', {
    title: '📆 Die nächsten Wochen',
    byDefault: true,
    summary: 'Wer in den nächsten 4 Wochen dran ist',
    body: `<ul class="plan"><li class="plan-row plan-head" ${columns}><span class="plan-week"></span>${head}</li>${rows}</ul>`,
  });
}

function renderPutzplan() {
  const offset = state.choreWeekOffset;
  const monday = addDays(thisMonday(), offset * 7);
  $('#tab-putzplan').innerHTML = `
    ${choreHero()}
    <section class="card">
      <div class="week-nav">
        <button class="icon-btn" data-action="week" data-step="-1" aria-label="Woche zurück">‹</button>
        <button class="week-title" data-action="week" data-step="0">
          <strong>${weekTitle(offset, monday)}</strong>
          <small>${weekRange(monday)}</small>
        </button>
        <button class="icon-btn" data-action="week" data-step="1" aria-label="Woche vor">›</button>
      </div>
      <ul class="chores">${weekChores(monday).map((c) => choreItem(c, offset)).join('')}</ul>
      ${notDueLine(monday)}
      <p class="hint">Jemand hat spontan Zeit? Mit „Ich übernehme“ könnt ihr Aufgaben tauschen.</p>
    </section>
    <button class="btn outline full" data-action="edit-areas">✏️ Bereiche bearbeiten</button>
    ${upcomingCard()}`;
}

// ---------- Putzplan-Bereiche bearbeiten ----------

// Bereiche, die noch das Standard-Symbol haben, bekommen automatisch ein passendes
// (bis man selbst eines auswählt).
function areaRow(area) {
  const auto = !area.icon || area.icon === DEFAULT_AREA_ICON;
  const icon = auto ? guessAreaIcon(area.name) : area.icon;
  return `
    <div class="area-row" data-id="${esc(area.id)}" data-auto-icon="${auto}">
      <button type="button" class="area-icon" data-action="area-icon" data-icon="${esc(icon)}" aria-label="Symbol auswählen">${esc(icon)}</button>
      <div class="area-fields">
        <input class="area-name" value="${esc(area.name)}" maxlength="30" placeholder="Name, z. B. Bad">
        <input class="area-details" value="${esc(area.details)}" maxlength="120" placeholder="Was gehört dazu?">
        <select class="area-every" aria-label="Wie oft?">${Object.entries(EVERY_LABELS).map(([value, label]) => `
          <option value="${value}"${Number(value) === (Number(area.every) || 1) ? ' selected' : ''}>🔁 ${label}</option>`).join('')}
        </select>
      </div>
      <button type="button" class="icon-btn" data-action="remove-area" aria-label="Bereich löschen">✕</button>
    </div>`;
}

function setAreaIcon(row, icon) {
  const button = row.querySelector('.area-icon');
  button.dataset.icon = icon;
  button.textContent = icon;
}

// Symbol-Auswahl unter dem angetippten Bereich auf- und zuklappen
function toggleIconPicker(row) {
  const open = row.nextElementSibling?.classList.contains('icon-picker');
  document.querySelectorAll('#areas-list .icon-picker').forEach((p) => p.remove());
  if (open) return;
  const current = row.querySelector('.area-icon').dataset.icon;
  row.insertAdjacentHTML('afterend', `
    <div class="icon-picker">${AREA_ICON_CHOICES.map((icon) => `
      <button type="button" class="icon-choice${icon === current ? ' active' : ''}" data-action="area-icon-pick" data-icon="${icon}">${icon}</button>`).join('')}
    </div>`);
}

function pickAreaIcon(button) {
  const picker = button.closest('.icon-picker');
  const row = picker.previousElementSibling;
  setAreaIcon(row, button.dataset.icon);
  row.dataset.autoIcon = 'false';
  picker.remove();
}

function openAreasForm() {
  $('#areas-list').innerHTML = choreAreas().map(areaRow).join('');
  $('#areas-error').textContent = '';
  $('#areas-dialog').showModal();
}

function addArea() {
  const id = `b${Date.now().toString(36)}`;
  $('#areas-list').insertAdjacentHTML('beforeend', areaRow({ id, icon: DEFAULT_AREA_ICON, name: '', details: '' }));
  $(`#areas-list [data-id="${id}"] .area-name`).focus();
}

function onSubmitAreas(event) {
  event.preventDefault();
  const areas = [...document.querySelectorAll('#areas-list .area-row')].map((row) => ({
    id: row.dataset.id,
    icon: row.querySelector('.area-icon').dataset.icon || DEFAULT_AREA_ICON,
    name: row.querySelector('.area-name').value.trim(),
    details: row.querySelector('.area-details').value.trim(),
    every: Number(row.querySelector('.area-every').value) || 1,
  }));
  const problem = !areas.length ? 'Es muss mindestens einen Bereich geben.'
    : areas.some((a) => !a.name) ? 'Bitte jedem Bereich einen Namen geben.'
      : areas.length > 8 ? 'Bitte höchstens 8 Bereiche.'
        : '';
  if (problem) {
    $('#areas-error').textContent = problem;
    return;
  }
  backend.set('settings', 'putzplan', { areas, updatedBy: state.me, updatedAt: backend.now() }).catch(showError);
  $('#areas-dialog').close();
  toast('Putzplan geändert ✓');
}

// ---------- Einkaufsliste ----------

function renderEinkauf() {
  const open = state.shopping.filter((i) => !i.doneBy)
    .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  const done = state.shopping.filter((i) => i.doneBy)
    .sort((a, b) => toMillis(b.doneAt) - toMillis(a.doneAt));

  const groups = shopCategories()
    .map((cat) => ({ cat, items: open.filter((i) => shopCategoryOf(i) === cat.id) }))
    .filter((g) => g.items.length);
  const openList = open.length
    ? `${groups.map((g) => `
        <h3 class="shop-cat">${g.cat.icon} ${esc(g.cat.name)}</h3>
        <ul class="shop">${g.items.map((i) => `
          <li class="shop-row">
            <button class="shop-item" data-action="shop-toggle" data-id="${esc(i.id)}">
              <span class="shop-check" aria-hidden="true"></span>
              <span class="shop-name">${i.amount ? `<span class="shop-amount">${esc(i.amount)}</span> ` : ''}${esc(i.name)}</span>
              <span class="shop-meta">${esc(personName(i.addedBy))}</span>
            </button>
            <button class="icon-btn small" data-action="shop-category" data-id="${esc(i.id)}" aria-label="Kategorie von ${esc(i.name)} ändern">${g.cat.icon}</button>
            <button class="icon-btn small" data-action="shop-delete" data-id="${esc(i.id)}" aria-label="${esc(i.name)} löschen">✕</button>
          </li>`).join('')}</ul>`).join('')}
       <p class="hint">Antippen, wenn du es besorgt hast. Falsche Kategorie? Tippe auf das Symbol rechts.</p>`
    : '<p class="empty">Alles da! Nichts auf der Liste. 🎉</p>';

  const myBought = myUnbilledShopping();
  const doneCard = done.length ? `
    <section class="card">
      <div class="card-head"><h2>Besorgt</h2><button class="link-btn" data-action="shop-clear">Liste aufräumen</button></div>
      <ul class="shop">${done.map((i) => `
        <li class="shop-row">
          <button class="shop-item done" data-action="shop-toggle" data-id="${esc(i.id)}">
            <span class="shop-check" aria-hidden="true">✓</span>
            <span class="shop-name">${i.amount ? `<span class="shop-amount">${esc(i.amount)}</span> ` : ''}${esc(i.name)}</span>
            <span class="shop-meta">von ${esc(personName(i.doneBy))}</span>
          </button>
        </li>`).join('')}</ul>
      ${myBought.length ? `<button class="btn primary full" data-action="shop-to-expense">🧾 Als Ausgabe eintragen (${myBought.length} ${myBought.length === 1 ? 'Sache' : 'Sachen'})</button>
        <p class="hint">Trägt deine besorgten Sachen als Ausgabe ein – du musst nur noch den Betrag eingeben.</p>` : ''}
    </section>` : '';

  $('#shop-list').innerHTML = `
    ${tripCard()}
    <section class="card">
      <div class="card-head"><h2>Fehlt noch</h2><button class="link-btn" data-action="shoporder-open">↕️ Reihenfolge</button></div>
      ${openList}
    </section>
    ${doneCard}`;

  $('#shop-quick').innerHTML = renderQuickPicks();

  const tabButton = document.querySelector('.tabbar [data-tab=einkauf]');
  tabButton.dataset.count = open.length || '';
}

// „Ich geh jetzt einkaufen“: Die anderen sehen 2 Stunden lang einen Hinweis (und bekommen
// eine Push-Nachricht), damit sie schnell noch etwas auf die Liste setzen können.
const TRIP_HOURS = 2;
function activeTrips() {
  const now = Date.now();
  return state.trips.filter((t) => now - toMillis(t.at) < TRIP_HOURS * 3600000);
}
function tripTime(t) {
  return new Date(toMillis(t.at)).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
function tripCard() {
  const trips = activeTrips();
  const mine = trips.find((t) => t.person === state.me);
  const others = trips.filter((t) => t.person !== state.me);
  const otherLines = others.map((t) => `
      <p class="trip-line"><span aria-hidden="true">🏃</span><span><strong>${esc(personName(t.person))} geht gerade einkaufen</strong> (seit ${tripTime(t)}) – trag schnell noch ein, was fehlt!</span></p>`).join('');
  const myPart = mine
    ? `<div class="trip-me"><span>🛒 Du bist unterwegs – die anderen wissen Bescheid.</span><button class="btn outline" data-action="trip-end">Bin zurück</button></div>`
    : `<button class="btn outline full" data-action="trip-start">🏃 Ich geh jetzt einkaufen</button>
      <p class="hint">Die anderen bekommen Bescheid und können schnell noch etwas auf die Liste setzen.</p>`;
  return `<section class="card trip${others.length ? ' trip-active' : ''}">${otherLines}${myPart}</section>`;
}
function tripStart() {
  backend.set('shoppingTrips', state.me, { person: state.me, at: new Date().toISOString() })
    .then(() => toast('Die anderen wissen Bescheid 🏃'))
    .catch(showError);
}
function tripEnd() {
  backend.remove('shoppingTrips', state.me).catch(showError);
}

// Schnellauswahl: Was mindestens so oft eingetragen wurde, erscheint als Knopf.
const QUICK_MIN_COUNT = 2;
const QUICK_MAX = 10;

// Firestore erlaubt keinen "/" in Namen von Einträgen.
const favoriteId = (name) => encodeURIComponent(name.trim().toLowerCase());
const openShoppingNames = () => new Set(state.shopping.filter((i) => !i.doneBy).map((i) => i.name.toLowerCase()));

function renderQuickPicks() {
  const onList = openShoppingNames();
  const picks = state.favorites
    .filter((f) => f.count >= QUICK_MIN_COUNT && (state.quickEdit || !onList.has(f.name.toLowerCase())))
    .sort((a, b) => b.count - a.count || toMillis(b.lastUsed) - toMillis(a.lastUsed))
    .slice(0, QUICK_MAX);
  if (!picks.length) {
    state.quickEdit = false;
    return '';
  }
  const action = state.quickEdit ? 'quick-remove' : 'quick-add';
  return `
    <section class="card quick${state.quickEdit ? ' editing' : ''}">
      <div class="card-head">
        <h2>Schnellauswahl</h2>
        <button class="link-btn" data-action="quick-edit">${state.quickEdit ? 'Fertig' : 'Bearbeiten'}</button>
      </div>
      <div class="quick-chips">${picks.map((f) => `
        <button class="quick-chip" data-action="${action}" data-id="${esc(f.id)}">
          ${state.quickEdit ? '✕' : '＋'} ${esc(f.name)}
        </button>`).join('')}</div>
      ${state.quickEdit ? '<p class="hint">Antippen, um es aus der Schnellauswahl zu entfernen.</p>' : ''}
    </section>`;
}

// entries: Texte wie "2x Milch" oder Objekte { name, amount }
function addShoppingItems(entries) {
  const onList = openShoppingNames();
  const parsed = entries.map((e) => (typeof e === 'string' ? parseShoppingInput(e) : e)).filter((e) => e.name);
  const seen = new Set();
  const fresh = parsed.filter((e) => {
    const key = e.name.toLowerCase();
    if (onList.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  fresh.forEach(({ name, amount }) => {
    const id = favoriteId(name);
    const known = state.favorites.find((f) => f.id === id);
    const category = known?.category ?? guessCategory(name);
    backend.add('shopping', { name: known?.name ?? name, amount: amount ?? '', category, addedBy: state.me, createdAt: backend.now(), doneBy: null, doneAt: null }).catch(showError);
    // Mitzählen, wie oft etwas gebraucht wird (und in welcher Kategorie).
    backend.set('favorites', id, {
      name: known?.name ?? name,
      count: (known?.count ?? 0) + 1,
      category,
      lastUsed: backend.now(),
    }).catch(showError);
  });
  if (fresh.length < parsed.length) toast('Steht schon auf der Liste');
}

function onSubmitShopping(event) {
  event.preventDefault();
  const input = $('#shop-input');
  // Mehrere Sachen auf einmal: "Milch, Eier, Brot"
  const names = input.value.split(',').map((n) => n.trim()).filter(Boolean);
  if (!names.length) return;
  addShoppingItems(names);
  input.value = '';
}

// Kategorien in der Reihenfolge eures Supermarkts (in der App einstellbar)
function shopCategories() {
  if (!state.shopOrder?.length) return SHOP_CATEGORIES;
  const rank = (id) => {
    const i = state.shopOrder.indexOf(id);
    return i < 0 ? 999 : i;
  };
  return [...SHOP_CATEGORIES].sort((a, b) => rank(a.id) - rank(b.id));
}

function renderShopOrder(categories) {
  $('#shoporder-list').innerHTML = categories.map((c, i) => `
    <li class="order-row" data-id="${c.id}">
      <span>${c.icon} ${esc(c.name)}</span>
      <span>
        <button type="button" class="icon-btn small" data-action="shoporder-move" data-step="-1" aria-label="Nach oben"${i === 0 ? ' disabled' : ''}>▲</button>
        <button type="button" class="icon-btn small" data-action="shoporder-move" data-step="1" aria-label="Nach unten"${i === categories.length - 1 ? ' disabled' : ''}>▼</button>
      </span>
    </li>`).join('');
}

function currentOrderInDialog() {
  const byId = Object.fromEntries(SHOP_CATEGORIES.map((c) => [c.id, c]));
  return [...document.querySelectorAll('#shoporder-list .order-row')].map((row) => byId[row.dataset.id]);
}

function moveShopCategory(button) {
  const list = currentOrderInDialog();
  const i = list.findIndex((c) => c.id === button.closest('.order-row').dataset.id);
  const j = i + Number(button.dataset.step);
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  renderShopOrder(list);
}

function onSubmitShopOrder(event) {
  event.preventDefault();
  backend.set('settings', 'einkauf', { order: currentOrderInDialog().map((c) => c.id), updatedBy: state.me, updatedAt: backend.now() }).catch(showError);
  $('#shoporder-dialog').close();
  toast('Reihenfolge gespeichert ✓');
}

// Kategorie eines Einkaufs: gespeichert, sonst geraten.
function shopCategoryOf(item) {
  const id = item.category ?? guessCategory(item.name);
  return SHOP_CATEGORIES.some((c) => c.id === id) ? id : 'sonstiges';
}

function openShopCategory(id) {
  const item = state.shopping.find((i) => i.id === id);
  if (!item) return;
  state.shopCatItem = id;
  const current = shopCategoryOf(item);
  $('#shopcat-title').textContent = `Kategorie für „${item.name}“`;
  $('#shopcat-list').innerHTML = shopCategories().map((c) => `
    <button type="button" class="chip-btn${c.id === current ? ' active' : ''}" data-action="shop-setcat" data-cat="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('');
  $('#shopcat-dialog').showModal();
}

function setShopCategory(category) {
  const item = state.shopping.find((i) => i.id === state.shopCatItem);
  $('#shopcat-dialog').close();
  if (!item) return;
  backend.update('shopping', item.id, { category }).catch(showError);
  // Für das nächste Mal merken.
  const favId = favoriteId(item.name);
  const known = state.favorites.find((f) => f.id === favId);
  backend.set('favorites', favId, {
    name: known?.name ?? item.name,
    count: known?.count ?? 0,
    lastUsed: known?.lastUsed ?? backend.now(),
    category,
  }).catch(showError);
}

function quickAdd(id) {
  const fav = state.favorites.find((f) => f.id === id);
  if (fav) addShoppingItems([{ name: fav.name, amount: '' }]);
}

function quickRemove(id) {
  const fav = state.favorites.find((f) => f.id === id);
  if (fav && confirm(`„${fav.name}“ aus der Schnellauswahl entfernen?`)) backend.remove('favorites', id).catch(showError);
}

const myUnbilledShopping = () => state.shopping.filter((i) => i.doneBy === state.me && !i.expensed);

function shopToExpense() {
  const items = myUnbilledShopping();
  if (!items.length) return;
  let description = `Einkauf: ${items.map((i) => i.name).join(', ')}`;
  if (description.length > 80) description = `${description.slice(0, 77)}…`;
  const onlyHousehold = items.every((i) => ['drogerie', 'haushalt'].includes(shopCategoryOf(i)));
  openExpenseForm(null, {
    prefill: { description, category: onlyHousehold ? 'haushalt' : 'lebensmittel' },
    shopIds: items.map((i) => i.id),
    // Jede besorgte Sache wird ein Posten – nur noch Preise eintippen.
    items: items.map((i) => ({ name: [i.amount, i.name].filter(Boolean).join(' '), price: '', for: [...PERSON_IDS] })),
  });
}

function shopToggle(id) {
  const item = state.shopping.find((i) => i.id === id);
  if (!item) return;
  backend.update('shopping', id, item.doneBy
    ? { doneBy: null, doneAt: null }
    : { doneBy: state.me, doneAt: backend.now() }).catch(showError);
}

function shopDelete(id) {
  const item = state.shopping.find((i) => i.id === id);
  if (item) removeWithUndo(`„${item.name}“ gelöscht`, [{ col: 'shopping', doc: item }]);
}

function shopClear() {
  const done = state.shopping.filter((i) => i.doneBy);
  if (!done.length) return;
  removeWithUndo(`${done.length} besorgte ${done.length === 1 ? 'Sache' : 'Sachen'} entfernt`, done.map((doc) => ({ col: 'shopping', doc })));
}

// ---------- Kalender ----------

const sameDay = (a, b) => a.toDateString() === b.toDateString();
const timeOf = (d) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

async function loadEvents() {
  const cal = state.calendar;
  if (!cal.config || cal.loading) return;
  cal.loading = true;
  renderKalender();
  try {
    cal.events = backend.isDemo ? backend.demoEvents() : await fetchEvents(cal.config);
    cal.error = null;
  } catch (err) {
    console.error(err);
    cal.error = err;
  }
  cal.loading = false;
  cal.loadedAt = Date.now();
  renderAll();
}

function calendarErrorText(err) {
  if (err?.status === 404) return 'Kalender nicht gefunden. Stimmt die Kalender-ID? Ist der Kalender öffentlich freigegeben?';
  if (err?.status === 400 || err?.status === 403) return 'Google lehnt den Zugriff ab. Stimmt der API-Schlüssel und ist die Google Calendar API aktiviert?';
  return 'Die Termine konnten nicht geladen werden. Bist du online?';
}

function eventTime(e, day) {
  if (e.allDay) return 'ganztägig';
  if (!sameDay(e.start, day)) return `bis ${timeOf(e.end)}`;
  return sameDay(e.start, e.end) ? `${timeOf(e.start)} – ${timeOf(e.end)}` : `ab ${timeOf(e.start)}`;
}

function dayTitle(day) {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (sameDay(day, today)) return 'Heute';
  if (sameDay(day, tomorrow)) return 'Morgen';
  return day.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}



// Wann ein Termin ist, als lesbarer Text für das Detail-Fenster.
function eventWhen(e) {
  const long = { weekday: 'long', day: 'numeric', month: 'long' };
  const short = { weekday: 'short', day: 'numeric', month: 'short' };
  const date = (d, o) => d.toLocaleDateString('de-DE', o);
  if (e.allDay) {
    const last = new Date(e.end.getFullYear(), e.end.getMonth(), e.end.getDate() - 1);
    return last > e.start ? `${date(e.start, short)} – ${date(last, short)} · ganztägig` : `${date(e.start, long)} · ganztägig`;
  }
  if (sameDay(e.start, e.end)) return `${date(e.start, long)} · ${timeOf(e.start)} – ${timeOf(e.end)} Uhr`;
  return `${date(e.start, short)}, ${timeOf(e.start)} – ${date(e.end, short)}, ${timeOf(e.end)} Uhr`;
}

// Links in der Beschreibung antippbar machen (Text ist schon mit esc() geschützt).
function linkify(escaped) {
  return escaped.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
}

function openKoelsch() {
  const w = weisheitDesTages();
  $('#koelsch-body').innerHTML = `
    <p class="koelsch-text">„${esc(w.koelsch)}“</p>
    <p class="koelsch-de">${esc(w.deutsch)}</p>
    <p class="koelsch-source">${esc(w.quelle)}</p>`;
  $('#koelsch-dialog').showModal();
}

function openEvent(id) {
  const e = state.calendar.events?.find((x) => x.id === id);
  if (!e) return;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}`;
  $('#event-body').innerHTML = `
    <h2 class="event-detail-title${e.hiddenTitle ? ' muted' : ''}">${esc(e.title)}</h2>
    <p class="event-detail-row"><span aria-hidden="true">🕒</span><span>${esc(eventWhen(e))}</span></p>
    ${e.location ? `<p class="event-detail-row"><span aria-hidden="true">📍</span><a href="${esc(maps)}" target="_blank" rel="noopener">${esc(e.location)}</a></p>` : ''}
    ${e.description ? `<div class="event-detail-desc">${linkify(esc(e.description))}</div>` : ''}
    ${e.hiddenTitle ? '' : `<div class="form-actions">
      <button type="button" class="btn outline" data-action="event-delete" data-id="${esc(e.id)}">Löschen</button>
      <button type="button" class="btn primary" data-action="event-edit" data-id="${esc(e.id)}">Bearbeiten</button>
    </div>`}
    ${e.link ? `<a class="btn outline full" href="${esc(e.link)}" target="_blank" rel="noopener">In Google Kalender öffnen</a>` : ''}`;
  $('#event-dialog').showModal();
}

// ---------- Termin eintragen / bearbeiten / löschen ----------

function updateEventFormMode() {
  const allDay = $('#e-allday').checked;
  $('#e-time-row').hidden = allDay;
  $('#e-date-to-row').hidden = !allDay;
  $('#e-date-label').textContent = allDay ? 'Von (Datum)' : 'Datum';
}

function openEventForm(e = null) {
  if (!state.calendar.config) return;
  state.editingEvent = e?.id ?? null;
  const v = e ? eventFormValues(e) : { title: '', allDay: false, date: todayISO(), dateTo: todayISO(), from: '19:00', to: '20:00', location: '', description: '' };
  $('#e-head').textContent = e ? 'Termin bearbeiten' : 'Neuer Termin';
  $('#e-title').value = v.title;
  $('#e-allday').checked = v.allDay;
  $('#e-date').value = v.date;
  $('#e-date-to').value = v.dateTo;
  $('#e-from').value = v.from;
  $('#e-to').value = v.to;
  $('#e-location').value = v.location;
  $('#e-desc').value = v.description;
  $('#e-error').textContent = '';
  $('#e-delete').hidden = !e;
  $('#e-delete').dataset.id = e?.id ?? '';
  $('#e-save').textContent = e ? 'Speichern' : 'Eintragen';
  $('#e-save').disabled = false;
  updateEventFormMode();
  $('#event-dialog').close();
  $('#newevent-dialog').showModal();
}

// Fehler von Google verständlich erklären
function calendarWriteErrorText(err) {
  const code = err?.code ?? '';
  if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'].includes(code)) {
    return 'Abgebrochen. Google muss einmal erlauben, dass Projekt Kölle in euren Kalender schreiben darf – bitte nochmal tippen und im Google-Fenster bestätigen.';
  }
  if (code === 'auth/popup-blocked') return 'Das Google-Fenster wurde blockiert. Bitte nochmal tippen (ggf. Pop-ups für diese Seite erlauben).';
  if (code === 'auth/user-mismatch') return 'Bitte im Google-Fenster dasselbe Konto wählen, mit dem du in der App angemeldet bist.';
  if (code === 'auth/network-request-failed') return 'Keine Verbindung. Bist du online?';
  if (code) return `Google-Anmeldung hat nicht geklappt (${code}). Bitte nochmal versuchen.`;
  if (err?.status === 401) return 'Die Erlaubnis ist abgelaufen. Bitte einfach nochmal tippen.';
  if (err?.status === 403) {
    return 'Google erlaubt dir noch nicht, in diesem Kalender etwas zu ändern. Entweder fehlt im Google-Fenster das Häkchen für den Kalender (nochmal tippen), oder Lukas muss dich in den Kalender-Einstellungen auf „Änderungen an Terminen vornehmen“ stellen.';
  }
  if (err?.status === 404 || err?.status === 410) return 'Diesen Termin oder Kalender gibt es nicht mehr. Bitte den Kalender aktualisieren.';
  return 'Das hat nicht geklappt. Bist du online? Bitte nochmal versuchen.';
}

function onSubmitEvent(event) {
  event.preventDefault();
  const v = {
    title: $('#e-title').value,
    allDay: $('#e-allday').checked,
    date: $('#e-date').value,
    dateTo: $('#e-date-to').value,
    from: $('#e-from').value,
    to: $('#e-to').value,
    location: $('#e-location').value,
    description: $('#e-desc').value,
  };
  const error = !v.title.trim() ? 'Bitte eintragen, was ansteht.'
    : !v.date ? 'Bitte ein Datum wählen.'
      : v.allDay && v.dateTo && v.dateTo < v.date ? 'Das Bis-Datum liegt vor dem Von-Datum.'
        : !v.allDay && (!v.from || !v.to) ? 'Bitte Von- und Bis-Uhrzeit wählen.'
          : !v.allDay && v.from === v.to ? 'Von und Bis sind gleich – bitte eine Bis-Uhrzeit wählen.' : '';
  $('#e-error').textContent = error;
  if (error) return;
  const id = state.editingEvent;
  const save = $('#e-save');
  save.disabled = true;
  save.textContent = 'Speichert …';
  // Kein await davor: Das Google-Fenster muss direkt nach dem Antippen aufgehen.
  backend.calendarWrite(id ? 'PATCH' : 'POST', state.calendar.config.calendarId, id, eventResource(v))
    .then(() => {
      $('#newevent-dialog').close();
      toast(id ? 'Termin geändert ✓' : 'Termin eingetragen ✓');
      loadEvents();
    })
    .catch((err) => {
      console.error(err);
      $('#e-error').textContent = calendarWriteErrorText(err);
      save.disabled = false;
      save.textContent = id ? 'Speichern' : 'Eintragen';
    });
}

function deleteEvent(id) {
  const e = state.calendar.events?.find((x) => x.id === id);
  if (!e || !confirm(`Termin „${e.title}“ wirklich löschen? Er verschwindet für alle aus dem WG-Kalender.`)) return;
  backend.calendarWrite('DELETE', state.calendar.config.calendarId, id)
    .then(() => {
      $('#event-dialog').close();
      $('#newevent-dialog').close();
      state.calendar.events = state.calendar.events.filter((x) => x.id !== id);
      renderAll();
      toast('Termin gelöscht');
      loadEvents();
    })
    .catch((err) => {
      console.error(err);
      const text = calendarWriteErrorText(err);
      if ($('#newevent-dialog').open) $('#e-error').textContent = text;
      else toast(text, true);
    });
}

function renderKalender() {
  const cal = state.calendar;
  const el = $('#tab-kalender');
  const back = '<button class="back-link" data-action="tab" data-tab="start">‹ Zur Übersicht</button>';
  if (!cal.config) {
    el.innerHTML = `${back}
      <section class="card soon">
        <div class="soon-icon">📅</div>
        <h2>Gemeinsamer Kalender</h2>
        <p>Verbinde euren WG-Kalender von Google. Dann erscheinen hier alle Termine – und auf der Startseite, was heute ansteht.</p>
        <button class="btn primary" data-action="calendar-settings">Kalender verbinden</button>
      </section>`;
    return;
  }

  let body;
  if (cal.error) {
    body = `<p class="error">${esc(calendarErrorText(cal.error))}</p>
      <button class="btn outline full" data-action="calendar-settings">Einstellungen prüfen</button>`;
  } else if (!cal.events) {
    body = '<div class="center-pad"><div class="spinner"></div></div>';
  } else {
    const groups = groupByDay(cal.events);
    // Monats-Überschrift, sobald ein neuer Monat beginnt (nicht für den laufenden Monat)
    let lastMonth = `${new Date().getFullYear()}-${new Date().getMonth()}`;
    const monthHead = (day) => {
      const key = `${day.getFullYear()}-${day.getMonth()}`;
      if (key === lastMonth) return '';
      lastMonth = key;
      return `<h3 class="month-head">${day.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</h3>`;
    };
    body = groups.length
      ? groups.map((g) => `${monthHead(g.day)}
        <div class="day">
          <h3 class="day-title${sameDay(g.day, new Date()) ? ' today' : ''}">${dayTitle(g.day)}</h3>
          <ul class="events">${g.events.map((e) => `
            <li><button type="button" class="event" data-action="event-open" data-id="${esc(e.id)}">
              <span class="event-time">${eventTime(e, g.day)}</span>
              <span class="event-main">
                <span class="event-title${e.hiddenTitle ? ' muted' : ''}">${esc(e.title)}</span>
                ${e.location ? `<span class="event-sub">📍 ${esc(e.location)}</span>` : ''}
                ${e.description ? '<span class="event-sub">📝 Mit Beschreibung</span>' : ''}
              </span>
              <span class="event-arrow" aria-hidden="true">›</span>
            </button></li>`).join('')}</ul>
        </div>`).join('')
      : '<p class="empty">In den nächsten 12 Monaten steht nichts an.</p>';
  }

  const allHidden = cal.events?.length > 0 && cal.events.every((e) => e.hiddenTitle);
  const titleHint = allHidden ? `
    <section class="card notice">
      <strong>Die Titel der Termine sind nicht sichtbar.</strong>
      <p>Google gibt gerade nur „frei/belegt“ heraus. In Google Kalender bei „WG Kölle“ →
      „Zugriffsberechtigungen für Termine“ neben „Öffentlich freigeben“
      <strong>„Alle Termindetails anzeigen“</strong> auswählen. Danach hier auf „Aktualisieren“ tippen.</p>
    </section>` : '';

  el.innerHTML = `${back}
    ${titleHint}
    <section class="card">
      <div class="card-head">
        <h2>Nächste Termine</h2>
        <button class="link-btn" data-action="calendar-reload">${cal.loading ? 'Lädt …' : 'Aktualisieren'}</button>
      </div>
      ${body}
    </section>
    <button class="btn primary full" data-action="event-new">＋ Termin eintragen</button>
    <p class="hint">Landet direkt in eurem WG-Kalender. Lieber in Google selbst? <a href="${esc(newEventLink(cal.config.calendarId))}" target="_blank" rel="noopener">Google Kalender öffnen</a></p>
    <button class="btn outline full" data-action="calendar-settings">⚙️ Kalender-Einstellungen</button>`;
}

function openCalendarForm() {
  $('#c-id').value = state.calendar.config?.calendarId ?? '';
  $('#c-key').value = state.calendar.config?.apiKey ?? '';
  $('#c-remove').hidden = !state.calendar.config;
  $('#c-error').textContent = '';
  $('#calendar-dialog').showModal();
}

function onSubmitCalendar(event) {
  event.preventDefault();
  const calendarId = $('#c-id').value.trim();
  const apiKey = $('#c-key').value.trim();
  const problem = !calendarId.includes('@') ? 'Die Kalender-ID sieht nicht richtig aus. Sie endet meist auf @group.calendar.google.com.'
    : !/^AIza[\w-]{20,}$/.test(apiKey) ? 'Der API-Schlüssel sieht nicht richtig aus. Er beginnt mit „AIza“.'
      : '';
  if (problem) {
    $('#c-error').textContent = problem;
    return;
  }
  backend.set('settings', 'kalender', { calendarId, apiKey, updatedBy: state.me, updatedAt: backend.now() }).catch(showError);
  $('#calendar-dialog').close();
  toast('Kalender gespeichert ✓');
}

function removeCalendar() {
  if (!confirm('Kalender von der Website trennen? Die Termine bei Google bleiben erhalten.')) return;
  backend.remove('settings', 'kalender').catch(showError);
  $('#calendar-dialog').close();
}

// ---------- Infos: Schwarzes Brett & Datensicherung ----------

const NOTE_TEMPLATES = [
  { title: '📶 WLAN', text: 'Netzwerk: \nPasswort: ' },
  { title: '🏠 Vermieter & Hausverwaltung', text: 'Name: \nTelefon: \nE-Mail: ' },
  { title: '🔢 Zählerstände', text: 'Strom: \nGas: \nWasser: ' },
  { title: '🔑 Schlüssel', text: 'Ersatzschlüssel bei: ' },
  { title: '🚨 Notfall & Handwerker', text: 'Hausmeister: \nSchlüsseldienst: ' },
];

// Vorlagen, die es noch nicht als Notiz gibt
const noteTemplatesLeft = () => {
  const existing = new Set(state.notes.map((n) => n.title));
  return NOTE_TEMPLATES.filter((t) => !existing.has(t.title));
};

function choiceRow(attrs, label, active = false) {
  return `<li><button class="choice${active ? ' active' : ''}" ${attrs}><span>${label}</span>${active ? '<span class="choice-check" aria-hidden="true">✓</span>' : ''}</button></li>`;
}

function noteNewBody() {
  return `<ul class="choices">
    ${choiceRow('data-action="note-blank"', '📝 Leere Notiz')}
    ${noteTemplatesLeft().map((t) => choiceRow(`data-action="note-template" data-index="${NOTE_TEMPLATES.indexOf(t)}"`, `${esc(t.title)} <small>Vorlage</small>`)).join('')}
  </ul>
  <p class="hint">Vorlagen sind schon vorausgefüllt – du musst nur noch ergänzen.</p>`;
}

function noteSortBody() {
  const mode = noteSort();
  return `<ul class="choices">${NOTE_SORTS.map((o) => choiceRow(`data-action="note-sort" data-mode="${o.id}"`, o.label, o.id === mode)).join('')}</ul>
  <p class="hint">Angeheftete Notizen stehen immer oben. Gilt nur auf diesem Gerät.</p>`;
}

let noteDrag = null; // Notiz, die gerade verschoben wird (siehe unten)

// Angeheftete zuerst, dann in der selbst gewählten Reihenfolge (neue Notizen ans Ende)
// Sortierung wählt jeder für sich (wird auf dem Handy gemerkt): eigene Reihenfolge oder nach Datum.
// Angeheftete stehen immer oben. Datum = letzte Änderung.
const NOTE_SORTS = [
  { id: 'custom', label: 'Eigene Reihenfolge' },
  { id: 'newest', label: 'Neueste zuerst' },
  { id: 'oldest', label: 'Älteste zuerst' },
];
const NOTE_SORT_KEY = 'koelle.noteSort';
function noteSort() {
  try { return localStorage.getItem(NOTE_SORT_KEY) || 'custom'; } catch { return 'custom'; }
}
function setNoteSort(mode) {
  try { localStorage.setItem(NOTE_SORT_KEY, mode); } catch { /* privater Modus */ }
}
const noteDate = (n) => toMillis(n.updatedAt ?? n.createdAt);
const sortedNotes = () => {
  const mode = noteSort();
  return [...state.notes].sort((a, b) => (Boolean(b.pinned) - Boolean(a.pinned))
    || (mode === 'newest' ? noteDate(b) - noteDate(a)
      : mode === 'oldest' ? noteDate(a) - noteDate(b)
        : ((a.order ?? 1e9) - (b.order ?? 1e9)) || (toMillis(a.createdAt) - toMillis(b.createdAt))));
};

function renderInfos() {
  if (noteDrag?.active) { noteDrag.dirty = true; return; } // nicht mitten im Verschieben neu zeichnen
  const notes = sortedNotes();

  const noteCards = notes.map((n) => `
    <article class="card note${n.pinned ? ' pinned' : ''}" data-id="${esc(n.id)}">
      <div class="card-head">
        <h2>${n.pinned ? '<span class="pin-mark" aria-label="Angeheftet">📌</span> ' : ''}${esc(n.title)}</h2>
        <span class="note-actions">
          <button class="link-btn" data-action="note-pin" data-id="${esc(n.id)}">${n.pinned ? 'Lösen' : 'Anheften'}</button>
          <button class="link-btn" data-action="note-edit" data-id="${esc(n.id)}">Bearbeiten</button>
        </span>
      </div>
      ${n.text ? `<div class="note-text">${noteTextHtml(n.text, esc)}</div>` : ''}
      ${imagesOf(n.id).length ? `<div class="note-thumbs">${imagesOf(n.id).map((img) => `
        <button class="note-thumb" data-action="image-open" data-id="${esc(img.id)}"><img src="${img.data}" alt="Bild"></button>`).join('')}</div>` : ''}
      <div class="note-foot">
        <span>${esc(personName(n.updatedBy ?? n.createdBy))} · ${new Date(toMillis(n.updatedAt ?? n.createdAt) || Date.now()).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</span>
        ${n.text ? `<button class="link-btn" data-action="note-copy" data-id="${esc(n.id)}">Text kopieren</button>` : ''}
      </div>
    </article>`).join('');

  $('#tab-infos').innerHTML = `
    <section class="card">
      <div class="card-head"><h2>📌 Schwarzes Brett</h2><button class="link-btn" data-action="note-new">＋ Notiz</button></div>
      <p class="hint left">Alles, was man in der WG immer wieder sucht.${notes.length > 1 ? ' Lange auf eine Notiz drücken, um sie zu verschieben.' : ''}</p>
      ${notes.length > 1 ? `<button class="link-btn note-sort-btn" data-action="panel-open" data-panel="note-sort">↕️ ${esc(NOTE_SORTS.find((o) => o.id === noteSort())?.label ?? '')}</button>` : ''}
    </section>
    ${noteCards}`;
}

// ---------- Notizen verschieben (lange drücken, dann ziehen) ----------
// Nach oben zu den angehefteten ziehen = anheften, nach unten = lösen.

function noteTouchStart(event) {
  cancelNoteDrag();
  const card = event.target.closest('#tab-infos .note');
  if (!card || event.touches.length !== 1 || event.target.closest('button, a')) return;
  const t = event.touches[0];
  noteDrag = { card, id: card.dataset.id, x: t.clientX, y: t.clientY, active: false };
  noteDrag.timer = setTimeout(startNoteDrag, 450);
}

function startNoteDrag() {
  if (!noteDrag || document.querySelector('dialog[open]')) return;
  noteDrag.active = true;
  noteDrag.startPageY = noteDrag.y + window.scrollY;
  swipe = null; // kein Wischen/Aktualisieren gleichzeitig
  noteDrag.card.classList.add('dragging');
  navigator.vibrate?.(15);
  updateNoteDrop(noteDrag.y);
  // Am oberen/unteren Rand läuft die Seite weiter, auch wenn der Finger stillhält
  const drag = noteDrag;
  const tick = () => {
    if (noteDrag !== drag) return;
    // Nur so weit, bis die Notiz ganz oben bzw. ganz unten landen würde
    const speed = drag.y < 110 && drag.index > 0 ? -10
      : drag.y > window.innerHeight - 140 && drag.index < drag.count ? 10 : 0;
    if (speed) {
      window.scrollBy(0, speed);
      positionDraggedNote();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function positionDraggedNote() {
  noteDrag.card.style.transform = `translateY(${noteDrag.y + window.scrollY - noteDrag.startPageY}px)`;
  updateNoteDrop(noteDrag.y);
}

function noteTouchMove(event) {
  if (!noteDrag) return;
  const t = event.touches[0];
  if (!noteDrag.active) {
    if (Math.hypot(t.clientX - noteDrag.x, t.clientY - noteDrag.y) > 10) cancelNoteDrag();
    return;
  }
  event.preventDefault(); // Seite nicht scrollen, solange man zieht
  noteDrag.y = t.clientY;
  positionDraggedNote();
}

// Wo würde die Notiz landen? Zeigt eine Linie an der Stelle.
function updateNoteDrop(y) {
  const others = [...document.querySelectorAll('#tab-infos .note')].filter((c) => c !== noteDrag.card);
  let index = others.findIndex((c) => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; });
  if (index < 0) index = others.length;
  const pinnedCount = others.filter((c) => c.classList.contains('pinned')).length;
  const wasPinned = noteDrag.card.classList.contains('pinned');
  noteDrag.index = index;
  noteDrag.count = others.length;
  noteDrag.pinned = index < pinnedCount ? true : index > pinnedCount ? false : wasPinned;
  let marker = document.querySelector('.note-drop');
  if (!marker) { marker = document.createElement('div'); marker.className = 'note-drop'; }
  marker.classList.toggle('pin', noteDrag.pinned);
  marker.textContent = noteDrag.pinned ? '📌 Angeheftet' : '';
  if (index < others.length) others[index].before(marker); else (others.at(-1) ?? noteDrag.card).after(marker);
}

function noteTouchEnd() {
  if (!noteDrag) return;
  const drag = noteDrag;
  cancelNoteDrag();
  if (!drag.active) return;
  const order = sortedNotes().filter((n) => n.id !== drag.id);
  const moved = state.notes.find((n) => n.id === drag.id);
  if (!moved) return;
  order.splice(drag.index, 0, { ...moved, pinned: drag.pinned });
  order.forEach((n, i) => {
    const original = state.notes.find((x) => x.id === n.id);
    const changes = {};
    if (original.order !== i) changes.order = i;
    if (Boolean(original.pinned) !== Boolean(n.pinned)) changes.pinned = n.pinned;
    if (Object.keys(changes).length) {
      Object.assign(original, changes); // sofort richtig anzeigen
      backend.update('notes', n.id, changes).catch(showError);
    }
  });
  if (noteSort() !== 'custom') {
    setNoteSort('custom');
    renderInfos();
    toast('Sortierung: eigene Reihenfolge');
  } else if (Boolean(moved.pinned) !== Boolean(drag.pinned)) toast(drag.pinned ? 'Angeheftet 📌' : 'Gelöst');
}

function cancelNoteDrag() {
  if (!noteDrag) return;
  clearTimeout(noteDrag.timer);
  const wasActive = noteDrag.active;
  noteDrag.card.classList.remove('dragging');
  noteDrag.card.style.transform = '';
  document.querySelector('.note-drop')?.remove();
  noteDrag = null;
  if (wasActive) renderInfos();
}

// ---------- Einstellungen ----------

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const PUSH_TOKEN_KEY = 'koelle.pushToken';
function storedPushToken() {
  try { return localStorage.getItem(PUSH_TOKEN_KEY); } catch { return null; }
}
function storePushToken(token) {
  try {
    if (token) localStorage.setItem(PUSH_TOKEN_KEY, token);
    else localStorage.removeItem(PUSH_TOKEN_KEY);
  } catch { /* privater Modus: dann eben nicht merken */ }
}

const myPushTypes = () => state.pushSettings[state.me]?.types ?? {};
const pushTypeOn = (type) => myPushTypes()[type.id] ?? type.default;

function pushCard() {
  const deviceOn = Boolean(storedPushToken()) && (backend.isDemo || ('Notification' in window && Notification.permission === 'granted'));
  let status;
  if (!backend.pushReady) {
    status = '<p class="hint left">Wird gerade eingerichtet – bald kannst du hier Benachrichtigungen einschalten.</p>';
  } else if (IS_IOS && !IS_HOME_SCREEN_APP && !backend.isDemo) {
    status = '<p class="hint left">📱 Auf dem iPhone/iPad gehen Benachrichtigungen nur in der <strong>App vom Home-Bildschirm</strong>. Öffne Projekt Kölle von dort und schalte sie hier ein.</p>';
  } else if ('Notification' in window && Notification.permission === 'denied' && !backend.isDemo) {
    status = '<p class="hint left">🚫 Benachrichtigungen sind für diese App blockiert. Erlaube sie in den Einstellungen deines Handys (Mitteilungen → Projekt Kölle) und öffne die App neu.</p>';
  } else if (deviceOn) {
    status = `<p class="push-status">✅ Auf diesem Handy eingeschaltet</p>
      <div class="push-buttons">
        <button class="btn small" data-action="push-test"${state.pushBusy ? ' disabled' : ''}>Test-Nachricht senden</button>
        <button class="link-btn" data-action="push-off">Auf diesem Handy ausschalten</button>
      </div>`;
  } else {
    status = `<button class="btn primary full" data-action="push-on"${state.pushBusy ? ' disabled' : ''}>${state.pushBusy ? 'Einen Moment …' : '🔔 Auf diesem Handy einschalten'}</button>
      <p class="hint left">Einschalten musst du auf jedem Handy/iPad einmal, auf dem du Nachrichten möchtest.</p>`;
  }
  const onCount = PUSH_TYPES.filter(pushTypeOn).length;
  const toggles = !backend.pushReady ? '' : isFolded('push-types', true) ? `
    ${foldButton('push-types', `<span class="fold-row-text">Was möchtest du bekommen?<small>${onCount} von ${PUSH_TYPES.length} Arten an · Antippen zum Ändern</small></span>`, true, ' fold-row')}` : `
    ${foldButton('push-types', '<span class="fold-row-text">Was möchtest du bekommen?</span>', true, ' fold-row')}
    <ul class="push-types">${PUSH_TYPES.map((t) => `
      <li>
        <label class="switch-row">
          <span class="switch-text"><span>${t.icon} ${esc(t.label)}</span><small>${esc(t.hint)}</small></span>
          <input type="checkbox" class="switch" data-push-type="${t.id}"${pushTypeOn(t) ? ' checked' : ''}>
        </label>
      </li>`).join('')}</ul>
    <p class="hint left">Gilt für alle deine Geräte. Nachrichten über deine eigenen Einträge bekommst du nicht.</p>`;
  return `<section class="card"><h2>🔔 Benachrichtigungen</h2>${status}${toggles}</section>`;
}

function renderSettings() {
  const last = state.backup?.at ? new Date(toMillis(state.backup.at)) : null;
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  const backupInfo = last
    ? `Letzte Sicherung: ${days === 0 ? 'heute' : days === 1 ? 'gestern' : `vor ${days} Tagen`} von ${esc(personName(state.backup.by))}.`
    : 'Es wurde noch keine Sicherung gemacht.';

  $('#tab-settings').innerHTML = `
    <h1 class="settings-title">⚙️ Einstellungen</h1>
    ${pushCard()}
    <section class="card">
      <h2>📅 Kalender</h2>
      <p class="hint left">${state.calendar.config ? 'Euer Google-Kalender ist verbunden.' : 'Noch kein Kalender verbunden.'}</p>
      <button class="btn outline full" data-action="calendar-settings">${state.calendar.config ? 'Kalender-Einstellungen' : 'Kalender verbinden'}</button>
    </section>
    <section class="card${days === null || days > 30 ? ' notice' : ''}">
      <h2>💾 Datensicherung</h2>
      <p class="hint left">${backupInfo} Am besten einmal im Monat sichern und die Datei z. B. in iCloud oder Google Drive ablegen.</p>
      <div class="stack">
        <button class="btn primary full" data-action="export-json">Alle Daten sichern</button>
        <button class="btn outline full" data-action="export-csv">Ausgaben als Tabelle (Excel)</button>
        <button class="btn outline full" data-action="restore-open">Sicherung zurückspielen</button>
      </div>
    </section>
    <section class="card">
      <h2>👤 Konto</h2>
      <div class="row">${avatar(state.me)}<span class="row-name">${esc(personName(state.me))}<small>${esc(state.user?.email ?? '')}</small></span></div>
      <button class="btn outline full logout-btn" data-action="logout">Abmelden</button>
    </section>
    <p class="app-version">Projekt Kölle · Version ${APP_VERSION}</p>`;
}

async function pushOn() {
  if (state.pushBusy) return;
  state.pushBusy = true;
  renderSettings();
  try {
    if (!(await backend.pushSupported())) {
      toast('Dieses Gerät/dieser Browser unterstützt leider keine Benachrichtigungen.', true);
      return;
    }
    const token = await backend.enablePush();
    await backend.set('pushTokens', token, {
      person: state.me,
      device: navigator.userAgent.slice(0, 120),
      createdAt: backend.now(),
    });
    storePushToken(token);
    toast('Benachrichtigungen eingeschaltet ✓');
  } catch (err) {
    console.error(err);
    toast(err?.code === 'denied'
      ? 'Du hast Benachrichtigungen nicht erlaubt. Das kannst du in den Handy-Einstellungen ändern.'
      : `Einschalten hat nicht geklappt: ${err?.message ?? err}`, true);
  } finally {
    state.pushBusy = false;
    renderSettings();
  }
}

// Bei jedem Start: Ist die "Adresse" dieses Handys für Nachrichten noch aktuell?
// Google tauscht sie gelegentlich aus – dann käme sonst nichts mehr an.
async function refreshPushToken() {
  const stored = storedPushToken();
  if (backend.isDemo || !stored || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const token = await backend.currentPushToken();
    if (!token) return;
    await backend.set('pushTokens', token, {
      person: state.me,
      device: navigator.userAgent.slice(0, 120),
      createdAt: backend.now(),
    });
    if (token !== stored) {
      await backend.remove('pushTokens', stored).catch(() => {});
      storePushToken(token);
    }
  } catch (err) {
    console.error('Push-Adresse konnte nicht erneuert werden', err);
  }
}

async function pushOff() {
  const token = storedPushToken();
  if (token) backend.remove('pushTokens', token).catch(showError);
  await backend.disablePush();
  storePushToken(null);
  renderSettings();
  toast('Auf diesem Handy ausgeschaltet');
}

function pushTest() {
  backend.add('pushTests', { person: state.me, createdAt: backend.now() }).catch(showError);
  toast(backend.isDemo ? 'Demo: Hier käme jetzt eine Test-Nachricht.' : 'Test-Nachricht ist unterwegs – kommt in ein paar Sekunden.');
}

function setPushType(type, on) {
  backend.set('pushSettings', state.me, {
    types: { ...myPushTypes(), [type]: on },
    updatedAt: backend.now(),
  }).catch(showError);
}

const imagesOf = (noteId) => state.noteImages
  .filter((img) => img.noteId === noteId)
  .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));

function renderNoteFormImages() {
  const existing = imagesOf(state.editingNote).filter((img) => !state.removedImages.includes(img.id));
  const all = [
    ...existing.map((img) => ({ key: img.id, data: img.data, kind: 'saved' })),
    ...state.pendingImages.map((img, i) => ({ key: String(i), data: img.data, kind: 'new' })),
  ];
  $('#n-images').innerHTML = all.map((img) => `
    <span class="note-thumb">
      <img src="${esc(img.data)}" alt="Bild">
      <button type="button" class="thumb-remove" data-action="note-image-remove" data-kind="${img.kind}" data-key="${esc(img.key)}" aria-label="Bild entfernen">✕</button>
    </span>`).join('');
}

async function addNoteImages(files) {
  for (const file of files) {
    try {
      toast('Bild wird vorbereitet …');
      state.pendingImages.push(await compressImage(file));
      renderNoteFormImages();
      toast('Bild hinzugefügt ✓ Zum Speichern unten auf „Speichern“ tippen.');
    } catch (err) {
      console.error(err);
      toast('Dieses Bild konnte nicht gelesen werden. Versuch es mit einem Screenshot.', true);
    }
  }
}

function openImage(id) {
  const img = state.noteImages.find((i) => i.id === id);
  if (!img) return;
  $('#viewer-img').src = img.data;
  $('#viewer-scroll').classList.remove('zoomed');
  $('#image-dialog').showModal();
}

function openNoteForm(note, template) {
  state.editingNote = note?.id ?? null;
  state.pendingImages = [];
  state.removedImages = [];
  renderNoteFormImages();
  $('#note-title-head').textContent = note ? 'Notiz bearbeiten' : 'Neue Notiz';
  $('#n-title').value = note?.title ?? template?.title ?? '';
  $('#n-text').value = note?.text ?? template?.text ?? '';
  $('#n-delete').hidden = !note;
  $('#n-error').textContent = '';
  $('#note-dialog').showModal();
}

function onSubmitNote(event) {
  event.preventDefault();
  const title = $('#n-title').value.trim();
  const text = $('#n-text').value.trim();
  if (!title) {
    $('#n-error').textContent = 'Bitte eine Überschrift eingeben.';
    return;
  }
  // Neue Notizen bekommen ihre ID gleich hier, damit die Bilder wissen, wohin sie gehören.
  const id = state.editingNote ?? `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const saving = state.editingNote
    ? backend.update('notes', id, { title, text, updatedBy: state.me, updatedAt: backend.now() })
    : backend.set('notes', id, { title, text, createdBy: state.me, createdAt: backend.now(), updatedBy: state.me, updatedAt: backend.now() });
  saving.catch(showError);
  state.pendingImages.forEach((img) => backend.add('noteImages', {
    noteId: id, data: img.data, width: img.width, height: img.height, createdBy: state.me, createdAt: backend.now(),
  }).catch(showError));
  state.removedImages.forEach((imgId) => backend.remove('noteImages', imgId).catch(showError));
  state.pendingImages = [];
  state.removedImages = [];
  $('#note-dialog').close();
  toast('Notiz gespeichert ✓');
}

function deleteNote() {
  const note = state.notes.find((n) => n.id === state.editingNote);
  if (!note) return;
  $('#note-dialog').close();
  removeWithUndo('Notiz gelöscht', [
    { col: 'notes', doc: note },
    ...imagesOf(note.id).map((doc) => ({ col: 'noteImages', doc })),
  ]);
}

async function copyNote(id) {
  const note = state.notes.find((n) => n.id === id);
  if (!note) return;
  try {
    await navigator.clipboard.writeText(note.text);
    toast('Kopiert ✓');
  } catch {
    toast('Kopieren hat nicht geklappt – Text bitte markieren.', true);
  }
}

// Datei speichern: auf dem Handy über "Teilen" (z. B. in Dateien/iCloud), sonst als Download.
async function saveFile(filename, text, type) {
  const file = new File([text], filename, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

async function exportJson() {
  const data = toPlain({
    app: 'Projekt Kölle',
    exportedAt: new Date(),
    exportedBy: state.me,
    expenses: state.expenses,
    payments: state.payments,
    settlements: state.settlements,
    recurring: state.recurring,
    shopping: state.shopping,
    favorites: state.favorites,
    chores: Object.values(state.chores),
    choreAreas: state.areas,
    notes: state.notes,
    noteImages: state.noteImages,
    absences: state.absences,
    polls: state.polls,
    invites: state.invites,
    quickNotes: state.quickNotes,
    radio: state.radioSettings,
  });
  const saved = await saveFile(`projekt-koelle-sicherung-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json');
  if (saved) {
    backend.set('settings', 'backup', { at: backend.now(), by: state.me }).catch(showError);
    toast('Sicherung erstellt ✓');
  }
}

async function exportCsv() {
  const csv = expensesCsv(state.expenses, {
    personName,
    categoryName: (id) => categoryOf(id).name,
  });
  await saveFile(`projekt-koelle-ausgaben-${todayISO()}.csv`, csv, 'text/csv');
}

// ---------- Start: Übersicht ----------

// Abstimmungen mit Datum zählen nach dem Tag nicht mehr (verschwinden von selbst)
const currentPolls = () => state.polls.filter((p) => !pollExpired(p, isoDay(new Date())));
const openPolls = () => currentPolls().filter((p) => !p.closed);
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shortDate = (iso) => formatDate(iso);

// Begrüßung auf Kölsch – je nach Tageszeit, am 11.11. und an Karneval mit „Alaaf“
function koelscheBegruessung(now) {
  const md = (now.getMonth() + 1) * 100 + now.getDate();
  if (md === 1111) return 'Kölle Alaaf';
  const hour = now.getHours();
  if (hour < 5 || hour >= 23) return 'Jode Naach';
  if (hour < 11) return 'Morje';
  if (hour < 18) return 'Tach';
  return 'N’Ovend';
}

function renderStart() {
  const searching = document.activeElement?.id === 'tips-search' ? document.activeElement.selectionStart : null;
  renderStartContent();
  if (searching !== null) {
    const box = $('#tips-search');
    box?.focus();
    box?.setSelectionRange(searching, searching);
  }
}

function renderStartContent() {
  const now = new Date();
  const hello = koelscheBegruessung(now);
  const balance = computeBalances(PERSON_IDS, activeExpenses(), activePayments())[state.me];
  const myChores = weekChores(thisMonday()).filter((c) => c.assignee === state.me);
  const openShop = state.shopping.filter((i) => !i.doneBy);
  const shopTrip = activeTrips().find((t) => t.person !== state.me);
  const meAway = isAwayOn(state.absences, state.me);

  $('#tab-start').innerHTML = `
    <section class="start-hello">
      <h1>${hello}, ${esc(personName(state.me))}!</h1>
      <p>${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}${meAway ? ' · du bist gerade nicht da 🌴' : ''}</p>
    </section>
    ${startCalendarCard()}
    <div class="start-grid">
      <button class="card tile" data-action="tab" data-tab="ausgaben">
        <span class="tile-icon">💶</span>
        <span class="tile-label">${balance > 0 ? 'Du bekommst' : balance < 0 ? 'Du schuldest' : 'Kontostand'}</span>
        <strong class="tile-value">${balance === 0 ? 'ausgeglichen' : formatEuro(Math.abs(balance))}</strong>
      </button>
      <button class="card tile" data-action="tab" data-tab="einkauf">
        <span class="tile-icon">🛒</span>
        <span class="tile-label">${shopTrip ? `🏃 ${esc(personName(shopTrip.person))} kauft ein` : 'Einkaufsliste'}</span>
        <strong class="tile-value">${openShop.length ? `${openShop.length} ${openShop.length === 1 ? 'Sache fehlt' : 'Sachen fehlen'}` : 'alles da'}</strong>
      </button>
    </div>
    ${startChoreCard(myChores)}
    ${quickNotesCard()}
    ${invitesCard()}
    ${pollsCard()}
    ${absencesCard()}
    ${tipsCard()}`;
  if (!state.tips && !state.tipsLoading) refreshTips();
}

// ---------- Diese Woche in Ehrenfeld ----------

async function refreshTips() {
  state.tipsLoading = true;
  try {
    state.tips = await loadTips();
    renderStart();
  } catch (err) {
    console.warn('Wochentipps nicht geladen', err);
  } finally {
    state.tipsLoading = false;
  }
}

function tipsCard() {
  const today = isoDay(new Date());
  const tips = upcomingTips(state.tips, today);
  // Die Karte bleibt immer da – auch wenn gerade keine Tipps aktuell sind
  const title = '🎪 Diese Woche in Ehrenfeld';
  if (!tips.length) {
    return foldCard('tips', {
      title,
      body: `<p class="empty">${state.tips ? 'Gerade keine aktuellen Tipps – neue kommen jeden Montag.' : 'Tipps werden geladen …'}</p>`,
    });
  }
  const q = state.tipsQuery ?? '';
  // Suche nur auf Wunsch aufklappen (bleibt offen, solange etwas gesucht wird)
  const searchOpen = state.tipsSearch || Boolean(q);
  return foldCard('tips', {
    title,
    action: `<button class="link-btn" data-action="tips-search-toggle">${searchOpen ? 'Suche schließen' : '🔍 Suchen'}</button>`,
    summary: `${tips.length} ${tips.length === 1 ? 'Tipp' : 'Tipps'} – Konzerte, Märkte, Partys …`,
    body: `
      ${searchOpen ? `<input type="search" id="tips-search" class="tips-search" placeholder="Flohmarkt, Band, Party …" value="${esc(q)}" autocomplete="off" enterkeyhint="search">
      <div class="chips tips-filters no-swipe">${TIP_FILTERS.map((f) => `
        <button class="chip-btn${q.toLowerCase() === f.q ? ' active' : ''}" data-action="tips-filter" data-q="${f.q}">${f.label}</button>`).join('')}</div>` : ''}
      <div id="tips-list">${tipsListHtml(tips, today)}</div>
      <p class="hint left tips-hint">Jeden Montag neu zusammengesucht – Angaben ohne Gewähr, im Zweifel beim Veranstalter nachsehen.</p>`,
  });
}

// Nur die Liste neu zeichnen (beim Tippen bleibt das Suchfeld so erhalten)
function tipsListHtml(all, today) {
  const q = (state.tipsQuery ?? '').trim();
  const found = searchTips(all, q);
  if (!found.length) return `<p class="empty">Nichts gefunden für „${esc(q)}“. Probier ein anderes Wort.</p>`;
  const shown = q || state.tipsAll ? found : found.slice(0, 4);
  return `
    ${q ? `<p class="hint left tips-count">${found.length} ${found.length === 1 ? 'Treffer' : 'Treffer'}</p>` : ''}
    <ul class="tips">${shown.map((t) => `
      <li><a class="tip" href="${esc(t.url ?? '#')}" target="_blank" rel="noopener">
        <span class="tip-emoji" aria-hidden="true">${esc(t.emoji ?? '📍')}</span>
        <span class="tip-main">
          <span class="tip-title">${esc(t.title)}</span>
          <span class="tip-sub">${esc(tipDay(t, today))}${t.time ? ` · ${esc(t.time)}` : ''}</span>
          ${t.place ? `<span class="tip-text">📍 ${esc(t.place)}</span>` : ''}
          ${t.text ? `<span class="tip-text">${esc(t.text)}</span>` : ''}
        </span>
        <span class="tip-arrow" aria-hidden="true">›</span>
      </a></li>`).join('')}</ul>
    ${!q && found.length > 4 ? `<button class="link-btn tips-more" data-action="tips-toggle">${state.tipsAll ? 'Weniger anzeigen' : `Alle ${found.length} Tipps anzeigen`}</button>` : ''}`;
}

function updateTipsList() {
  const box = $('#tips-list');
  if (box) box.innerHTML = tipsListHtml(upcomingTips(state.tips, isoDay(new Date())), isoDay(new Date()));
  document.querySelectorAll('[data-action=tips-filter]').forEach((b) => b.classList.toggle('active', (state.tipsQuery ?? '').toLowerCase() === b.dataset.q));
}

function startCalendarCard() {
  const cal = state.calendar;
  if (!cal.config) {
    return `<button class="card banner" data-action="tab" data-tab="kalender">
      <span class="banner-icon" aria-hidden="true">📅</span>
      <span class="banner-text">Kalender<strong>Noch nicht verbunden</strong></span>
      <span class="banner-arrow" aria-hidden="true">›</span>
    </button>`;
  }
  const groups = groupByDay(cal.events ?? []).slice(0, 3);
  const body = cal.error ? `<p class="error">${esc(calendarErrorText(cal.error))}</p>`
    : !cal.events ? '<div class="center-pad"><div class="spinner"></div></div>'
      : groups.length ? groups.map((g) => `
        <div class="start-day">
          <span class="start-day-title${sameDay(g.day, new Date()) ? ' today' : ''}">${dayTitle(g.day)}</span>
          ${g.events.slice(0, 3).map((e) => `<button type="button" class="start-event" data-action="event-open" data-id="${esc(e.id)}"><span>${e.allDay ? 'ganztägig' : sameDay(e.start, g.day) ? timeOf(e.start) : 'läuft'}</span>${esc(e.title)}</button>`).join('')}
        </div>`).join('')
        : '<p class="empty">Keine Termine in den nächsten Wochen.</p>';
  const bodyWithAdd = `${body}<button class="link-btn start-event-add" data-action="event-new">＋ Termin eintragen</button>`;
  const first = groups[0]?.events[0];
  return foldCard('events', {
    title: '📅 Nächste Termine',
    action: '<button class="link-btn" data-action="tab" data-tab="kalender">Ganzer Kalender ›</button>',
    body: bodyWithAdd,
    summary: first ? `${dayTitle(groups[0].day)}: ${esc(first.title)}` : '',
  });
}

function startChoreCard(myChores) {
  if (!myChores.length) {
    return `<button class="card banner" data-action="tab" data-tab="putzplan">
      <span class="banner-icon" aria-hidden="true">😎</span>
      <span class="banner-text">Putzplan<strong>Diese Woche hast du frei</strong></span>
      <span class="banner-arrow" aria-hidden="true">›</span>
    </button>`;
  }
  const openOnes = myChores.filter((c) => !c.doneBy);
  return foldCard('chore', {
    title: '🧹 Deine Aufgabe diese Woche',
    action: '<button class="link-btn" data-action="tab" data-tab="putzplan">Putzplan ›</button>',
    summary: openOnes.length ? `Noch offen: ${openOnes.map((c) => `${c.chore.icon} ${esc(c.chore.name)}`).join(', ')}` : 'Alles erledigt ✓',
    body: myChores.map((c) => `
        <div class="start-chore${c.doneBy ? ' done' : ''}">
          <span class="start-chore-name">${c.chore.icon} ${esc(c.chore.name)}</span>
          ${c.doneBy ? '<span class="done-label">✓ erledigt</span>'
            : `<button class="btn small primary" data-action="chore-done-start" data-id="${c.docId}">Erledigt ✓</button>`}
        </div>`).join(''),
  });
}

// ---------- Abwesenheiten ----------

function absencesCard() {
  const list = upcomingAbsences(state.absences);
  const items = list.map((a) => `
    <li class="row">
      <button type="button" class="row-edit" data-action="absence-edit" data-id="${esc(a.id)}" aria-label="Abwesenheit bearbeiten">
        ${avatar(a.person, true)}
        <span class="row-name">${esc(personName(a.person))}
          <small>${a.from === a.to ? shortDate(a.from) : `${shortDate(a.from)} – ${shortDate(a.to)}`}${a.note ? ` · ${esc(a.note)}` : ''}${isAwayOn(state.absences, a.person) && a.from <= isoDay(new Date()) ? ' · gerade weg' : ''}</small>
        </span>
        <span class="row-arrow" aria-hidden="true">✎</span>
      </button>
      <button class="icon-btn small" data-action="absence-delete" data-id="${esc(a.id)}" aria-label="Abwesenheit löschen">✕</button>
    </li>`).join('');
  const names = [...new Set(list.map((a) => personName(a.person)))];
  return foldCard('away', {
    title: '🌴 Wer ist weg?',
    action: '<button class="link-btn" data-action="absence-new">＋ Eintragen</button>',
    body: items ? `<ul class="rows">${items}</ul>` : '<p class="empty">Alle sind da.</p>',
    summary: names.length ? `Bald weg: ${esc(names.join(', '))}` : 'Alle sind da.',
  });
}

// Neu eintragen oder (mit absence) bearbeiten – Antippen eines Eintrags in „Wer ist weg?“
function openAbsenceForm(absence = null) {
  state.editingAbsence = absence?.id ?? null;
  const person = absence?.person ?? state.me;
  $('#a-title').textContent = absence ? 'Abwesenheit bearbeiten' : 'Ich bin nicht da';
  $('#a-person').innerHTML = PEOPLE.map((p) => chip('absPerson', 'radio', p.id, p.name, p.id === person)).join('');
  $('#a-from').value = absence?.from ?? todayISO();
  $('#a-to').value = absence?.to ?? todayISO();
  $('#a-note').value = absence?.note ?? '';
  $('#a-error').textContent = '';
  $('#a-delete').hidden = !absence;
  $('#absence-dialog').showModal();
}

function onSubmitAbsence(event) {
  event.preventDefault();
  const person = $('#absence-form input[name=absPerson]:checked')?.value ?? state.me;
  const from = $('#a-from').value;
  const to = $('#a-to').value;
  if (!from || !to || to < from) {
    $('#a-error').textContent = 'Bitte ein gültiges Von- und Bis-Datum wählen.';
    return;
  }
  const note = $('#a-note').value.trim();
  const id = state.editingAbsence;
  (id
    ? backend.update('absences', id, { person, from, to, note, updatedBy: state.me, updatedAt: backend.now() })
    : backend.add('absences', { person, from, to, note, createdBy: state.me, createdAt: backend.now() })).catch(showError);
  $('#absence-dialog').close();
  toast(id ? 'Geändert ✓ Der Putzplan passt sich an.' : 'Eingetragen ✓ Der Putzplan passt sich an.');
}

function deleteAbsence(id) {
  const absence = state.absences.find((a) => a.id === id);
  if (absence) removeWithUndo('Abwesenheit gelöscht', [{ col: 'absences', doc: absence }]);
}

// ---------- 📝 Kurz notiert (Startseite) ----------

function quickNotesCard() {
  const notes = visibleQuickNotes(state.quickNotes, toMillis);
  const items = notes.map((n) => `
      <li class="quick-note">
        <button class="quick-note-main" data-action="quicknote-edit" data-id="${esc(n.id)}">
          <span class="quick-note-text">${esc(n.text)}</span>
          <span class="quick-note-meta">${esc(personName(n.createdBy))} · ${esc(agoText(toMillis(n.createdAt)))}${n.updatedBy && n.updatedBy !== n.createdBy ? ` · geändert von ${esc(personName(n.updatedBy))}` : ''}</span>
        </button>
        <button class="icon-btn small" data-action="quicknote-delete" data-id="${esc(n.id)}" aria-label="Zettel löschen">✕</button>
      </li>`).join('');
  return foldCard('quicknotes', {
    title: '📝 Kurz notiert',
    action: '<button class="link-btn" data-action="quicknote-new">＋ Neu</button>',
    body: items ? `<ul class="quick-list">${items}</ul>` : '<p class="empty">Nichts notiert. Kurze Info für die anderen? „Bin heute spät da“, „Paket im Flur“ …</p>',
    summary: notes.length ? `${notes.length === 1 ? '1 Zettel' : `${notes.length} Zettel`}: ${esc(notes[0].text.slice(0, 60))}${notes[0].text.length > 60 ? '…' : ''}` : 'Nichts notiert.',
  });
}

// Zettel, die älter als 7 Tage sind, einmal pro App-Start aus der Datenbank löschen
let quickCleaned = false;
function cleanupQuickNotes() {
  if (quickCleaned || !state.quickNotes.length) return;
  quickCleaned = true;
  const visible = new Set(visibleQuickNotes(state.quickNotes, toMillis).map((n) => n.id));
  state.quickNotes
    .filter((n) => !visible.has(n.id) && toMillis(n.createdAt) > 0)
    .forEach((n) => backend.remove('quickNotes', n.id).catch((err) => console.error(err)));
}

function openQuickForm(note = null) {
  state.editingQuick = note?.id ?? null;
  $('#q-head').textContent = note ? 'Zettel bearbeiten' : 'Kurz notiert';
  $('#q-text').value = note?.text ?? '';
  $('#q-error').textContent = '';
  $('#q-delete').hidden = !note;
  $('#quick-dialog').showModal();
}

function onSubmitQuick(event) {
  event.preventDefault();
  const text = $('#q-text').value.trim().slice(0, QUICK_NOTE_MAX);
  if (!text) {
    $('#q-error').textContent = 'Bitte etwas eintragen.';
    return;
  }
  const id = state.editingQuick;
  (id
    ? backend.update('quickNotes', id, { text, updatedBy: state.me, updatedAt: backend.now() })
    : backend.add('quickNotes', { text, createdBy: state.me, createdAt: backend.now() })).catch(showError);
  $('#quick-dialog').close();
  toast(id ? 'Zettel geändert ✓' : 'Notiert ✓ Die anderen sehen es auf der Startseite.');
}

function deleteQuick(id) {
  const note = state.quickNotes.find((n) => n.id === id);
  if (!note) return;
  if ($('#quick-dialog').open) $('#quick-dialog').close();
  removeWithUndo('Zettel gelöscht', [{ col: 'quickNotes', doc: note }]);
}

// ---------- ⭐ Wie war's? (Bewertung für den WG-Abend) ----------

const ratableInvites = () => state.invites
  .filter((i) => isRatingOpen(i, toMillis(i.createdAt), PERSON_IDS) && inviteParticipants(i, PERSON_IDS).includes(state.me))
  .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

function starsHtml(inv, mine) {
  return `<div class="stars" role="group" aria-label="Bewertung für ${esc(inv.title)}">${[1, 2, 3, 4, 5].map((n) => `
    <button type="button" class="star${mine >= n ? ' on' : ''}" data-action="rate" data-id="${esc(inv.id)}" data-stars="${n}" aria-label="${n} ${n === 1 ? 'Stern' : 'Sterne'}"${mine === n ? ' aria-pressed="true"' : ''}>★</button>`).join('')}</div>`;
}

function ratingBlock(inv) {
  const mine = inv.ratings?.[state.me] ?? 0;
  const sum = ratingSummary(inv);
  const people = inviteParticipants(inv, PERSON_IDS).length;
  return `
    <div class="rating">
      <span class="rating-title">${mine ? 'Deine Bewertung' : 'Wie war\'s?'} ${esc(inv.emoji || '🙋')} ${esc(inv.title)}</span>
      ${starsHtml(inv, mine)}
      <span class="rating-sub">${sum ? `<span class="rating-result">⭐ ${sum.text}</span> · ${sum.count} von ${people} ${sum.count === 1 ? 'hat' : 'haben'} bewertet` : 'Noch keine Bewertung – sei die/der Erste!'}${mine ? ' · nochmal tippen = ändern' : ''}</span>
    </div>`;
}

function rateInvite(id, stars) {
  const inv = state.invites.find((i) => i.id === id);
  if (!inv) return;
  const current = inv.ratings?.[state.me];
  backend.update('invites', id, { [`ratings.${state.me}`]: stars }).catch(showError);
  toast(current ? 'Bewertung geändert ✓' : 'Danke für deine Bewertung ⭐');
}

function bestEveningsBody() {
  const best = bestEvenings(state.invites, toMillis);
  if (!best.length) return '<p class="empty">Noch keine bewerteten WG-Abende. Nach einer „Wer hat Bock?“-Aktion könnt ihr sie mit Sternen bewerten.</p>';
  return `<ol class="best-list">${best.map(({ inv, sum }, i) => `
    <li class="best">
      <span class="best-emoji" aria-hidden="true">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : esc(inv.emoji || '🙋')}</span>
      <span class="best-main"><strong>${esc(inv.emoji || '')} ${esc(inv.title)}</strong>
        <small>${esc(personName(inv.createdBy))} · ${new Date(Date.parse(inv.at ?? '') || toMillis(inv.createdAt)).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} · ${sum.count} ${sum.count === 1 ? 'Bewertung' : 'Bewertungen'}</small></span>
      <span class="best-score">⭐ ${sum.text}</span>
    </li>`).join('')}</ol>`;
}

// ---------- 📻 WG-Radio ----------

const radio = { id: null, status: 'off', retries: 0, sleepAt: 0 }; // status: off | loading | playing | paused | error
const radioStations = () => allStations(state.radioSettings?.stations ?? []);
const currentStation = () => radioStations().find((s) => s.id === radio.id) ?? null;
const RADIO_RETRIES = 3; // so oft neu verbinden, wenn der Stream abreißt (z. B. WLAN → Mobilfunk)
const SLEEP_OPTIONS = [15, 30, 60];

function lastStationId() {
  try { return localStorage.getItem('koelle.radioLast'); } catch { return null; }
}

function openRadio() {
  if (!$('#radio-dialog').open) $('#radio-dialog').showModal();
  renderRadio();
}

function playStation(id) {
  const station = radioStations().find((s) => s.id === id);
  if (!station) return;
  if (radio.id === id && (radio.status === 'playing' || radio.status === 'loading')) {
    pauseRadio();
    return;
  }
  radio.id = id;
  radio.retries = 0;
  try { localStorage.setItem('koelle.radioLast', id); } catch { /* egal */ }
  startStream(station);
}

// Live-Radio immer frisch starten (sonst spielt es nach einer Pause Altes ab)
function startStream(station) {
  const audio = $('#radio-audio');
  radio.status = 'loading';
  clearTimeout(radio.timer);
  clearTimeout(radio.retryTimer);
  const id = station.id;
  radio.timer = setTimeout(() => { if (radio.id === id && radio.status === 'loading') radioLost(); }, 15000);
  audio.src = station.url;
  audio.play().catch((err) => {
    if (err?.name === 'AbortError') return; // anderer Sender gewählt
    if (err?.name === 'NotAllowedError') {
      radio.status = 'paused';
      renderRadio();
      return;
    }
    radioLost();
  });
  if ('mediaSession' in navigator && window.MediaMetadata) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: 'WG-Radio · Projekt Kölle',
      artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
  }
  renderRadio();
}

function pauseRadio() {
  clearTimeout(radio.timer);
  clearTimeout(radio.retryTimer);
  radio.status = 'paused'; // vor pause(), damit das „pause“-Ereignis nichts durcheinanderbringt
  $('#radio-audio').pause();
  renderRadio();
}

function toggleRadio() {
  const station = currentStation();
  if (!station) return;
  if (radio.status === 'playing' || radio.status === 'loading') pauseRadio();
  else {
    radio.retries = 0;
    startStream(station);
  }
}

function stopRadio() {
  clearTimeout(radio.timer);
  clearTimeout(radio.retryTimer);
  setRadioSleep(0, false);
  const audio = $('#radio-audio');
  radio.id = null;
  radio.status = 'off';
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  renderRadio();
}

// Stream abgerissen oder lädt nicht: erst ein paar Mal still neu verbinden, dann Fehlermeldung
function radioLost() {
  const station = currentStation();
  if (!station || radio.status === 'paused' || radio.status === 'off') return;
  if (!navigator.onLine) { // ohne Netz warten – das „online“-Ereignis startet neu
    radio.status = 'loading';
    radio.waitingForNet = true;
    clearTimeout(radio.timer);
    renderRadio();
    return;
  }
  if (radio.retries < RADIO_RETRIES) {
    radio.retries += 1;
    radio.status = 'loading';
    clearTimeout(radio.timer);
    clearTimeout(radio.retryTimer);
    renderRadio();
    radio.retryTimer = setTimeout(() => { if (radio.id === station.id && radio.status === 'loading') startStream(station); }, 1000 * radio.retries);
    return;
  }
  radioFailed();
}

function radioFailed() {
  if (!radio.id) return;
  clearTimeout(radio.timer);
  radio.status = 'error';
  renderRadio();
}

function radioStateText(status) {
  if (status === 'loading' && radio.waitingForNet) return 'Wartet auf Netz …';
  if (status === 'loading' && radio.retries) return 'Verbindet neu …';
  return { loading: 'Lädt …', playing: 'Läuft', paused: 'Pause', error: 'Geht gerade nicht' }[status] ?? '';
}

// Schlaf-Timer: Radio geht nach X Minuten von selbst aus
function setRadioSleep(minutes, render = true) {
  clearTimeout(radio.sleepTimer);
  radio.sleepAt = minutes ? Date.now() + minutes * 60000 : 0;
  radio.sleepMin = minutes;
  if (minutes) radio.sleepTimer = setTimeout(() => { stopRadio(); toast('Gute Nacht 🌙 Das Radio ist aus.'); }, minutes * 60000);
  if (render) renderRadio();
}

function sleepLeftText() {
  return `in ${Math.max(1, Math.ceil((radio.sleepAt - Date.now()) / 60000))} Min.`;
}

function renderRadio() {
  const station = currentStation();
  if (radio.id && !station) { stopRadio(); return; } // Sender wurde gelöscht
  const on = Boolean(station);
  document.body.classList.toggle('radio-on', on);
  document.body.classList.toggle('radio-playing', on && radio.status === 'playing');
  $('#radio-bar').hidden = !on;
  $('#radio-btn').setAttribute('aria-pressed', String(on));
  if (on) {
    $('#radio-bar-name').textContent = station.name;
    $('#radio-bar-state').textContent = `WG-Radio · ${radioStateText(radio.status)}${radio.sleepAt ? ` · 🌙 aus ${sleepLeftText()}` : ''}`;
    const playing = radio.status === 'playing' || radio.status === 'loading';
    $('#radio-bar-toggle').textContent = playing ? '⏸' : '▶︎';
    $('#radio-bar-toggle').setAttribute('aria-label', playing ? 'Pause' : 'Weiterhören');
  }
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.playbackState = radio.status === 'playing' || radio.status === 'loading' ? 'playing' : on ? 'paused' : 'none'; } catch { /* egal */ }
  }
  if (!$('#radio-dialog').open) return;
  const playlist = isWebUrl(state.radioSettings?.playlistUrl ?? '') ? state.radioSettings.playlistUrl : '';
  const stationRow = (s) => {
    const active = s.id === radio.id;
    const last = !radio.id && s.id === lastStationId();
    return `
      <li class="station">
        <button type="button" class="station-play${active ? ' active' : ''}" data-action="radio-play" data-id="${esc(s.id)}">
          <span class="station-icon" aria-hidden="true">${esc(s.icon)}</span>
          <span class="station-text"><strong>${esc(s.name)}</strong>${s.hint ? `<small>${esc(s.hint)}</small>` : '<small>Eigener Sender</small>'}</span>
          <span class="station-state">${active ? radioStateText(radio.status) : last ? 'Zuletzt ▶︎' : '▶︎'}</span>
        </button>
        ${s.custom ? `<button type="button" class="icon-btn small" data-action="radio-edit" data-id="${esc(s.id)}" aria-label="${esc(s.name)} bearbeiten">✎</button>` : ''}
      </li>`;
  };
  $('#radio-body').innerHTML = `
    ${radio.status === 'error' && station ? `<div class="radio-error"><p>„${esc(station.name)}“ ist gerade nicht erreichbar. Versuch es gleich nochmal oder nimm einen anderen Sender.</p>
      <button type="button" class="btn outline" data-action="radio-retry">🔄 Nochmal versuchen</button></div>` : ''}
    <ul class="station-list">${radioStations().map(stationRow).join('')}</ul>
    <button type="button" class="link-btn" data-action="radio-edit" style="margin-top: 1px">＋ Eigenen Sender hinzufügen</button>
    ${station && radio.status !== 'error' ? `<div class="radio-sleep">
      <span class="label">🌙 Ausschalten nach</span>
      <div class="chips">
        ${SLEEP_OPTIONS.map((m) => `<button type="button" class="chip-btn${radio.sleepAt && radio.sleepMin === m ? ' active' : ''}" data-action="radio-sleep" data-min="${m}">${m} Min.</button>`).join('')}
        ${radio.sleepAt ? '<button type="button" class="chip-btn" data-action="radio-sleep" data-min="0">Timer aus</button>' : ''}
      </div>
      ${radio.sleepAt ? `<span class="hint">Das Radio geht ${sleepLeftText()} aus.</span>` : ''}
    </div>` : ''}
    <h3 class="radio-section-title">🎵 Unsere Playlist</h3>
    <div class="radio-playlist">
      ${playlist
        ? `<a class="btn primary full" href="${esc(playlist)}" target="_blank" rel="noopener">🎵 Playlist in ${esc(playlistService(playlist))} öffnen</a>
           <button type="button" class="link-btn" data-action="radio-playlist">Link ändern</button>`
        : `<p class="hint">Habt ihr eine gemeinsame Playlist, z. B. bei Spotify? Link hier eintragen – dann ist sie für alle mit einem Tipp da.</p>
           <button type="button" class="btn outline full" data-action="radio-playlist">＋ Playlist-Link eintragen</button>`}
    </div>
    <p class="hint">Das Radio läuft weiter, während du in der App unterwegs bist. Unten erscheint dann eine Leiste zum Anhalten.</p>`;
}

function openRadioEdit(id = null, kind = 'station') {
  state.radioEdit = { id, kind };
  const station = id ? (state.radioSettings?.stations ?? []).find((s) => s.id === id) : null;
  const isPlaylist = kind === 'playlist';
  $('#r-head').textContent = isPlaylist ? 'Playlist-Link' : station ? 'Sender bearbeiten' : 'Eigener Sender';
  $('#r-name-row').hidden = isPlaylist;
  $('#r-name').value = station?.name ?? '';
  $('#r-url-label').textContent = isPlaylist ? 'Link zur Playlist' : 'Stream-Adresse';
  $('#r-url').value = isPlaylist ? (state.radioSettings?.playlistUrl ?? '') : (station?.url ?? '');
  $('#r-hint').textContent = isPlaylist
    ? 'In Spotify: Playlist → „…“ → „Teilen“ → „Link kopieren“. Feld leeren = Link entfernen.'
    : 'Die Adresse des Streams (beginnt mit https://), oft auf der Webseite des Senders unter „Webradio“ oder „Stream-URL“.';
  $('#r-error').textContent = '';
  $('#r-delete').hidden = isPlaylist || !station;
  $('#radio-edit-dialog').showModal();
}

function saveRadioSettings(changes) {
  const current = state.radioSettings ?? {};
  return backend.set('settings', 'radio', {
    stations: current.stations ?? [],
    playlistUrl: current.playlistUrl ?? '',
    ...changes,
    updatedBy: state.me,
    updatedAt: backend.now(),
  }).catch(showError);
}

function onSubmitRadioEdit(event) {
  event.preventDefault();
  const { id, kind } = state.radioEdit ?? {};
  const url = $('#r-url').value.trim();
  if (kind === 'playlist') {
    if (url && !isWebUrl(url)) {
      $('#r-error').textContent = 'Das sieht nicht wie ein Link aus. Er beginnt mit https://';
      return;
    }
    saveRadioSettings({ playlistUrl: url });
    $('#radio-edit-dialog').close();
    toast(url ? 'Playlist-Link gespeichert ✓' : 'Playlist-Link entfernt');
    return;
  }
  const name = $('#r-name').value.trim();
  const error = !name ? 'Bitte einen Namen eingeben.'
    : !isStreamUrl(url) ? 'Bitte eine Stream-Adresse eingeben, die mit https:// beginnt.' : '';
  $('#r-error').textContent = error;
  if (error) return;
  const stations = [...(state.radioSettings?.stations ?? [])];
  if (id) {
    const i = stations.findIndex((s) => s.id === id);
    if (i >= 0) stations[i] = { ...stations[i], name, url };
  } else {
    stations.push({ id: `own${Date.now().toString(36)}`, name, url, createdBy: state.me });
  }
  saveRadioSettings({ stations });
  $('#radio-edit-dialog').close();
  toast(id ? 'Sender geändert ✓' : 'Sender hinzugefügt ✓ Antippen zum Hören.');
}

function deleteRadioStation() {
  const id = state.radioEdit?.id;
  const station = (state.radioSettings?.stations ?? []).find((s) => s.id === id);
  if (!station || !confirm(`Sender „${station.name}“ für alle löschen?`)) return;
  saveRadioSettings({ stations: (state.radioSettings?.stations ?? []).filter((s) => s.id !== id) });
  $('#radio-edit-dialog').close();
  toast('Sender gelöscht');
}

// ---------- Wer hat Bock? ----------

const activeInvites = () => state.invites
  .filter((i) => isInviteActive(i, toMillis(i.createdAt)))
  .sort((a, b) => (Date.parse(a.at ?? '') || toMillis(a.createdAt)) - (Date.parse(b.at ?? '') || toMillis(b.createdAt)));

function invitesCard() {
  const items = activeInvites().map((inv) => {
    const responses = inv.responses ?? {};
    const yes = PERSON_IDS.filter((id) => id === inv.createdBy || responses[id] === 'yes');
    const no = PERSON_IDS.filter((id) => id !== inv.createdBy && responses[id] === 'no');
    const mine = inv.createdBy === state.me;
    const myAnswer = responses[state.me];
    const count = inv.kind === 'food' ? `${yes.length} ${yes.length === 1 ? 'Portion' : 'Portionen'}` : `${yes.length} dabei`;
    return `
      <div class="invite">
        <div class="invite-head">
          <span class="invite-emoji-big" aria-hidden="true">${esc(inv.emoji || '🙋')}</span>
          <span class="invite-main">
            <strong>${esc(inv.title)}</strong>
            <small>${esc(personName(inv.createdBy))} · ${esc(inviteWhen(inv))}${inv.note ? ` · ${esc(inv.note)}` : ''}</small>
          </span>
        </div>
        <div class="invite-people">
          <span class="invite-yes">${yes.map((id) => avatar(id, true)).join('')} <span>${count}</span></span>
          ${no.length ? `<span class="invite-no">nicht dabei: ${no.map((id) => esc(personName(id))).join(', ')}</span>` : ''}
        </div>
        <div class="invite-actions">
          ${mine
            ? `<button class="link-btn" data-action="invite-delete" data-id="${esc(inv.id)}">Absagen</button>`
            : `<button class="btn small${myAnswer === 'yes' ? ' primary' : ''}" data-action="invite-answer" data-id="${esc(inv.id)}" data-answer="yes">Bin dabei 👍</button>
               <button class="btn small${myAnswer === 'no' ? ' chosen-no' : ''}" data-action="invite-answer" data-id="${esc(inv.id)}" data-answer="no">Diesmal nicht</button>`}
        </div>
      </div>`;
  }).join('');
  const active = activeInvites();
  const waiting = active.filter((i) => i.createdBy !== state.me && !i.responses?.[state.me]).length;
  const ratable = ratableInvites();
  const unrated = ratable.filter((i) => !i.ratings?.[state.me]);
  const ratings = ratable.map(ratingBlock).join('');
  const hasBest = state.invites.some((i) => ratingSummary(i));
  const best = hasBest ? '<button class="link-btn best-link" data-action="panel-open" data-panel="best">🏆 Beste WG-Abende</button>' : '';
  const summaryParts = [
    active.length ? active.map((i) => `${esc(i.emoji ?? '🙋')} ${esc(i.title)}`).join(' · ') : 'Gerade nichts los.',
    waiting ? '<strong class="fold-alert">wartet auf deine Antwort</strong>' : '',
    unrated.length ? '<strong class="fold-alert">Wie war\'s? Bitte bewerten</strong>' : '',
  ].filter(Boolean);
  return foldCard('invites', {
    title: '🙋 Wer hat Bock?',
    action: '<button class="link-btn" data-action="invite-new">＋ Neu</button>',
    body: `${items || (ratings ? '' : '<p class="empty">Gerade nichts los. Kochst du? Lust auf Film oder Bouldern? Frag die anderen!</p>')}${ratings}${best}`,
    summary: summaryParts.join(' · '),
  });
}

function openInviteForm() {
  $('#i-templates').innerHTML = INVITE_TEMPLATES.map((t, i) => `
    <button type="button" class="chip-btn" data-action="invite-template" data-index="${i}">${t.emoji} ${esc(t.title)}</button>`).join('');
  $('#i-emoji').value = '🙋';
  $('#i-title').value = '';
  $('#i-note').value = '';
  $('#invite-form input[name=iWhen][value=now]').checked = true;
  $('#i-time').hidden = true;
  $('#i-error').textContent = '';
  state.inviteKind = 'other';
  state.inviteEmojiChosen = false;
  $('#invite-dialog').showModal();
}

function useInviteTemplate(index) {
  const t = INVITE_TEMPLATES[index];
  $('#i-emoji').value = t.emoji;
  $('#i-title').value = t.title;
  state.inviteKind = t.kind;
  state.inviteEmojiChosen = false;
}

function onSubmitInvite(event) {
  event.preventDefault();
  const title = $('#i-title').value.trim();
  if (!title) {
    $('#i-error').textContent = 'Bitte kurz eingeben, was du vorhast.';
    return;
  }
  const when = $('#invite-form input[name=iWhen]:checked').value;
  let at = null;
  if (when !== 'now') {
    const [h, m] = ($('#i-time').value || '19:00').split(':').map(Number);
    const d = new Date();
    if (when === 'tomorrow') d.setDate(d.getDate() + 1);
    d.setHours(h, m, 0, 0);
    at = d.toISOString();
  }
  // "Kochen" erkennt die App auch am Text, damit Portionen gezählt werden
  const kind = state.inviteKind === 'food' || /koch|essen|mitessen|grill|back/i.test(title) ? 'food' : 'other';
  backend.add('invites', {
    emoji: $('#i-emoji').value.trim() || '🙋', title, note: $('#i-note').value.trim(), at, kind,
    responses: {}, createdBy: state.me, createdAt: backend.now(),
  }).catch(showError);
  $('#invite-dialog').close();
  toast('Reingestellt ✓ Die anderen sehen es auf der Startseite.');
}

function answerInvite(id, answer) {
  const inv = state.invites.find((i) => i.id === id);
  if (!inv) return;
  // Nochmal auf dieselbe Antwort tippen nimmt sie zurück
  const value = inv.responses?.[state.me] === answer ? null : answer;
  backend.update('invites', id, { [`responses.${state.me}`]: value }).catch(showError);
}

function deleteInvite(id) {
  const inv = state.invites.find((i) => i.id === id);
  if (inv) removeWithUndo('Aktion abgesagt', [{ col: 'invites', doc: inv }]);
}

// ---------- Abstimmungen ----------

function pollsCard() {
  const weekAgo = Date.now() - 7 * 86400000;
  const polls = currentPolls()
    .filter((p) => !p.closed || toMillis(p.closedAt) > weekAgo)
    .sort((a, b) => (a.closed - b.closed) || (toMillis(b.createdAt) - toMillis(a.createdAt)));
  const cards = polls.map((p) => {
    const votes = p.votes ?? {};
    const counts = p.options.map((_, i) => PERSON_IDS.filter((id) => votes[id] === i));
    const max = Math.max(...counts.map((c) => c.length));
    const voted = PERSON_IDS.filter((id) => votes[id] != null).length;
    return `
      <div class="poll${p.closed ? ' closed' : ''}">
        <p class="poll-question">${esc(p.question)}${p.closed
          ? (p.until ? ` <span class="poll-date">📅 ${pollDay(p.until)}</span>` : '')
          : ` <button type="button" class="poll-date${p.until ? '' : ' empty'}" data-action="poll-date" data-id="${esc(p.id)}" aria-label="${p.until ? `Datum ${pollDay(p.until)} ändern` : 'Datum festlegen'}">📅 ${p.until ? pollDay(p.until) : 'Wann?'}</button>`}</p>
        <div class="poll-options">${p.options.map((opt, i) => `
          <button class="poll-option${votes[state.me] === i ? ' mine' : ''}${p.closed && max > 0 && counts[i].length === max ? ' winner' : ''}"
            ${p.closed ? 'disabled' : `data-action="poll-vote" data-id="${esc(p.id)}" data-index="${i}"`}>
            <span class="poll-text">${esc(opt)}</span>
            <span class="poll-voters">${counts[i].map((id) => avatar(id, true)).join('')}</span>
          </button>`).join('')}</div>
        <div class="poll-foot">
          <span>${p.closed ? 'Beendet' : `${voted} von ${PERSON_IDS.length} haben abgestimmt`}</span>
          <span>
            ${p.closed ? '' : `<button class="link-btn" data-action="poll-close" data-id="${esc(p.id)}">Beenden</button>`}
            <button class="link-btn" data-action="poll-delete" data-id="${esc(p.id)}">Löschen</button>
          </span>
        </div>
      </div>`;
  }).join('');
  const open = polls.filter((p) => !p.closed);
  const missing = open.filter((p) => p.votes?.[state.me] == null).length;
  return foldCard('polls', {
    title: '🗳️ Abstimmungen',
    action: '<button class="link-btn" data-action="poll-new">＋ Neu</button>',
    body: cards || '<p class="empty">Gerade keine Abstimmung. Zum Beispiel: „Pizza oder Sushi am Freitag?“</p>',
    summary: !polls.length ? 'Gerade keine Abstimmung.'
      : `${open.length ? `${open.length} offen` : 'Alle beendet'}${missing ? ` · <strong class="fold-alert">${missing === 1 ? 'deine Stimme fehlt' : `${missing}× fehlt deine Stimme`}</strong>` : ''}`,
  });
}

function pollOptionInput(value = '') {
  return `<input class="poll-input" maxlength="60" placeholder="Antwort" value="${esc(value)}" autocomplete="off">`;
}

function openPollForm() {
  $('#p-question').value = '';
  $('#p-date').value = '';
  state.pollDateChosen = false;
  $('#p-options').innerHTML = pollOptionInput() + pollOptionInput();
  $('#p-error').textContent = '';
  $('#poll-dialog').showModal();
  $('#p-question').focus();
}

function onSubmitPoll(event) {
  event.preventDefault();
  const question = $('#p-question').value.trim();
  const options = [...document.querySelectorAll('#p-options .poll-input')].map((i) => i.value.trim()).filter(Boolean);
  const problem = !question ? 'Bitte eine Frage eingeben.' : options.length < 2 ? 'Bitte mindestens zwei Antworten eingeben.' : '';
  if (problem) {
    $('#p-error').textContent = problem;
    return;
  }
  const until = $('#p-date').value || null;
  backend.add('polls', { question, options, until, votes: {}, closed: false, createdBy: state.me, createdAt: backend.now() }).catch(showError);
  $('#poll-dialog').close();
  toast('Abstimmung gestartet ✓');
}

// Datum nachträglich setzen/ändern – auch für alte Abstimmungen ohne Datum,
// damit sie nach dem Tag verschwinden.
function openPollDate(id) {
  const poll = state.polls.find((p) => p.id === id);
  if (!poll) return;
  state.pollDateId = id;
  $('#pd-question').textContent = poll.question;
  $('#pd-date').value = poll.until ?? guessDateFromText(poll.question) ?? '';
  $('#pd-clear').hidden = !poll.until;
  $('#poll-date-dialog').showModal();
}

function savePollDate(value) {
  const id = state.pollDateId;
  if (!id) return;
  backend.update('polls', id, { until: value || null }).catch(showError);
  $('#poll-date-dialog').close();
  const today = isoDay(new Date());
  toast(!value ? 'Datum entfernt' : value < today ? 'Datum gespeichert – der Tag ist vorbei, die Abstimmung verschwindet.' : `Gespeichert ✓ Verschwindet nach ${pollDay(value)}`);
}

function votePoll(id, index) {
  const poll = state.polls.find((p) => p.id === id);
  if (!poll || poll.closed) return;
  // Nochmal auf die eigene Antwort tippen nimmt die Stimme zurück.
  const value = poll.votes?.[state.me] === index ? null : index;
  backend.update('polls', id, { [`votes.${state.me}`]: value }).catch(showError);
}

function closePoll(id) {
  backend.update('polls', id, { closed: true, closedAt: backend.now(), closedBy: state.me }).catch(showError);
}

function deletePoll(id) {
  const poll = state.polls.find((p) => p.id === id);
  if (poll) removeWithUndo('Abstimmung gelöscht', [{ col: 'polls', doc: poll }]);
}

// ---------- Suche bei den Ausgaben ----------

function openSearch() {
  $('#search-input').value = '';
  renderSearch();
  $('#search-dialog').showModal();
  $('#search-input').focus();
}

function renderSearch() {
  const q = $('#search-input').value.trim().toLowerCase();
  const el = $('#search-results');
  if (q.length < 2) {
    el.innerHTML = '<p class="hint">Suche nach Beschreibung, Kategorie, Person oder Betrag – auch in früheren Abrechnungen.</p>';
    return;
  }
  const hits = state.expenses.filter((e) => [
    e.description, categoryOf(e.category).name, personName(e.paidBy),
    formatEuro(e.amountCents), (e.amountCents / 100).toFixed(2).replace('.', ','),
  ].some((t) => String(t).toLowerCase().includes(q)))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 50);
  el.innerHTML = hits.length
    ? `<p class="hint">${hits.length === 50 ? 'Die neuesten 50 Treffer' : `${hits.length} ${hits.length === 1 ? 'Treffer' : 'Treffer'}`}</p>
       <ul class="entries">${hits.map((e) => expenseRow({ ...e, date: e.date }, true).replace('<span class="entry-sub">', `<span class="entry-sub">${e.settlementId ? 'abgerechnet · ' : ''}`)).join('')}</ul>`
    : '<p class="empty">Nichts gefunden.</p>';
}

// ---------- Sicherung zurückspielen ----------

const RESTORE_COLLECTIONS = ['expenses', 'payments', 'settlements', 'recurring', 'shopping', 'favorites', 'chores', 'notes', 'noteImages', 'absences', 'polls', 'invites', 'quickNotes'];

async function restoreBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast('Die Datei konnte nicht gelesen werden.', true);
    return;
  }
  if (data?.app !== 'Projekt Kölle') {
    toast('Das ist keine Sicherung von Projekt Kölle.', true);
    return;
  }
  const counts = RESTORE_COLLECTIONS.map((c) => (Array.isArray(data[c]) ? data[c].length : 0));
  const total = counts.reduce((a, b) => a + b, 0);
  const when = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'unbekannt';
  if (!confirm(`Sicherung vom ${when} mit ${total} Einträgen zurückspielen?\n\nEinträge aus der Sicherung werden wiederhergestellt bzw. auf den Stand der Sicherung gesetzt. Neuere Einträge bleiben erhalten.`)) return;
  for (const col of RESTORE_COLLECTIONS) {
    for (const item of data[col] ?? []) {
      if (!item?.id) continue;
      const { id, ...rest } = item;
      backend.set(col, id, rest).catch(showError);
    }
  }
  if (data.radio && typeof data.radio === 'object') {
    const { id, ...radioData } = data.radio;
    backend.set('settings', 'radio', radioData).catch(showError);
  }
  if (Array.isArray(data.choreAreas) && data.choreAreas.length) {
    backend.set('settings', 'putzplan', { areas: data.choreAreas, updatedBy: state.me, updatedAt: backend.now() }).catch(showError);
  }
  toast(`Sicherung zurückgespielt ✓ (${total} Einträge)`);
}

// ---------- Offline-Hinweis ----------

function updateOnline() {
  $('#offline-banner').hidden = navigator.onLine;
}

// ---------- Formular ----------

function chip(name, type, value, label, checked) {
  return `<label class="chip"><input type="${type}" name="${name}" value="${esc(value)}"${checked ? ' checked' : ''}><span>${esc(label)}</span></label>`;
}

// opts.mode: 'expense' oder 'recurring'; opts.prefill: Vorschlagswerte; opts.shopIds: Einkäufe, die abgerechnet werden
function openExpenseForm(expense, opts = {}) {
  if (expense?.settlementId) {
    toast('Abgerechnete Einträge können nicht mehr geändert werden.');
    return;
  }
  const recurring = opts.mode === 'recurring';
  state.formMode = recurring ? 'recurring' : 'expense';
  state.pendingShopIds = opts.shopIds ?? [];
  state.editingId = expense?.id ?? null;
  const prefill = opts.prefill ?? {};
  $('#form-title').textContent = recurring
    ? (expense ? 'Dauerauftrag bearbeiten' : 'Neuer Dauerauftrag')
    : (expense ? 'Ausgabe bearbeiten' : 'Neue Ausgabe');
  $('#f-amount').value = expense ? (expense.amountCents / 100).toFixed(2).replace('.', ',') : '';
  $('#f-desc').value = expense?.description ?? prefill.description ?? '';
  $('#f-date').value = expense?.date ?? todayISO();
  $('#f-date-row').hidden = recurring;
  $('#f-day-row').hidden = !recurring;
  $('#f-receipt-row').hidden = recurring;
  state.formToken = (state.formToken ?? 0) + 1;
  state.receiptBusy = 0;
  state.pendingReceipts = [];
  state.removedReceipts = [];
  state.formReceipts = [];
  // Solange die Fotos nicht geladen sind, bleibt die gespeicherte Anzahl erhalten (z. B. ohne Netz)
  state.receiptsUnknown = !recurring && Boolean(expense?.receipts);
  renderReceiptThumbs();
  if (state.receiptsUnknown) {
    if ((state.receiptCache[expense.id]?.length ?? -1) !== expense.receipts) delete state.receiptCache[expense.id];
    const token = state.formToken;
    loadReceipts(expense.id).then((list) => {
      // anderes Formular offen, Laden fehlgeschlagen oder (offline) noch nichts da
      if (state.formToken !== token || !list || list.length < expense.receipts) {
        if (state.formToken === token && list) delete state.receiptCache[expense.id];
        return;
      }
      state.formReceipts = list;
      state.receiptsUnknown = false;
      renderReceiptThumbs();
    });
  }
  const day = expense?.dayOfMonth ?? 1;
  $('#f-day').innerHTML = Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}"${i + 1 === day ? ' selected' : ''}>${i + 1}.</option>`).join('');

  const category = expense?.category ?? prefill.category ?? CATEGORIES[0].id;
  const paidBy = expense?.paidBy ?? state.me;
  const split = expense?.splitAmong ?? PERSON_IDS;
  $('#f-category').innerHTML = CATEGORIES.map((c) => chip('category', 'radio', c.id, `${c.icon} ${c.name}`, c.id === category)).join('');
  $('#f-paidby').innerHTML = PEOPLE.map((p) => chip('paidBy', 'radio', p.id, p.name, p.id === paidBy)).join('');
  $('#f-split').innerHTML = PEOPLE.map((p) => chip('split', 'checkbox', p.id, p.name, split.includes(p.id))).join('');
  // Nach Posten aufteilen (nicht bei Daueraufträgen). Alte "ungleich"-Einträge werden
  // zu einem Posten pro Person.
  const euroText = (cents) => (cents / 100).toFixed(2).replace('.', ',');
  state.items = expense?.items
    ? expense.items.map((i) => ({ name: i.name ?? '', price: euroText(i.cents), for: [...(i.for ?? [])] }))
    : expense?.shares
      ? Object.entries(expense.shares).map(([id, cents]) => ({ name: `Anteil ${personName(id)}`, price: euroText(cents), for: [id] }))
      : opts.items ?? [];
  const byItems = !recurring && state.items.length > 0;
  $('#f-mode-row').hidden = recurring;
  $('#expense-form').querySelector(`input[name=splitMode][value=${byItems ? 'items' : 'even'}]`).checked = true;
  setSplitMode(byItems);

  $('#f-delete').hidden = !expense;
  $('#f-error').textContent = '';
  $('#expense-dialog').showModal();
  if (byItems && opts.items) $('#f-items input[data-field=price]')?.focus();
  else if (!expense) $('#f-amount').focus();
}

// Betrag eines Postens: leer oder 0 = 0 Cent, ungültig = null
function parseShare(text) {
  const t = String(text ?? '').trim();
  if (!t || /^0+([.,]0*)?$/.test(t)) return 0;
  return parseEuro(t);
}

const isItemMode = () => !$('#f-mode-row').hidden && $('#expense-form input[name=splitMode][value=items]').checked;

// Posten aus dem Formular: nur die mit Preis zählen
function readItems() {
  return (state.items ?? []).map((i) => ({
    name: i.name.trim(),
    cents: parseShare(i.price),
    for: PERSON_IDS.filter((id) => i.for.includes(id)),
  }));
}

function readForm() {
  const form = $('#expense-form');
  const base = {
    description: $('#f-desc').value.trim(),
    category: form.querySelector('input[name=category]:checked')?.value ?? 'sonstiges',
    paidBy: form.querySelector('input[name=paidBy]:checked')?.value ?? state.me,
    date: $('#f-date').value || todayISO(),
  };
  if (isItemMode()) {
    const all = readItems();
    const items = all.filter((i) => i.cents > 0);
    const shares = itemShares(items, PERSON_IDS);
    return {
      ...base,
      amountCents: items.reduce((sum, i) => sum + i.cents, 0),
      splitAmong: Object.keys(shares),
      shares,
      items,
      invalidPrice: all.some((i) => i.cents == null),
      nobody: items.find((i) => !i.for.length),
      withoutPrice: all.filter((i) => i.cents === 0 && i.name).length, // ganz leere Zeilen stören nicht
    };
  }
  return {
    ...base,
    amountCents: parseEuro($('#f-amount').value),
    splitAmong: [...form.querySelectorAll('input[name=split]:checked')].map((i) => i.value),
    shares: null,
    items: null,
  };
}

// Umschalten zwischen "Gleich aufteilen" und "Nach Posten"
function setSplitMode(byItems) {
  $('#f-split-row').hidden = byItems;
  $('#f-items-row').hidden = !byItems;
  $('#f-amount').readOnly = byItems;
  if (byItems && !state.items.length) {
    // Was oben schon als Betrag steht, wird der erste Posten.
    const amount = parseEuro($('#f-amount').value);
    state.items = [{ name: '', price: amount ? $('#f-amount').value.trim() : '', for: [...PERSON_IDS] },
      { name: '', price: '', for: [...PERSON_IDS] }];
  }
  if (byItems) renderItemRows();
  updateSplitHint();
}

// Eingabezeilen der Posten – nur neu zeichnen, wenn Zeilen dazukommen oder wegfallen
function renderItemRows() {
  $('#f-items').innerHTML = state.items.map((item, index) => `
    <div class="item-row">
      <input class="item-name" data-item="${index}" data-field="name" maxlength="60" autocomplete="off" placeholder="Was? (optional)" value="${esc(item.name)}">
      <span class="item-price"><input data-item="${index}" data-field="price" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(item.price)}"><span>€</span></span>
      <button type="button" class="icon-btn" data-action="item-remove" data-index="${index}" aria-label="Posten entfernen">✕</button>
      <div class="chips">${PEOPLE.map((p) => `<label class="chip"><input type="checkbox" data-item="${index}" data-person="${p.id}"${item.for.includes(p.id) ? ' checked' : ''}><span>${esc(p.name)}</span></label>`).join('')}</div>
    </div>`).join('');
}

function addItemRow() {
  state.items.push({ name: '', price: '', for: [...PERSON_IDS] });
  renderItemRows();
  $(`#f-items input[data-item="${state.items.length - 1}"][data-field=price]`)?.focus();
  updateSplitHint();
}

function removeItemRow(index) {
  state.items.splice(index, 1);
  if (!state.items.length) state.items.push({ name: '', price: '', for: [...PERSON_IDS] });
  renderItemRows();
  updateSplitHint();
}

function updateSplitHint() {
  const data = readForm();
  if (isItemMode()) {
    $('#f-amount').value = data.amountCents ? (data.amountCents / 100).toFixed(2).replace('.', ',') : '';
    const box = $('#f-items-sum');
    if (data.invalidPrice) {
      box.innerHTML = '<span class="error">Bitte gültige Preise eingeben, z. B. 2,49.</span>';
      return;
    }
    const who = PERSON_IDS.filter((id) => data.shares[id]).map((id) => `${esc(personName(id))} ${formatEuro(data.shares[id])}`).join(' · ');
    box.innerHTML = `<strong>Summe: ${formatEuro(data.amountCents)}</strong>
      ${who ? `<span class="who">${who}</span>` : ''}
      ${data.withoutPrice ? `<span class="who">${data.withoutPrice === 1 ? '1 Posten hat' : `${data.withoutPrice} Posten haben`} noch keinen Preis und ${data.withoutPrice === 1 ? 'zählt' : 'zählen'} nicht mit.</span>` : ''}`;
    return;
  }
  const { amountCents, splitAmong } = data;
  const hint = $('#f-split-hint');
  if (!splitAmong.length) {
    hint.textContent = 'Bitte mindestens eine Person auswählen.';
  } else if (splitAmong.length === 1) {
    hint.textContent = `${personName(splitAmong[0])} trägt alles.`;
  } else if (amountCents) {
    const shares = Object.values(splitAmount(amountCents, splitAmong, PERSON_IDS));
    const even = Math.min(...shares) === Math.max(...shares);
    hint.textContent = `Das sind ${even ? '' : 'ca. '}${formatEuro(Math.min(...shares))} pro Person.`;
  } else {
    hint.textContent = '';
  }
}

function onSubmitExpense(event) {
  event.preventDefault();
  const { invalidPrice, nobody, withoutPrice, ...data } = readForm();
  const byItems = Boolean(data.items);
  const problem = invalidPrice ? 'Bitte bei den Posten gültige Preise eingeben, z. B. 2,49.'
    : nobody ? `Bei „${nobody.name || 'einem Posten'}“ ist niemand ausgewählt.`
      : !data.amountCents ? (byItems ? 'Bitte bei den Posten mindestens einen Preis eingeben.' : 'Bitte einen gültigen Betrag eingeben, z. B. 12,50.')
        : !data.description ? 'Bitte eingeben, wofür das Geld war.'
          : !data.splitAmong.length ? 'Bitte bei „Für wen?“ mindestens eine Person auswählen.'
            : '';
  if (problem) {
    $('#f-error').textContent = problem;
    return;
  }
  if (state.receiptBusy > 0) {
    $('#f-error').textContent = 'Das Kassenbon-Foto wird noch vorbereitet – einen Moment, dann nochmal „Speichern“.';
    return;
  }
  if (withoutPrice && !confirm(`${withoutPrice === 1 ? '1 Posten hat' : `${withoutPrice} Posten haben`} keinen Preis und ${withoutPrice === 1 ? 'wird' : 'werden'} weggelassen. Trotzdem speichern?`)) return;

  const id = state.editingId;
  if (state.formMode === 'recurring') {
    const { date, items, ...rest } = data;
    const rec = { ...rest, dayOfMonth: Number($('#f-day').value) };
    const saving = id
      ? backend.update('recurring', id, { ...rec, updatedAt: backend.now(), updatedBy: state.me })
      : backend.add('recurring', { ...rec, lastBooked: initialLastBooked(rec.dayOfMonth), createdAt: backend.now(), createdBy: state.me });
    saving.catch(showError);
    $('#expense-dialog').close();
    toast(id ? 'Dauerauftrag geändert ✓' : 'Dauerauftrag angelegt ✓');
    return;
  }

  // Neue Ausgaben bekommen ihre ID gleich hier, damit die Kassenbons wissen, wohin sie gehören.
  const expenseId = id ?? `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const existing = state.expenses.find((e) => e.id === id);
  const keptReceipts = state.receiptsUnknown
    ? (existing?.receipts ?? 0)
    : state.formReceipts.filter((r) => !state.removedReceipts.includes(r.id)).length;
  const receipts = keptReceipts + state.pendingReceipts.length;
  const saving = id
    ? backend.update('expenses', id, { ...data, receipts, updatedAt: backend.now(), updatedBy: state.me })
    : backend.set('expenses', expenseId, { ...data, receipts, createdAt: backend.now(), createdBy: state.me, settlementId: null });
  saving.catch(showError);
  state.pendingReceipts.forEach((img) => backend.add('receiptImages', {
    expenseId, data: img.data, width: img.width, height: img.height, createdBy: state.me, createdAt: backend.now(),
  }).catch(showError));
  state.removedReceipts.forEach((rid) => backend.remove('receiptImages', rid).catch(showError));
  delete state.receiptCache[expenseId];
  state.pendingReceipts = [];
  state.removedReceipts = [];
  // Besorgte Einkäufe als abgerechnet markieren
  state.pendingShopIds.forEach((shopId) => backend.update('shopping', shopId, { expensed: true }).catch(showError));
  state.pendingShopIds = [];
  $('#expense-dialog').close();
  toast(id ? 'Änderung gespeichert ✓' : 'Ausgabe eingetragen ✓');
}

async function deleteExpense() {
  const id = state.editingId;
  if (state.formMode === 'recurring') {
    const rec = state.recurring.find((r) => r.id === id);
    if (!rec) return;
    $('#expense-dialog').close();
    removeWithUndo('Dauerauftrag gelöscht (eingetragene Ausgaben bleiben)', [{ col: 'recurring', doc: rec }]);
    return;
  }
  const expense = state.expenses.find((e) => e.id === id);
  if (!expense) return;
  let receipts = [];
  if (expense.receipts) {
    delete state.receiptCache[id];
    receipts = await loadReceipts(id);
    if (!receipts || receipts.length < expense.receipts) {
      $('#f-error').textContent = 'Die Kassenbon-Fotos konnten gerade nicht geladen werden. Bitte später nochmal löschen, wenn du online bist.';
      return;
    }
  }
  $('#expense-dialog').close();
  removeWithUndo('Ausgabe gelöscht', [
    { col: 'expenses', doc: expense },
    ...receipts.map((doc) => ({ col: 'receiptImages', doc })),
  ]);
  delete state.receiptCache[id];
}

// ---------- 🧾 Kassenbon-Fotos ----------
// Die Fotos werden nur geladen, wenn man eine Ausgabe öffnet – so bleibt der App-Start schnell.

async function loadReceipts(expenseId) {
  if (!state.receiptCache[expenseId]) {
    try {
      const list = await backend.getWhere('receiptImages', 'expenseId', expenseId);
      state.receiptCache[expenseId] = list.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    } catch (err) {
      console.error(err);
      toast('Der Kassenbon konnte nicht geladen werden. Bist du online?', true);
      return null;
    }
  }
  return state.receiptCache[expenseId];
}

function renderReceiptThumbs() {
  const saved = state.formReceipts.filter((r) => !state.removedReceipts.includes(r.id))
    .map((r) => ({ key: r.id, data: r.data, kind: 'saved' }));
  const fresh = state.pendingReceipts.map((r, i) => ({ key: String(i), data: r.data, kind: 'new' }));
  $('#f-receipts').innerHTML = [...saved, ...fresh].map((img) => `
    <span class="note-thumb">
      <button type="button" class="receipt-view" data-action="receipt-view" data-kind="${img.kind}" data-key="${esc(img.key)}" aria-label="Kassenbon groß ansehen"><img src="${esc(img.data)}" alt="Kassenbon"></button>
      <button type="button" class="thumb-remove" data-action="receipt-remove" data-kind="${img.kind}" data-key="${esc(img.key)}" aria-label="Kassenbon entfernen">✕</button>
    </span>`).join('');
}

async function addReceipts(files) {
  const token = state.formToken;
  for (const file of files) {
    if (state.formReceipts.length - state.removedReceipts.length + state.pendingReceipts.length >= 3) {
      toast('Höchstens 3 Fotos pro Ausgabe.', true);
      return;
    }
    try {
      toast('Foto wird vorbereitet …');
      state.receiptBusy += 1;
      const img = await compressImage(file, RECEIPT_OPTIONS).finally(() => { state.receiptBusy -= 1; });
      if (state.formToken !== token || !$('#expense-dialog').open) return; // Formular inzwischen zu
      state.pendingReceipts.push(img);
      renderReceiptThumbs();
      toast('Kassenbon hinzugefügt ✓ Zum Speichern unten auf „Speichern“ tippen.');
    } catch (err) {
      console.error(err);
      toast('Dieses Foto konnte nicht gelesen werden. Versuch es nochmal.', true);
    }
  }
}

function showImageData(data) {
  $('#viewer-img').src = data;
  $('#viewer-scroll').classList.remove('zoomed');
  $('#image-dialog').showModal();
}

function viewFormReceipt(kind, key) {
  const img = kind === 'new' ? state.pendingReceipts[Number(key)] : state.formReceipts.find((r) => r.id === key);
  if (img) showImageData(img.data);
}

function removeFormReceipt(kind, key) {
  if (kind === 'new') state.pendingReceipts.splice(Number(key), 1);
  else state.removedReceipts.push(key);
  renderReceiptThumbs();
}

// Abgerechnete Ausgabe: Kassenbon nur ansehen
async function showExpenseReceipt(expenseId) {
  const list = await loadReceipts(expenseId);
  if (!list) return;
  if (!list.length) toast('Kein Kassenbon gefunden.');
  else if (list.length === 1) showImageData(list[0].data);
  else {
    state.receiptPanel = expenseId;
    openPanel('receipts');
  }
}

// ---------- Ausgleichen ----------

function markPaid(from, to, amountCents) {
  if (!confirm(`Hat ${personName(from)} ${formatEuro(amountCents)} an ${personName(to)} überwiesen?`)) return;
  backend.add('payments', {
    from, to, amountCents,
    date: todayISO(),
    createdAt: backend.now(),
    createdBy: state.me,
    settlementId: null,
  }).catch(showError);
  toast('Als bezahlt abgehakt ✓');
}

function undoPayment(id) {
  const payment = state.payments.find((p) => p.id === id);
  if (payment) removeWithUndo('Überweisung entfernt', [{ col: 'payments', doc: payment }]);
}

function settleAll() {
  const expenses = activeExpenses();
  const payments = activePayments();
  const stillOpen = suggestTransfers(computeBalances(PERSON_IDS, expenses, payments), PERSON_IDS).length > 0;
  const question = stillOpen
    ? 'Achtung: Noch nicht alle Überweisungen sind abgehakt. Wenn ihr jetzt abrechnet, steht trotzdem alles wieder auf 0.\n\nTrotzdem abrechnen?'
    : 'Alles auf 0 setzen und neu starten? Die bisherigen Einträge bleiben unter „Frühere Abrechnungen“ sichtbar.';
  if (!confirm(question)) return;

  backend.settleAll(
    {
      createdAt: backend.now(),
      createdBy: state.me,
      expenseCount: expenses.length,
      totalCents: expenses.reduce((sum, e) => sum + e.amountCents, 0),
    },
    expenses.map((e) => e.id),
    payments.map((p) => p.id),
  ).catch(showError);
  toast('Abgerechnet – alles steht wieder auf 0 ✓');
}

// ---------- Klicks ----------

function onClick(event) {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const { action } = el.dataset;
  switch (action) {
    case 'login': doLogin(); break;
    case 'logout': if (confirm('Abmelden?')) backend.logout(); break;
    case 'push-on': pushOn(); break;
    case 'push-off': pushOff(); break;
    case 'push-test': pushTest(); break;
    case 'claim': claim(el.dataset.person); break;
    case 'tab': switchTab(el.dataset.tab); break;
    case 'fold': toggleFold(el.dataset.fold, el.dataset.default === '1'); renderAll(); break;
    case 'panel-open': openPanel(el.dataset.panel); break;
    case 'quicknote-new': openQuickForm(); break;
    case 'quicknote-edit': openQuickForm(state.quickNotes.find((n) => n.id === el.dataset.id)); break;
    case 'quicknote-delete': deleteQuick(el.dataset.id); break;
    case 'quicknote-delete-form': deleteQuick(state.editingQuick); break;
    case 'rate': rateInvite(el.dataset.id, Number(el.dataset.stars)); break;
    case 'radio-open': openRadio(); break;
    case 'radio-play': playStation(el.dataset.id); break;
    case 'radio-toggle': toggleRadio(); break;
    case 'radio-stop': stopRadio(); break;
    case 'radio-retry': if (currentStation()) { radio.retries = 0; startStream(currentStation()); } break;
    case 'radio-sleep': setRadioSleep(Number(el.dataset.min)); break;
    case 'radio-edit': openRadioEdit(el.dataset.id || null); break;
    case 'radio-playlist': openRadioEdit(null, 'playlist'); break;
    case 'radio-delete': deleteRadioStation(); break;
    case 'receipt-view': viewFormReceipt(el.dataset.kind, el.dataset.key); break;
    case 'receipt-remove': removeFormReceipt(el.dataset.kind, el.dataset.key); break;
    case 'receipt-show': showExpenseReceipt(el.dataset.id); break;
    case 'receipt-panel-view': {
      const r = (state.receiptCache[state.receiptPanel] ?? [])[Number(el.dataset.key)];
      if (r) showImageData(r.data);
      break;
    }
    case 'tips-search-toggle':
      state.tipsSearch = !(state.tipsSearch || state.tipsQuery);
      if (!state.tipsSearch) state.tipsQuery = '';
      else if (isFolded('tips')) toggleFold('tips');
      renderStart();
      if (state.tipsSearch) $('#tips-search')?.focus();
      break;
    case 'add-expense': openExpenseForm(); break;
    case 'edit-expense': openExpenseForm(state.expenses.find((e) => e.id === el.dataset.id)); break;
    case 'close-form': el.closest('dialog').close(); break;
    case 'edit-areas': openAreasForm(); break;
    case 'add-area': addArea(); break;
    case 'remove-area': {
      const row = el.closest('.area-row');
      if (row.nextElementSibling?.classList.contains('icon-picker')) row.nextElementSibling.remove();
      row.remove();
      break;
    }
    case 'area-icon': toggleIconPicker(el.closest('.area-row')); break;
    case 'area-icon-pick': pickAreaIcon(el); break;
    case 'shop-toggle': shopToggle(el.dataset.id); break;
    case 'shop-delete': shopDelete(el.dataset.id); break;
    case 'shop-clear': shopClear(); break;
    case 'trip-start': tripStart(); break;
    case 'trip-end': tripEnd(); break;
    case 'quick-add': quickAdd(el.dataset.id); break;
    case 'chore-done-start': choreDoneThisWeek(el.dataset.id); break;
    case 'absence-new': openAbsenceForm(); break;
    case 'tips-toggle': state.tipsAll = !state.tipsAll; renderStart(); break;
    case 'tips-filter':
      state.tipsQuery = (state.tipsQuery ?? '').toLowerCase() === el.dataset.q ? '' : el.dataset.q;
      $('#tips-search').value = state.tipsQuery;
      updateTipsList();
      break;
    case 'absence-delete': deleteAbsence(el.dataset.id); break;
    case 'absence-edit': openAbsenceForm(state.absences.find((a) => a.id === el.dataset.id)); break;
    case 'absence-delete-form': $('#absence-dialog').close(); deleteAbsence(state.editingAbsence); break;
    case 'poll-new': openPollForm(); break;
    case 'invite-new': openInviteForm(); break;
    case 'invite-template': useInviteTemplate(Number(el.dataset.index)); break;
    case 'invite-answer': answerInvite(el.dataset.id, el.dataset.answer); break;
    case 'invite-delete': deleteInvite(el.dataset.id); break;
    case 'poll-add-option':
      if (document.querySelectorAll('#p-options .poll-input').length < 6) $('#p-options').insertAdjacentHTML('beforeend', pollOptionInput());
      break;
    case 'poll-yesno': $('#p-options').innerHTML = pollOptionInput('Ja') + pollOptionInput('Nein'); break;
    case 'poll-vote': votePoll(el.dataset.id, Number(el.dataset.index)); break;
    case 'poll-close': closePoll(el.dataset.id); break;
    case 'poll-date': openPollDate(el.dataset.id); break;
    case 'poll-date-clear': savePollDate(''); break;
    case 'poll-delete': deletePoll(el.dataset.id); break;
    case 'search-open': openSearch(); break;
    case 'restore-open': $('#restore-file').click(); break;
    case 'shop-to-expense': shopToExpense(); break;
    case 'item-add': addItemRow(); break;
    case 'item-remove': removeItemRow(Number(el.dataset.index)); break;
    case 'add-recurring': openExpenseForm(null, { mode: 'recurring' }); break;
    case 'edit-recurring': openExpenseForm(state.recurring.find((r) => r.id === el.dataset.id), { mode: 'recurring' }); break;
    case 'month': {
      const step = Number(el.dataset.step);
      state.monthOffset = step === 0 ? 0 : Math.min(0, state.monthOffset + step);
      renderPanel();
      break;
    }
    case 'note-new':
      if (noteTemplatesLeft().length) openPanel('note-new');
      else openNoteForm();
      break;
    case 'note-blank': closePanel(); openNoteForm(); break;
    case 'note-sort': setNoteSort(el.dataset.mode); renderInfos(); closePanel(); break;
    case 'note-template': closePanel(); openNoteForm(null, NOTE_TEMPLATES[Number(el.dataset.index)]); break;
    case 'note-edit': openNoteForm(state.notes.find((n) => n.id === el.dataset.id)); break;
    case 'note-delete': deleteNote(); break;
    case 'note-copy': copyNote(el.dataset.id); break;
    case 'note-pin': {
      const note = state.notes.find((n) => n.id === el.dataset.id);
      if (note) backend.update('notes', note.id, { pinned: !note.pinned }).catch(showError);
      break;
    }
    case 'shoporder-open': renderShopOrder(shopCategories()); $('#shoporder-dialog').showModal(); break;
    case 'shoporder-move': moveShopCategory(el); break;
    case 'shoporder-reset': renderShopOrder(SHOP_CATEGORIES); break;
    case 'image-open': openImage(el.dataset.id); break;
    case 'image-zoom': $('#viewer-scroll').classList.toggle('zoomed'); break;
    case 'note-image-remove':
      if (el.dataset.kind === 'new') state.pendingImages.splice(Number(el.dataset.key), 1);
      else state.removedImages.push(el.dataset.key);
      renderNoteFormImages();
      break;
    case 'export-json': exportJson(); break;
    case 'export-csv': exportCsv(); break;
    case 'shop-category': openShopCategory(el.dataset.id); break;
    case 'shop-setcat': setShopCategory(el.dataset.cat); break;
    case 'quick-remove': quickRemove(el.dataset.id); break;
    case 'calendar-settings': openCalendarForm(); break;
    case 'calendar-reload': loadEvents(); break;
    case 'event-open': openEvent(el.dataset.id); break;
    case 'event-new': openEventForm(); break;
    case 'event-edit': openEventForm(state.calendar.events?.find((x) => x.id === el.dataset.id)); break;
    case 'event-delete': deleteEvent(el.dataset.id); break;
    case 'koelsch': openKoelsch(); break;
    case 'calendar-remove': removeCalendar(); break;
    case 'quick-edit': state.quickEdit = !state.quickEdit; renderEinkauf(); break;
    case 'delete-expense': deleteExpense(); break;
    case 'mark-paid': markPaid(el.dataset.from, el.dataset.to, Number(el.dataset.amount)); break;
    case 'undo-payment': undoPayment(el.dataset.id); break;
    case 'settle-all': settleAll(); break;
    case 'chore-done': choreDone(el.dataset.id); break;
    case 'chore-undo': choreUndo(el.dataset.id); break;
    case 'chore-take': choreTake(el.dataset.id); break;
    case 'chore-giveback': choreGiveBack(el.dataset.id); break;
    case 'week': {
      const step = Number(el.dataset.step);
      state.choreWeekOffset = step === 0 ? 0 : state.choreWeekOffset + step;
      renderPutzplan();
      break;
    }
    default: break;
  }
}

document.addEventListener('click', onClick);
document.addEventListener('change', (event) => {
  if (event.target.dataset.pushType) setPushType(event.target.dataset.pushType, event.target.checked);
});
document.addEventListener('touchstart', onTouchStart, { passive: true });
document.addEventListener('touchstart', noteTouchStart, { passive: true });
document.addEventListener('touchmove', noteTouchMove, { passive: false });
document.addEventListener('touchend', noteTouchEnd, { passive: true });
document.addEventListener('touchcancel', noteTouchEnd, { passive: true });
// Notiztext: Enter in einer Aufzählung setzt den nächsten Punkt
$('#n-text').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  const box = event.target;
  if (box.selectionStart !== box.selectionEnd) return;
  const change = continueList(box.value, box.selectionStart);
  if (!change) return;
  event.preventDefault();
  box.setRangeText(change.insert, change.from, change.to, 'end');
});
document.addEventListener('touchmove', onTouchMove, { passive: true });
document.addEventListener('touchend', onTouchEnd, { passive: true });
document.addEventListener('touchcancel', onTouchEnd, { passive: true });
$('#expense-form').addEventListener('submit', onSubmitExpense);
$('#expense-form').addEventListener('input', (event) => {
  if (event.target.name === 'splitMode') return; // wird bei "change" erledigt
  const { item, field } = event.target.dataset;
  if (item != null && field) state.items[Number(item)][field] = event.target.value;
  $('#f-error').textContent = '';
  updateSplitHint();
});
$('#expense-form').addEventListener('change', (event) => {
  const { item, person } = event.target.dataset;
  if (item != null && person) {
    const list = state.items[Number(item)].for;
    if (event.target.checked) { if (!list.includes(person)) list.push(person); } else list.splice(list.indexOf(person), 1);
  }
  if (event.target.name === 'splitMode') setSplitMode(event.target.value === 'items');
  else updateSplitHint();
});
$('#areas-form').addEventListener('submit', onSubmitAreas);
$('#shoporder-form').addEventListener('submit', onSubmitShopOrder);
// Beim Tippen des Namens das passende Symbol vorschlagen (solange keins ausgewählt wurde)
$('#areas-list').addEventListener('input', (event) => {
  if (!event.target.classList.contains('area-name')) return;
  const row = event.target.closest('.area-row');
  if (row.dataset.autoIcon === 'true') setAreaIcon(row, guessAreaIcon(event.target.value));
});
$('#calendar-form').addEventListener('submit', onSubmitCalendar);
$('#note-form').addEventListener('submit', onSubmitNote);
$('#n-file').addEventListener('change', (event) => {
  const files = [...event.target.files];
  event.target.value = '';
  addNoteImages(files);
});
$('#absence-form').addEventListener('submit', onSubmitAbsence);
$('#newevent-form').addEventListener('submit', onSubmitEvent);
$('#quick-form').addEventListener('submit', onSubmitQuick);
$('#radio-edit-form').addEventListener('submit', onSubmitRadioEdit);
$('#poll-date-form').addEventListener('submit', (e) => { e.preventDefault(); savePollDate($('#pd-date').value); });
$('#f-receipt-file').addEventListener('change', (e) => {
  addReceipts([...e.target.files]);
  e.target.value = '';
});
{
  const audio = $('#radio-audio');
  audio.addEventListener('playing', () => {
    if (!radio.id) return;
    clearTimeout(radio.timer);
    radio.status = 'playing';
    radio.retries = 0;
    radio.waitingForNet = false;
    renderRadio();
  });
  // Stockt der Stream länger als 15 s, wird neu verbunden
  audio.addEventListener('waiting', () => {
    if (!radio.id || radio.status !== 'playing') return;
    radio.status = 'loading';
    clearTimeout(radio.timer);
    const id = radio.id;
    radio.timer = setTimeout(() => { if (radio.id === id && radio.status === 'loading') radioLost(); }, 15000);
    renderRadio();
  });
  // Pause von außen (Sperrbildschirm, Kopfhörer raus, Anruf) – aber nicht beim Senderwechsel
  audio.addEventListener('pause', () => {
    if (radio.id && radio.status === 'playing') { radio.status = 'paused'; renderRadio(); }
  });
  audio.addEventListener('ended', () => radioLost()); // Live-Stream zu Ende = Verbindung weg
  audio.addEventListener('error', () => { if (audio.getAttribute('src')) radioLost(); });
  window.addEventListener('online', () => {
    if (radio.id && radio.waitingForNet) {
      radio.waitingForNet = false;
      radio.retries = 0;
      startStream(currentStation());
    }
  });
  // Restzeit des Schlaf-Timers; schaltet auch aus, falls das Handy den Timer verschlafen hat
  setInterval(() => {
    if (!radio.sleepAt) return;
    if (Date.now() >= radio.sleepAt) { stopRadio(); toast('Gute Nacht 🌙 Das Radio ist aus.'); } else renderRadio();
  }, 30000);
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => toggleRadio());
      navigator.mediaSession.setActionHandler('pause', () => pauseRadio());
      navigator.mediaSession.setActionHandler('stop', () => stopRadio());
    } catch { /* ältere Browser */ }
  }
}
$('#e-allday').addEventListener('change', updateEventFormMode);
// Datum geändert -> Bis-Datum mitziehen, Von-Uhrzeit geändert -> Bis eine Stunde später
$('#e-date').addEventListener('change', () => {
  if (!$('#e-date-to').value || $('#e-date-to').value < $('#e-date').value) $('#e-date-to').value = $('#e-date').value;
});
$('#e-from').addEventListener('change', () => {
  const [h, m] = $('#e-from').value.split(':').map(Number);
  if (Number.isFinite(h)) $('#e-to').value = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});
$('#poll-form').addEventListener('submit', onSubmitPoll);
$('#invite-form').addEventListener('submit', onSubmitInvite);
$('#invite-form').addEventListener('change', (event) => {
  if (event.target.name === 'iWhen') $('#i-time').hidden = event.target.value === 'now';
});
// Eigener Text statt Vorlage -> normale Aktion (außer der Text klingt nach Kochen)
// Das Symbol passt sich beim Tippen an – außer man hat selbst eins eingetragen.
// Abstimmung: Datum aus der Frage erkennen, solange man es nicht selbst gewählt hat
$('#p-question').addEventListener('input', () => {
  if (!state.pollDateChosen) $('#p-date').value = guessDateFromText($('#p-question').value) ?? '';
});
$('#p-date').addEventListener('input', () => { state.pollDateChosen = $('#p-date').value !== ''; });
$('#i-title').addEventListener('input', () => {
  state.inviteKind = 'other';
  if (!state.inviteEmojiChosen) $('#i-emoji').value = guessInviteEmoji($('#i-title').value) ?? '🙋';
});
// Feld geleert -> wieder automatisch
$('#i-emoji').addEventListener('input', () => { state.inviteEmojiChosen = $('#i-emoji').value.trim() !== ''; });
// Abgelaufene Aktionen verschwinden auch ohne neue Daten
setInterval(() => { if (state.me) renderStart(); }, 60000);
$('#search-input').addEventListener('input', renderSearch);
// Wochentipps durchsuchen (Feld liegt auf der Startseite, darum über document)
document.addEventListener('input', (event) => {
  if (event.target.id !== 'tips-search') return;
  state.tipsQuery = event.target.value;
  updateTipsList();
});
$('#restore-file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (file) restoreBackup(file);
});
$('#toast-undo').addEventListener('click', () => {
  const undo = toastUndo;
  $('#toast').className = 'toast';
  toastUndo = null;
  undo?.();
});
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();
// Termine regelmäßig und beim Zurückkehren zur App neu laden.
setInterval(() => loadEvents(), 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - state.calendar.loadedAt > 60000) loadEvents();
});
$('#shop-form').addEventListener('submit', onSubmitShopping);
// Tippen neben ein Formular schließt es.
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
}));
$('#panel-dialog').addEventListener('close', () => { state.panel = null; });

start();
