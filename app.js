// Piano range: 3 octaves from C, enough for chords up to a 9th from any root.
const OCTAVES = 3;
const WHITE_W = 40, WHITE_H = 170, BLACK_W = 24, BLACK_H = 106;
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_AFTER = { 0: 1, 2: 3, 5: 6, 7: 8, 9: 10 }; // white-key pc -> black-key pc to its right

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
    for (const pc of WHITE_PCS) {
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
    for (const pc of WHITE_PCS) {
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

function render(root, quality) {
  keys.forEach((_, i) => keys[i] && setKey(i, false));
  const notes = buildChord(root, quality);
  notes.forEach((n) => setKey(n.key, true, n.isRoot, n.name));
  document.getElementById("chordTitle").textContent = chordTitle(root, quality);
  document.getElementById("chordNotes").textContent = notes.map((n) => n.name).join(" – ");
}

// Combination-lock style wheel. Scroll to pick; tap the selected item to open a dropdown.
function createWheel(container, options, getLabel, initialIndex, onChange) {
  const ITEM_H = 48;
  const wheel = document.createElement("div");
  wheel.className = "wheel";
  const items = options.map((opt, i) => {
    const el = document.createElement("div");
    el.className = "wheel-item";
    el.textContent = getLabel(opt);
    wheel.appendChild(el);
    return el;
  });
  container.appendChild(wheel);

  let index = initialIndex, timer = null, dropdown = null;
  const select = (i, scroll) => {
    index = i;
    items.forEach((el, j) => el.classList.toggle("selected", j === i));
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
      b.textContent = getLabel(opt);
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
  items.forEach((el, i) => el.addEventListener("click", () => (i === index ? openDropdown() : select(i, true))));
  document.addEventListener("click", (e) => { if (dropdown && !container.contains(e.target)) closeDropdown(); });

  select(initialIndex, false);
  wheel.scrollTop = initialIndex * ITEM_H;
}

let currentRoot = ROOTS[0], currentQuality = QUALITIES[1]; // start on C minor
buildPiano();
createWheel(document.getElementById("rootPicker"), ROOTS, (r) => r.label, 0,
  (r) => { currentRoot = r; render(currentRoot, currentQuality); });
createWheel(document.getElementById("qualityPicker"), QUALITIES, (q) => q.label, 1,
  (q) => { currentQuality = q; render(currentRoot, currentQuality); });
