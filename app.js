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
    if (n) svg.appendChild(el("circle", { cx: x + BLACK_W / 2, cy: BLACK_H - 20, r: 7 }, "dot" + (n.isRoot ? " root" : "")));
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
const settings = { dark: false, beginner: false, avoidDouble: false, avoidOdd: true, bottom: false, accidentals: "mix" };
try { Object.assign(settings, JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")); } catch (e) {}
const saveSettings = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) {} };

let rootIndex = 0;           // C
let qualityKey = "min";      // start on C minor

const rootName = (root) => root[settings.accidentals];
const rootLabel = (root) =>
  settings.accidentals === "mix" && root.sharp !== root.flat ? fmt(root.sharp) + "/" + fmt(root.flat) : fmt(rootName(root));
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

  document.getElementById("chordTitle").textContent = chordTitle(name, quality);
  document.getElementById("chordFull").textContent = chordFullName(name, quality);
  const cell = (n, text) => `<td${n.isRoot ? ' class="root"' : ""}><span>${text}</span></td>`;
  document.getElementById("noteTable").innerHTML =
    "<tr>" + notes.map((n) => cell(n, n.name)).join("") + "</tr>" +
    (settings.beginner ? "" : "<tr>" + notes.map((n) => cell(n, n.degree)).join("") + "</tr>");
  const aliases = settings.beginner ? [] : chordAliases(name, quality);
  document.getElementById("aliases").textContent = aliases.length ? "Also written as: " + aliases.join(" · ") : "";
}

// ---------- Curved wheel ----------
// An endless wheel. The rows are laid out along a big circle, so the selected row sits nearest the
// middle of the screen and the other rows are indented away from it.
//   normal layout:  previous / selected / next, selected row in the middle (a bulge, like  ) ( )
//   bottom layout:  two earlier rows above the selected row at the bottom (a quarter circle, like  ╮╭ )
// Drag, scroll or use the arrow keys to spin; tap the selected row or the round button for a full list.
function createWheel(container, side, getLabel, getSublabel, onChange) {
  const ROW = 48;
  const MIDDLE = { cy: 72, arc: 86 };    // y of the selected row's centre, radius of the circle the rows follow
  const BOTTOM = { cy: 120, arc: 120 };
  const geom = () => (settings.bottom ? BOTTOM : MIDDLE);
  const el = document.createElement("div");
  el.className = "cwheel " + side;
  el.tabIndex = 0;
  el.setAttribute("role", "slider");
  el.setAttribute("aria-label", container.getAttribute("aria-label") || "Wheel");
  container.appendChild(el);

  let options = [], items = [], pos = 0, lastIndex = 0, anim = 0, dropdown = null, openedAt = 0;
  const len = () => options.length;
  const mod = (x, n) => ((x % n) + n) % n;
  const shortest = (d) => { d = mod(d, len()); return d > len() / 2 ? d - len() : d; };

  function update() {
    const g = geom(), sel = mod(Math.round(pos), len());
    items.forEach((it, k) => {
      const d = shortest(k - pos), ad = Math.abs(d), dy = d * ROW;
      const off = g.arc - Math.sqrt(Math.max(0, g.arc * g.arc - dy * dy));     // how far this row curves away
      let o;
      if (settings.bottom) o = d > 0 ? Math.max(0, 1 - d * 2) : ad <= 1 ? 1 - 0.4 * ad : Math.max(0, 0.6 - 0.3 * (ad - 1));
      else o = ad <= 1 ? 1 - 0.45 * ad : Math.max(0, 0.55 * (1 - (ad - 1) / 0.7));
      it.style.transform = `translate(${side === "left" ? -off : off}px, ${g.cy + dy}px) translateY(-50%)`;
      it.style.opacity = o;
      it.style.visibility = o <= 0 ? "hidden" : "visible";
      it.classList.toggle("selected", k === sel);
    });
    el.setAttribute("aria-valuetext", options[sel] ? String(getLabel(options[sel])) : "");
  }

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

  // ----- the full list, with the spelled-out names -----
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

  // A small round button on the outer side of the wheel opens the same list.
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
    if (!d.moved) {          // a tap: the selected row opens the list, a row above or below steps to it
      const row = Math.round((d.y - el.getBoundingClientRect().top - geom().cy) / ROW);
      if (row === 0) openDropdown();
      else animateTo(Math.round(pos) + Math.max(settings.bottom ? -2 : -1, Math.min(settings.bottom ? 0 : 1, row)));
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
      update();
    },
    update,
  };
}

