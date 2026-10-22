// ---------- Keyboard ----------
// The keyboard is always 14 white keys wide (two octaves). It starts on F, but if a chord would not
// fit in root position (a 9th chord on a high root, for example) the window slides up by whole
// white keys until it does. So the root is always the lowest note shown.
const WHITE_CYCLE = [0, 2, 4, 5, 7, 9, 11];   // C D E F G A B
const WHITE_COUNT = 14;
const WHITE_W = 40, WHITE_H = 170, BLACK_W = 24, BLACK_H = 106;
const DEFAULT_START = 3;                      // index of F in WHITE_CYCLE

// White keys of a window, each with its semitone distance from the first key.
function whiteKeys(startCycleIdx) {
  const whites = [];
  let off = 0, prev = null;
  for (let i = 0; i < WHITE_COUNT; i++) {
    const pc = WHITE_CYCLE[(startCycleIdx + i) % 7];
    if (prev !== null) off += (pc - prev + 12) % 12;
    whites.push({ pc, off });
    prev = pc;
  }
  return whites;
}

// Pick the first window (F, then G, A, ...) where the whole chord fits, root lowest.
function chooseWindow(root, notes) {
  const top = Math.max(...notes.map((n) => n.semis));
  for (let s = 0; s < 7; s++) {
    const whites = whiteKeys((DEFAULT_START + s) % 7);
    const rootOff = (root.pc - whites[0].pc + 12) % 12;
    if (rootOff + top <= whites[WHITE_COUNT - 1].off) return { whites, rootOff };
  }
}

function drawPiano(root, notes) {
  const { whites, rootOff } = chooseWindow(root, notes);
  const lit = new Map(notes.map((n) => [rootOff + n.semis, n]));
  const svgNS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, cls) => {
    const e = document.createElementNS(svgNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    return e;
  };
  const svg = el("svg", { viewBox: `0 0 ${WHITE_COUNT * WHITE_W} ${WHITE_H + 8}` });
  const state = (n) => (n ? " on" + (n.isRoot ? " root" : "") : "");

  whites.forEach((w, i) => {
    svg.appendChild(el("rect", { x: i * WHITE_W, y: 2, width: WHITE_W, height: WHITE_H }, "white" + state(lit.get(w.off))));
  });
  for (let i = 0; i < WHITE_COUNT - 1; i++) {
    if (whites[i + 1].off - whites[i].off !== 2) continue;         // no black key between E-F or B-C
    const n = lit.get(whites[i].off + 1);
    const x = (i + 1) * WHITE_W - BLACK_W / 2;
    svg.appendChild(el("rect", { x, y: 2, width: BLACK_W, height: BLACK_H }, "black" + state(n)));
    if (n) {
      const cx = x + BLACK_W / 2;
      const label = el("text", { x: cx, y: 64 }, "label black-label" + (n.isRoot ? " root" : ""));
      label.textContent = n.name;
      svg.appendChild(label);
      svg.appendChild(el("circle", { cx, cy: BLACK_H - 20, r: 7 }, "dot" + (n.isRoot ? " root" : "")));
    }
  }
  whites.forEach((w, i) => {
    const n = lit.get(w.off);
    if (!n) return;
    const cx = i * WHITE_W + WHITE_W / 2;
    svg.appendChild(el("circle", { cx, cy: WHITE_H - 38, r: 9 }, "dot" + (n.isRoot ? " root" : "")));
    const label = el("text", { x: cx, y: WHITE_H - 10 }, "label");
    label.textContent = n.name;
    svg.appendChild(label);
  });
  const piano = document.getElementById("piano");
  piano.innerHTML = "";
  piano.appendChild(svg);
}

// ---------- Settings ----------
const STORAGE_KEY = "chordencyclopedia.settings";
const settings = { dark: false, beginner: false, avoidDouble: false, avoidOdd: true, accidentals: "mix" };
try { Object.assign(settings, JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")); } catch (e) {}
const saveSettings = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) {} };

let rootIndex = 0;           // C
let qualityKey = "min";      // start on C minor

// "mix" is Auto: D♭ E♭ F♯ A♭ B♭. "sharp" and "flat" force one kind of accidental.
const rootName = (root) => root[settings.accidentals];
const rootLabel = (root) => fmt(rootName(root));
const availableQualities = () =>
  settings.beginner ? QUALITIES.filter((q) => q.beginner).sort((a, b) => a.beginner - b.beginner) : QUALITIES;
