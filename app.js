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
const settings = { dark: false, beginner: false, avoidDouble: false, avoidOdd: true, ipod: false, accidentals: "mix" };
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

// ---------- List wheel ----------
// Combination-lock style wheel. Scroll to pick; tap the selected item to open a dropdown.
function createWheel(container, getLabel, getSublabel, onChange) {
  const ITEM_H = 48;
  const wheel = document.createElement("div");
  wheel.className = "wheel";
  container.appendChild(wheel);

  let options = [], items = [], index = 0, timer = null, dropdown = null;
  const mark = () => items.forEach((el, j) => el.classList.toggle("selected", j === index));
  const select = (i, scroll) => {
    index = i; mark();
    if (scroll) wheel.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
    onChange(options[i]);
  };
  const closeDropdown = () => { if (dropdown) { dropdown.remove(); dropdown = null; } };
  const openDropdown = () => {
    closeDropdown();
    dropdown = document.createElement("div");
    dropdown.className = "dropdown";
    options.forEach((opt, i) => {
      const b = document.createElement("button");
      const sub = getSublabel(opt);
      b.innerHTML = `<span>${getLabel(opt)}</span>` + (sub ? `<small>${sub}</small>` : "");
      if (i === index) b.classList.add("selected");
      b.onclick = () => { select(i, true); closeDropdown(); };
      dropdown.appendChild(b);
    });
    container.appendChild(dropdown);
    const sel = dropdown.querySelector(".selected");
    if (sel) sel.scrollIntoView({ block: "center" });
  };

  wheel.addEventListener("scroll", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const i = Math.max(0, Math.min(options.length - 1, Math.round(wheel.scrollTop / ITEM_H)));
      if (i !== index) select(i, false);
    }, 80);
  });
  document.addEventListener("click", (e) => { if (dropdown && !container.contains(e.target)) closeDropdown(); });

  // Replace the wheel's contents (used when settings change labels or the option list). Does not fire onChange.
  return {
    setOptions(newOptions, newIndex) {
      closeDropdown();
      options = newOptions; index = newIndex;
      wheel.innerHTML = "";
      items = options.map((opt, i) => {
        const el = document.createElement("div");
        el.className = "wheel-item";
        el.textContent = getLabel(opt);
        el.addEventListener("click", () => (i === index ? openDropdown() : select(i, true)));
        wheel.appendChild(el);
        return el;
      });
      mark();
      wheel.scrollTop = index * ITEM_H;
    },
    layout() {},
  };
}