// ---------- Wheels ----------
const $ = (id) => document.getElementById(id);
const rootWheel = createWheel($("rootPicker"), "left", rootLabel, () => "",
  (r) => { rootIndex = ROOTS.indexOf(r); render(); });
const qualityWheel = createWheel($("qualityPicker"), "right", (q) => q.abbr, (q) => q.full,
  (q) => { qualityKey = q.key; render(); });

// The highlight box is a fixed size: wide enough for the longest note plus the longest chord type.
const hl = document.querySelector(".hl");
let maxWidths = null;
function measure(labels) {
  const probe = document.createElement("span");
  probe.className = "citem selected";
  probe.style.cssText = "visibility:hidden;left:0;right:auto";
  document.body.appendChild(probe);
  const widest = Math.max(...labels.map((l) => { probe.textContent = l; return probe.getBoundingClientRect().width; }));
  probe.remove();
  return widest;
}
function updateHighlight() {
  if (!maxWidths) maxWidths = {
    note: measure(ROOTS.map((r) => fmt(r.sharp) + "/" + fmt(r.flat))),
    quality: measure(QUALITIES.map((q) => q.abbr)),
  };
  const TEXT_PAD = 12, PAD = 10;      // text inset inside each wheel, extra room inside the box
  const base = $("pickers").getBoundingClientRect(), a = $("rootPicker").getBoundingClientRect(), b = $("qualityPicker").getBoundingClientRect();
  const left = a.right - TEXT_PAD - maxWidths.note - PAD, right = b.left + TEXT_PAD + maxWidths.quality + PAD;
  hl.style.left = left - base.left + "px";
  hl.style.width = right - left + "px";
}
new ResizeObserver(updateHighlight).observe($("pickers"));
if (document.fonts) document.fonts.ready.then(() => { maxWidths = null; updateHighlight(); });

function refreshWheels() {
  rootWheel.setOptions(ROOTS, rootIndex);
  const list = availableQualities();
  if (!list.some((q) => q.key === qualityKey)) qualityKey = "maj";   // e.g. Beginner mode hides this chord
  qualityWheel.setOptions(list, list.findIndex((q) => q.key === qualityKey));
  updateHighlight();
}

// ---------- Menu & toggles ----------
const menu = $("menu"), scrim = $("scrim"), menuBtn = $("menuBtn");

function openMenu() { menu.hidden = scrim.hidden = false; menuBtn.setAttribute("aria-expanded", "true"); $("menuClose").focus(); }
function closeMenu() { menu.hidden = scrim.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); menuBtn.focus(); }
menuBtn.addEventListener("click", openMenu);
$("menuClose").addEventListener("click", closeMenu);
scrim.addEventListener("click", closeMenu);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) closeMenu(); });

function applySettings() {
  document.documentElement.dataset.theme = settings.dark ? "dark" : "light";
  document.documentElement.dataset.layout = settings.bottom ? "bottom" : "middle";
  maxWidths = null;                       // the selected text size depends on the layout
  $("optBottom").checked = settings.bottom;
  $("themeBtn").setAttribute("aria-label", settings.dark ? "Switch to light mode" : "Switch to dark mode");
  $("themeBtn").title = settings.dark ? "Light mode" : "Dark mode";
  $("optBeginner").checked = settings.beginner;
  // Beginner mode always uses the simplest spellings, so those switches show on and are locked.
  $("optAvoid").checked = settings.beginner || settings.avoidDouble;
  $("optOdd").checked = settings.beginner || settings.avoidOdd;
  $("optAvoid").disabled = $("optOdd").disabled = settings.beginner;
  $("rowAvoid").classList.toggle("disabled", settings.beginner);
  $("rowOdd").classList.toggle("disabled", settings.beginner);
  document.querySelectorAll("#accidentals button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.mode === settings.accidentals)));
  refreshWheels();
  render();
}

const bind = (id, key) => $(id).addEventListener("change", (e) => { settings[key] = e.target.checked; saveSettings(); applySettings(); });
bind("optBeginner", "beginner"); bind("optAvoid", "avoidDouble");
bind("optOdd", "avoidOdd"); bind("optBottom", "bottom");
$("themeBtn").addEventListener("click", () => { settings.dark = !settings.dark; saveSettings(); applySettings(); });
document.querySelectorAll("#accidentals button").forEach((b) =>
  b.addEventListener("click", () => { settings.accidentals = b.dataset.mode; saveSettings(); applySettings(); }));

applySettings();