const currentQuality = () => QUALITIES.find((q) => q.key === qualityKey);

// ---------- Rendering ----------
function render() {
  const root = ROOTS[rootIndex], quality = currentQuality(), name = rootName(root);
  // Beginner mode always uses the simplest spellings.
  const notes = buildChord(name, quality, {
    avoidDouble: settings.beginner || settings.avoidDouble,
    avoidOdd: settings.beginner || settings.avoidOdd,
  });
  drawPiano(root, notes);

  document.getElementById("chordTitle").textContent = chordTitle(name, quality);   // read by screen readers only
  document.getElementById("chordFull").textContent = chordFullName(name, quality);
  const cell = (n, text) => `<td${n.isRoot ? ' class="root"' : ""}><span>${text}</span></td>`;
  document.getElementById("noteTable").innerHTML =
    "<tr>" + notes.map((n) => cell(n, n.name)).join("") + "</tr>" +
    (settings.beginner ? "" : "<tr>" + notes.map((n) => cell(n, n.degree)).join("") + "</tr>");
  const aliases = settings.beginner ? [] : chordAliases(name, quality);
  document.getElementById("aliases").textContent = aliases.length ? "Also written as: " + aliases.join(" · ") : "";
}

// ---------- Curved wheel ----------
// An endless wheel. The selected row sits at the bottom, where the two wheels meet, with two earlier
// rows above it. The rows follow a big curve, so the rows above are pushed away from the middle and
// each panel's top corner is rounded to match (the left wheel like ╮, the right wheel like ╭).
// Drag, scroll or use the arrow keys to spin; the round button opens a full list.
function createWheel(container, side, getLabel, getSublabel, onChange) {
  const ROW = 48;
  const CY = 120;          // y of the selected row's centre
  const VR = 120;          // vertical radius of the curve (selected row up to the top of the panel)
  const el = document.createElement("div");
  el.className = "cwheel " + side;
  el.tabIndex = 0;
  el.setAttribute("role", "slider");
  el.setAttribute("aria-label", container.getAttribute("aria-label") || "Wheel");
  container.appendChild(el);

  let options = [], items = [], pos = 0, lastIndex = 0, anim = 0, dropdown = null, openedAt = 0, hr = 150;
  const len = () => options.length;
  const mod = (x, n) => ((x % n) + n) % n;
  const shortest = (d) => { d = mod(d, len()); return d > len() / 2 ? d - len() : d; };

  // The curve is an ellipse HR wide and VR tall. Rows are indented by how far the curve has moved in.
  function shape() {
    const w = el.clientWidth;
    if (!w) return;
    hr = Math.max(60, Math.min(150, w - 22));
    el.style.borderRadius = side === "left"
      ? `14px ${hr}px 14px 14px / 14px ${VR}px 14px 14px`
      : `${hr}px 14px 14px 14px / ${VR}px 14px 14px 14px`;
  }

  function update() {
    const sel = mod(Math.round(pos), len());
    items.forEach((it, k) => {
      const d = shortest(k - pos), ad = Math.abs(d), dy = d * ROW;
      const off = hr * (1 - Math.sqrt(Math.max(0, 1 - (dy * dy) / (VR * VR))));
      const o = d > 0 ? Math.max(0, 1 - d * 2) : ad <= 1 ? 1 - 0.4 * ad : Math.max(0, 0.6 - 0.3 * (ad - 1));
      it.style.transform = `translate(${side === "left" ? -off : off}px, ${CY + dy}px) translateY(-50%)`;
      it.style.opacity = o;
      it.style.visibility = o <= 0 ? "hidden" : "visible";
      it.classList.toggle("selected", k === sel);
    });
    el.setAttribute("aria-valuetext", options[sel] ? String(getLabel(options[sel])) : "");
  }
  new ResizeObserver(() => { shape(); update(); }).observe(el);

  // The selection follows the wheel live, so the chord updates while you spin.
  function setPos(p) {
    pos = p;
    update();
    const idx = mod(Math.round(pos), len());
    if (idx !== lastIndex) { lastIndex = idx; onChange(options[idx]); }
  }

  function animateTo(target, dur = 220) {
    cancelAnimationFrame(anim);
    const from = pos, t0 = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      setPos(from + (target - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) anim = requestAnimationFrame(frame);
    };
    anim = requestAnimationFrame(frame);
  }
  const goTo = (i) => animateTo(pos + shortest(i - pos));

  // ----- the full list (round button), with the spelled-out names -----
  const closeDropdown = () => { if (dropdown) { dropdown.remove(); dropdown = null; } };
  const openDropdown = () => {
    closeDropdown();
    openedAt = performance.now();
    dropdown = document.createElement("div");
    dropdown.className = "dropdown";
    options.forEach((opt, i) => {
      const b = document.createElement("button");
      const sub = getSublabel(opt);
      b.innerHTML = `<span>${getLabel(opt)}</span>` + (sub ? `<small>${sub}</small>` : "");
      if (i === lastIndex) b.classList.add("selected");
      // A quick tap on a phone is followed by a late "click" at the same spot, which would land on
      // the row that just appeared under the finger. Ignore clicks right after opening.
      b.onclick = () => { if (performance.now() - openedAt < 400) return; goTo(i); closeDropdown(); };
      dropdown.appendChild(b);
    });
    container.appendChild(dropdown);
    const selEl = dropdown.querySelector(".selected");
    if (selEl) selEl.scrollIntoView({ block: "center" });
  };
  document.addEventListener("click", (e) => { if (dropdown && !container.contains(e.target)) closeDropdown(); });

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "wheel-btn";
  btn.setAttribute("aria-label", "Show all choices");
  btn.title = "Show all";
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  btn.addEventListener("click", openDropdown);
  container.appendChild(btn);

  // ----- dragging: vertical, one row per ROW pixels -----
  let drag = null;
  el.addEventListener("pointerdown", (e) => {
    cancelAnimationFrame(anim);
    el.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, last: e.clientY, moved: false, samples: [] };
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
    if (!drag.moved) return;
    setPos(pos - (e.clientY - drag.last) / ROW);
    drag.last = e.clientY;
    drag.samples.push({ t: performance.now(), p: pos });
    if (drag.samples.length > 6) drag.samples.shift();
  });
  const release = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) {          // a tap on a row above the selected one steps to it
      const row = Math.round((d.y - el.getBoundingClientRect().top - CY) / ROW);
      if (row < 0) animateTo(Math.round(pos) + Math.max(-2, row));
      return;
    }
    const s = d.samples, first = s[0], last = s[s.length - 1];
    const v = first && last && last.t > first.t ? (last.p - first.p) / (last.t - first.t) : 0;   // rows per ms
    animateTo(Math.round(pos + Math.max(-4, Math.min(4, v * 160))), 260);
  };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("wheel", (e) => { e.preventDefault(); animateTo(Math.round(pos) + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
  el.addEventListener("keydown", (e) => {
    const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
    if (step) { e.preventDefault(); animateTo(Math.round(pos) + step); }
  });

  // Replace the wheel's contents (used when settings change labels or the option list). Does not fire onChange.
  return {
    setOptions(newOptions, newIndex) {
      cancelAnimationFrame(anim);
      closeDropdown();
      options = newOptions; pos = lastIndex = newIndex;
      items.forEach((it) => it.remove());
      items = options.map((opt) => {
        const it = document.createElement("div");
        it.className = "citem";
        it.textContent = getLabel(opt);
        el.appendChild(it);
        return it;
      });
      shape();
      update();
    },
  };
}

// ---------- Wheels ----------
const $ = (id) => document.getElementById(id);
const rootWheel = createWheel($("rootPicker"), "left", rootLabel, () => "",
  (r) => { rootIndex = ROOTS.indexOf(r); render(); });
const qualityWheel = createWheel($("qualityPicker"), "right", (q) => q.abbr, (q) => q.full,
  (q) => { qualityKey = q.key; render(); });

function refreshWheels() {
  rootWheel.setOptions(ROOTS, rootIndex);
  const list = availableQualities();
  if (!list.some((q) => q.key === qualityKey)) qualityKey = "maj";   // e.g. Beginner mode hides this chord
  qualityWheel.setOptions(list, list.findIndex((q) => q.key === qualityKey));
}

// ---------- Sound ----------
// A simple piano-like tone made in the browser (no audio files): a few harmonics with a quick
// attack and a slow decay, higher notes dying away faster.
const HARMONICS = [0, 1, 0.5, 0.3, 0.18, 0.1, 0.06];
const HARMONIC_SUM = HARMONICS.reduce((s, h) => s + h, 0);
const ARPEGGIO_STEP = 0.2;           // seconds between notes of an arpeggio
let audio = null;

// Schedules the notes on any audio context (a live one, or an offline one for tests).
function renderChord(ctx, dest, midiNotes, arpeggio, t0) {
  const wave = ctx.createPeriodicWave(new Float32Array(HARMONICS.length), Float32Array.from(HARMONICS));
  const master = ctx.createGain();
  master.gain.value = 0.8 / (HARMONIC_SUM * Math.sqrt(midiNotes.length));
  master.connect(dest);
  midiNotes.forEach((m, i) => {
    const freq = 440 * Math.pow(2, (m - 69) / 12);
    const t = t0 + (arpeggio ? i * ARPEGGIO_STEP : 0);
    const decay = Math.max(0.9, Math.min(3, 2.8 * Math.pow(261.6 / freq, 0.45)));
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(wave);
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + decay + 0.05);
  });
  return master;
}

// The lowest note is never below G3, so chords always sit around middle C (G3 up to F#4 for the root).
function chordMidiNotes(root, quality) {
  const base = 55 + ((root.pc - 7 + 12) % 12);
  return quality.tones.map(([semis]) => base + semis);
}

function playChord(arpeggio) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audio) {
    const ctx = new Ctx();
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    audio = { ctx, comp, master: null };
  }
  const { ctx, comp } = audio;
  if (ctx.state === "suspended") ctx.resume();
  if (audio.master) audio.master.gain.setTargetAtTime(0, ctx.currentTime, 0.04);   // fade out what is still ringing
  audio.master = renderChord(ctx, comp, chordMidiNotes(ROOTS[rootIndex], currentQuality()), arpeggio, ctx.currentTime + 0.05);
}
$("playBtn").addEventListener("click", () => playChord(false));
$("arpBtn").addEventListener("click", () => playChord(true));

