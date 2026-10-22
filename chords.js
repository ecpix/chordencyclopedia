// Chord theory: pure data + logic, no DOM. Taught as formulas, not images.

// Root options. `pc` is the pitch class (0 = C). `name` is how we spell it in chords.
const ROOTS = [
  { label: "C",     name: "C",  pc: 0 },
  { label: "C♯/D♭", name: "Db", pc: 1 },
  { label: "D",     name: "D",  pc: 2 },
  { label: "E♭",    name: "Eb", pc: 3 },
  { label: "E",     name: "E",  pc: 4 },
  { label: "F",     name: "F",  pc: 5 },
  { label: "F♯/G♭", name: "F#", pc: 6 },
  { label: "G",     name: "G",  pc: 7 },
  { label: "A♭",    name: "Ab", pc: 8 },
  { label: "A",     name: "A",  pc: 9 },
  { label: "B♭",    name: "Bb", pc: 10 },
  { label: "B",     name: "B",  pc: 11 },
];

// Each chord tone = [semitones above root, scale degree]. The degree decides the letter name
// (so a minor third is spelled Eb in C minor, not D#).
const QUALITIES = [
  { label: "major",       symbol: "",        tones: [[0,1],[4,3],[7,5]] },
  { label: "minor",       symbol: "m",       tones: [[0,1],[3,3],[7,5]] },
  { label: "diminished",  symbol: "dim",     tones: [[0,1],[3,3],[6,5]] },
  { label: "augmented",   symbol: "aug",     tones: [[0,1],[4,3],[8,5]] },
  { label: "sus2",        symbol: "sus2",    tones: [[0,1],[2,2],[7,5]] },
  { label: "sus4",        symbol: "sus4",    tones: [[0,1],[5,4],[7,5]] },
  { label: "major 6",     symbol: "6",       tones: [[0,1],[4,3],[7,5],[9,6]] },
  { label: "minor 6",     symbol: "m6",      tones: [[0,1],[3,3],[7,5],[9,6]] },
  { label: "dominant 7",  symbol: "7",       tones: [[0,1],[4,3],[7,5],[10,7]] },
  { label: "major 7",     symbol: "maj7",    tones: [[0,1],[4,3],[7,5],[11,7]] },
  { label: "minor 7",     symbol: "m7",      tones: [[0,1],[3,3],[7,5],[10,7]] },
  { label: "minor major 7", symbol: "m(maj7)", tones: [[0,1],[3,3],[7,5],[11,7]] },
  { label: "diminished 7", symbol: "dim7",   tones: [[0,1],[3,3],[6,5],[9,7]] },
  { label: "half-diminished (m7♭5)", symbol: "m7♭5", tones: [[0,1],[3,3],[6,5],[10,7]] },
  { label: "augmented 7", symbol: "aug7",    tones: [[0,1],[4,3],[8,5],[10,7]] },
  { label: "add9",        symbol: "add9",    tones: [[0,1],[4,3],[7,5],[14,9]] },
  { label: "dominant 9",  symbol: "9",       tones: [[0,1],[4,3],[7,5],[10,7],[14,9]] },
  { label: "major 9",     symbol: "maj9",    tones: [[0,1],[4,3],[7,5],[11,7],[14,9]] },
  { label: "minor 9",     symbol: "m9",      tones: [[0,1],[3,3],[7,5],[10,7],[14,9]] },
];

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function accidental(n) {
  if (n === 0) return "";
  if (n === 1) return "♯";
  if (n === 2) return "𝄪";
  if (n === -1) return "♭";
  if (n === -2) return "♭♭";
  return "";
}

function spell(rootName, semitones, degree) {
  const rootLetter = rootName[0];
  const letter = LETTERS[(LETTERS.indexOf(rootLetter) + degree - 1) % 7];
  const rootPc = LETTER_PC[rootLetter] + (rootName[1] === "#" ? 1 : rootName[1] === "b" ? -1 : 0);
  const targetPc = rootPc + semitones;
  let diff = (targetPc - LETTER_PC[letter]) % 12;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return letter + accidental(diff);
}

// Semitones above the root for each degree of the major scale (9 = 2 an octave up).
const MAJOR_OFFSET = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 14 };

// Degree label as a pianist reads it: 1, ♭3, 5, ♭7, 9 ...
function degreeLabel(semitones, degree) {
  const diff = semitones - MAJOR_OFFSET[degree];
  return accidental(diff) + degree;
}

// Returns the chord's notes: semitones above the root, spelled name, degree label,
// and whether it is the root. Placing them on the keyboard is the UI's job.
function buildChord(root, quality) {
  return quality.tones.map(([semis, degree], i) => ({
    semis,
    name: spell(root.name, semis, degree),
    degree: degreeLabel(semis, degree),
    isRoot: i === 0,
  }));
}

function chordTitle(root, quality) {
  const base = root.name.replace("b", "♭").replace("#", "♯");
  return base + quality.symbol;
}

if (typeof module !== "undefined") module.exports = { ROOTS, QUALITIES, buildChord, chordTitle };
