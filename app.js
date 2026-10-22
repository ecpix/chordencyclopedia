// ---------- Keyboard ----------
// Piano range: 2 octaves, from F up to the E two octaves later (24 keys).
const OCTAVES = 2;
const START_PC = 5; // F
const WHITE_W = 40, WHITE_H = 170, BLACK_W = 24, BLACK_H = 106;
// Keys are numbered by semitones above the lowest F: 0 = F, 1 = F#, ... 11 = E, 12 = F, ... 23 = E.
const WHITE_OFFSETS = [0, 2, 4, 6, 7, 9, 11];   // F G A B C D E
const BLACK_AFTER = { 0: 1, 2: 3, 4: 5, 7: 8, 9: 10 }; // white offset -> black offset to its right

// Every key has its own on/off state; the chord logic just flips them.
const keys = [];
function buildPiano() {
  const piano = document.getElementById("piano");
  const svgNS = "http://www.w3.org/2000/svg";
  const width = OCTAVES * 7 * WHITE_W;
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${WHITE_H + 8}`);
  const blackLayer = document.createElementNS(svgNS, "g");

  let whiteIndex = 0;
  for (let oct = 0; oct < OCTAVES; oct++) {
    for (const pc of WHITE_OFFSETS) {
      const x = whiteIndex * WHITE_W;
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", x); rect.setAttribute("y", 2);
      rect.setAttribute("width", WHITE_W); rect.setAttribute("height", WHITE_H);
      rect.setAttribute("class", "white");
      svg.appendChild(rect);
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("cx", x + WHITE_W / 2); dot.setAttribute("cy", WHITE_H - 38); dot.setAttribute("r", 9);
      dot.setAttribute("class", "dot"); dot.style.display = "none";
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", x + WHITE_W / 2); label.setAttribute("y", WHITE_H - 10);
      label.setAttribute("class", "label");
      keys[oct * 12 + pc] = { rect, dot, label };
      whiteIndex++;
    }
  }
  whiteIndex = 0;
  for (let oct = 0; oct < OCTAVES; oct++) {
    for (const pc of WHITE_OFFSETS) {
      const blackPc = BLACK_AFTER[pc];
      if (blackPc !== undefined) {
        const x = (whiteIndex + 1) * WHITE_W - BLACK_W / 2;
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", x); rect.setAttribute("y", 2);
        rect.setAttribute("width", BLACK_W); rect.setAttribute("height", BLACK_H);
        rect.setAttribute("class", "black");
        const dot = document.createElementNS(svgNS, "circle");
        dot.setAttribute("cx", x + BLACK_W / 2); dot.setAttribute("cy", BLACK_H - 20); dot.setAttribute("r", 7);
        dot.setAttribute("class", "dot"); dot.style.display = "none";
        keys[oct * 12 + blackPc] = { rect, dot, label: null };
        blackLayer.appendChild(rect); blackLayer.appendChild(dot);
      }
      whiteIndex++;
    }
  }
  svg.appendChild(blackLayer);
  // White-key dots and labels go on top of everything.
  keys.forEach((k) => { if (k && k.label) { svg.appendChild(k.dot); svg.appendChild(k.label); } });
  piano.appendChild(svg);
}

function setKey(index, on, isRoot, name) {
  const k = keys[index];
  const isWhite = k.label !== null;
  k.rect.classList.toggle("on", on);
  k.rect.classList.toggle("root", on && isRoot);
  k.dot.style.display = on ? "" : "none";
  k.dot.classList.toggle("root", on && isRoot);
  if (isWhite) k.label.textContent = on ? name : "";
}

// Where a chord note lands on the keyboard. The root sits in the first octave; any note that
// would run past the top is folded down an octave (a 9th on a high root, for example).
function keyIndex(root, semis) {
  let idx = ((root.pc - START_PC + 12) % 12) + semis;
  while (idx >= OCTAVES * 12) idx -= 12;
  return idx;
}

// ---------- Settings ----------
const STORAGE_KEY = "chordencyclopedia.settings";
const settings = { dark: false, beginner: false, avoidDouble: false, accidentals: "mix" };
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
  const notes = buildChord(name, quality, settings.beginner || settings.avoidDouble);

  keys.forEach((_, i) => keys[i] && setKey(i, false));
  notes.forEach((n) => setKey(keyIndex(root, n.semis), true, n.isRoot, n.name));

  document.getElementById("chordTitle").textContent = chordTitle(name, quality);
  document.getElementById("chordFull").textContent = chordFullName(name, quality);
  const cell = (n, text) => `<td${n.isRoot ? ' class="root"' : ""}><span>${text}</span></td>`;
  document.getElementById("noteTable").innerHTML =
    "<tr>" + notes.map((n) => cell(n, n.name)).join("") + "</tr>" +
    (settings.beginner ? "" : "<tr>" + notes.map((n) => cell(n, n.degree)).join("") + "</tr>");
  const aliases = settings.beginner ? [] : chordAliases(name, quality);
  document.getElementById("aliases").textContent = aliases.length ? "Also written: " + aliases.join(" · ") : "";
}

// ---------- Wheel ----------
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
  };
}

const rootWheel = createWheel(document.getElementById("rootPicker"), rootLabel, () => "",
  (r) => { rootIndex = ROOTS.indexOf(r); render(); });
const qualityWheel = createWheel(document.getElementById("qualityPicker"), (q) => q.abbr, (q) => q.full,
  (q) => { qualityKey = q.key; render(); });

function refreshWheels() {
  rootWheel.setOptions(ROOTS, rootIndex);
  const list = availableQualities();
  if (!list.some((q) => q.key === qualityKey)) qualityKey = "maj";   // e.g. Beginner mode hides this chord
  qualityWheel.setOptions(list, list.findIndex((q) => q.key === qualityKey));
}

// ---------- Menu & toggles ----------
const $ = (id) => document.getElementById(id);
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
  // Beginner mode always avoids double sharps/flats, so that switch shows on and is locked.
  $("optAvoid").checked = settings.beginner || settings.avoidDouble;
  $("optAvoid").disabled = settings.beginner;
  $("rowAvoid").classList.toggle("disabled", settings.beginner);
  document.querySelectorAll("#accidentals button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.mode === settings.accidentals)));
  refreshWheels();
  render();
}

$("optDark").addEventListener("change", (e) => { settings.dark = e.target.checked; saveSettings(); applySettings(); });
$("optBeginner").addEventListener("change", (e) => { settings.beginner = e.target.checked; saveSettings(); applySettings(); });
$("optAvoid").addEventListener("change", (e) => { settings.avoidDouble = e.target.checked; saveSettings(); applySettings(); });
document.querySelectorAll("#accidentals button").forEach((b) =>
  b.addEventListener("click", () => { settings.accidentals = b.dataset.mode; saveSettings(); applySettings(); }));

buildPiano();
applySettings();