// ---------- Menu & toggles ----------
const menu = $("menu"), scrim = $("scrim"), menuBtn = $("menuBtn");

function openMenu() { menu.hidden = scrim.hidden = false; menuBtn.setAttribute("aria-expanded", "true"); $("menuClose").focus(); }
function closeMenu() { menu.hidden = scrim.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); menuBtn.focus(); }
menuBtn.addEventListener("click", openMenu);
$("menuClose").addEventListener("click", closeMenu);
scrim.addEventListener("click", closeMenu);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) closeMenu(); });

// One button that cycles Auto -> sharps -> flats and shows the current choice.
const ACCIDENTAL_MODES = [
  { mode: "mix",   symbol: "♯♭", name: "Auto" },
  { mode: "sharp", symbol: "♯",  name: "Sharps" },
  { mode: "flat",  symbol: "♭",  name: "Flats" },
];

function applySettings() {
  document.documentElement.dataset.theme = settings.dark ? "dark" : "light";
  $("themeBtn").setAttribute("aria-label", settings.dark ? "Switch to light mode" : "Switch to dark mode");
  $("themeBtn").title = settings.dark ? "Light mode" : "Dark mode";
  $("optBeginner").checked = settings.beginner;
  // Beginner mode always uses the simplest spellings, so those switches show on and are locked.
  $("optAvoid").checked = settings.beginner || settings.avoidDouble;
  $("optOdd").checked = settings.beginner || settings.avoidOdd;
  $("optAvoid").disabled = $("optOdd").disabled = settings.beginner;
  $("rowAvoid").classList.toggle("disabled", settings.beginner);
  $("rowOdd").classList.toggle("disabled", settings.beginner);
  const acc = ACCIDENTAL_MODES.find((m) => m.mode === settings.accidentals) || ACCIDENTAL_MODES[0];
  $("accBtn").textContent = acc.symbol;
  $("accBtn").setAttribute("aria-label", `Sharps and flats: ${acc.name}. Tap to change.`);
  $("accBtn").title = `Sharps and flats: ${acc.name}`;
  refreshWheels();
  render();
}

const bind = (id, key) => $(id).addEventListener("change", (e) => { settings[key] = e.target.checked; saveSettings(); applySettings(); });
bind("optBeginner", "beginner"); bind("optAvoid", "avoidDouble"); bind("optOdd", "avoidOdd");
$("themeBtn").addEventListener("click", () => { settings.dark = !settings.dark; saveSettings(); applySettings(); });
$("accBtn").addEventListener("click", () => {
  const i = ACCIDENTAL_MODES.findIndex((m) => m.mode === settings.accidentals);
  settings.accidentals = ACCIDENTAL_MODES[(i + 1) % ACCIDENTAL_MODES.length].mode;
  saveSettings(); applySettings();
});

applySettings();