// ---------- iPod-style round wheel ----------
// A ring whose centre sits on the screen edge, so only a half circle shows. The "left" wheel puts its
// selected item at 3 o'clock; the "right" wheel is its mirror image (9 o'clock). Drag around the ring to spin.
function createRoundWheel(container, side, getLabel, loop, onChange) {
  const STEP = 30;          // degrees between items
  const FADE = 80;          // items fade out as they near the top and bottom
  const dir = side === "left" ? 1 : -1;
  const el = document.createElement("div");
  el.className = "rwheel " + side;
  el.tabIndex = 0;
  el.setAttribute("role", "slider");
  el.setAttribute("aria-label", container.getAttribute("aria-label") || "Wheel");
  const ring = document.createElement("div"); ring.className = "rring";
  const markEl = document.createElement("div"); markEl.className = "rmark";
  el.append(ring, markEl);
  container.appendChild(el);

  let options = [], items = [], pos = 0, lastIndex = 0, R = 130, anim = 0;
  const N = () => options.length;
  const mod = (a, n) => ((a % n) + n) % n;

  function layout() {
    const w = container.parentElement.parentElement.clientWidth || 360;   // width of the whole picker row
    R = Math.min(150, Math.round(w * 0.42));
    el.style.width = R + "px"; el.style.height = 2 * R + "px";
    ring.style.width = ring.style.height = 2 * R + "px";
    const hole = R * 0.34;
    markEl.style.top = R - 20 + "px";
    markEl.style[side === "left" ? "left" : "right"] = hole + 3 + "px";
    markEl.style.width = R - hole - 6 + "px";
    update();
  }

  function update() {
    const n = N(), rT = R * 0.67, sel = mod(Math.round(pos), n);
    items.forEach((it, k) => {
      let d = k - pos;
      if (loop) { d = mod(d, n); if (d > n / 2) d -= n; }
      const phi = d * STEP, a = (phi * Math.PI) / 180;
      const x = side === "left" ? rT * Math.cos(a) : R - rT * Math.cos(a);
      const y = R + rT * Math.sin(a);
      const o = Math.max(0, 1 - Math.pow(Math.abs(phi) / FADE, 2.2));
      it.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      it.style.opacity = o;
      it.style.pointerEvents = o < 0.15 ? "none" : "";
      it.classList.toggle("selected", k === sel);
    });
    el.setAttribute("aria-valuetext", options[sel] ? getLabel(options[sel]) : "");
  }

  function setPos(p) {
    pos = loop ? p : Math.max(0, Math.min(N() - 1, p));
    update();
    const idx = mod(Math.round(pos), N());
    if (idx !== lastIndex) { lastIndex = idx; onChange(options[idx]); }
  }

  function animateTo(target, dur = 220) {
    cancelAnimationFrame(anim);
    if (!loop) target = Math.max(0, Math.min(N() - 1, target));
    const from = pos, t0 = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      setPos(from + (target - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) anim = requestAnimationFrame(frame);
    };
    anim = requestAnimationFrame(frame);
  }

  // Dragging: follow the finger's angle around the wheel's centre.
  let drag = null;
  const angle = (e) => (Math.atan2(e.clientY - drag.cy, (e.clientX - drag.cx) * dir) * 180) / Math.PI;
  el.addEventListener("pointerdown", (e) => {
    cancelAnimationFrame(anim);
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    drag = { cx: side === "left" ? r.left : r.right, cy: r.top + R, x: e.clientX, y: e.clientY, moved: false,
             item: e.target.closest(".ritem"), samples: [] };
    drag.last = angle(e);
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
    if (!drag.moved) return;
    const a = angle(e);
    let da = a - drag.last;
    if (da > 180) da -= 360; if (da < -180) da += 360;
    drag.last = a;
    setPos(pos - da / STEP);
    drag.samples.push({ t: performance.now(), a: pos });
    if (drag.samples.length > 6) drag.samples.shift();
  });
  const release = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) {                                    // a tap: jump to the tapped item
      if (d.item) {
        const k = items.indexOf(d.item);
        let delta = k - pos;
        if (loop) { delta = mod(delta, N()); if (delta > N() / 2) delta -= N(); }
        animateTo(pos + delta);
      }
      return;
    }
    const s = d.samples, first = s[0], lastS = s[s.length - 1];
    const v = first && lastS && lastS.t > first.t ? (lastS.a - first.a) / (lastS.t - first.t) : 0;   // items per ms
    animateTo(Math.round(pos + Math.max(-3, Math.min(3, v * 160))), 260);
  };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("wheel", (e) => { e.preventDefault(); animateTo(Math.round(pos) + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
  el.addEventListener("keydown", (e) => {
    const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
    if (step) { e.preventDefault(); animateTo(Math.round(pos) + step); }
  });

  return {
    setOptions(newOptions, newIndex) {
      cancelAnimationFrame(anim);
      options = newOptions; pos = lastIndex = newIndex;
      items.forEach((it) => it.remove());
      items = options.map((opt) => {
        const it = document.createElement("div");
        it.className = "ritem";
        it.textContent = getLabel(opt);
        el.appendChild(it);
        return it;
      });
      layout();
    },
    layout,
  };
}

// ---------- Wheels ----------
let rootWheel = null, qualityWheel = null, mountedIpod = null;
const $ = (id) => document.getElementById(id);

function mountWheels() {
  $("rootPicker").innerHTML = ""; $("qualityPicker").innerHTML = "";
  $("pickers").classList.toggle("ipod", settings.ipod);
  const onRoot = (r) => { rootIndex = ROOTS.indexOf(r); render(); };
  const onQuality = (q) => { qualityKey = q.key; render(); };
  if (settings.ipod) {
    rootWheel = createRoundWheel($("rootPicker"), "left", rootLabel, true, onRoot);
    qualityWheel = createRoundWheel($("qualityPicker"), "right", (q) => q.abbr, false, onQuality);
  } else {
    rootWheel = createWheel($("rootPicker"), rootLabel, () => "", onRoot);
    qualityWheel = createWheel($("qualityPicker"), (q) => q.abbr, (q) => q.full, onQuality);
  }
  mountedIpod = settings.ipod;
}

function refreshWheels() {
  if (mountedIpod !== settings.ipod) mountWheels();
  rootWheel.setOptions(ROOTS, rootIndex);
  const list = availableQualities();
  if (!list.some((q) => q.key === qualityKey)) qualityKey = "maj";   // e.g. Beginner mode hides this chord
  qualityWheel.setOptions(list, list.findIndex((q) => q.key === qualityKey));
}
new ResizeObserver(() => { if (rootWheel) { rootWheel.layout(); qualityWheel.layout(); } }).observe($("pickers"));

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
  $("optDark").checked = settings.dark;
  $("optBeginner").checked = settings.beginner;
  $("optIpod").checked = settings.ipod;
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
bind("optDark", "dark"); bind("optBeginner", "beginner"); bind("optAvoid", "avoidDouble");
bind("optOdd", "avoidOdd"); bind("optIpod", "ipod");
document.querySelectorAll("#accidentals button").forEach((b) =>
  b.addEventListener("click", () => { settings.accidentals = b.dataset.mode; saveSettings(); applySettings(); }));

applySettings();
