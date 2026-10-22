// Chord theory: pure data + logic, no DOM. Taught as formulas, not images.

// Root options. `pc` is the pitch class (0 = C). The three spellings are used by the
// Auto / ♯ / ♭ switch ("mix" is the traditional key-signature-friendly spelling).
const ROOTS = [
  { pc: 0,  mix: "C",  sharp: "C",  flat: "C"  },
  { pc: 1,  mix: "Db", sharp: "C#", flat: "Db" },
  { pc: 2,  mix: "D",  sharp: "D",  flat: "D"  },
  { pc: 3,  mix: "Eb", sharp: "D#", flat: "Eb" },
  { pc: 4,  mix: "E",  sharp: "E",  flat: "E"  },
  { pc: 5,  mix: "F",  sharp: "F",  flat: "F"  },
  { pc: 6,  mix: "F#", sharp: "F#", flat: "Gb" },
  { pc: 7,  mix: "G",  sharp: "G",  flat: "G"  },
  { pc: 8,  mix: "Ab", sharp: "G#", flat: "Ab" },
  { pc: 9,  mix: "A",  sharp: "A",  flat: "A"  },
  { pc: 10, mix: "Bb", sharp: "A#", flat: "Bb" },
  { pc: 11, mix: "B",  sharp: "B",  flat: "B"  },
];

// Each chord tone = [semitones above root, scale degree]. The degree decides the letter name
// (so a minor third is spelled Eb in C minor, not D#).
//   abbr     short label for the wheel          full     spoken name
//   symbol   suffix in the chord title          aliases  other common ways to write it
//   beginner rank in Beginner mode (absent = hidden there)
const QUALITIES = [
  { key: "maj",   abbr: "maj",    full: "major",                symbol: "",        aliases: ["M", "maj"],            beginner: 1, tones: [[0,1],[4,3],[7,5]] },
  { key: "min",   abbr: "min",    full: "minor",                symbol: "m",       aliases: ["min", "mi", "-"],      beginner: 2, tones: [[0,1],[3,3],[7,5]] },
  { key: "dim",   abbr: "dim",    full: "diminished",           symbol: "dim",     aliases: ["°"],                                tones: [[0,1],[3,3],[6,5]] },
  { key: "aug",   abbr: "aug",    full: "augmented",            symbol: "aug",     aliases: ["+"],                                tones: [[0,1],[4,3],[8,5]] },
  { key: "sus2",  abbr: "sus2",   full: "suspended 2nd",        symbol: "sus2",    aliases: [],                                   tones: [[0,1],[2,2],[7,5]] },
  { key: "sus4",  abbr: "sus4",   full: "suspended 4th",        symbol: "sus4",    aliases: ["sus"],                 beginner: 6, tones: [[0,1],[5,4],[7,5]] },
  { key: "6",     abbr: "6",      full: "major 6th",            symbol: "6",       aliases: ["maj6", "M6"],                       tones: [[0,1],[4,3],[7,5],[9,6]] },
  { key: "m6",    abbr: "m6",     full: "minor 6th",            symbol: "m6",      aliases: ["min6", "mi6", "-6"],                tones: [[0,1],[3,3],[7,5],[9,6]] },
  { key: "7",     abbr: "7",      full: "dominant 7th",         symbol: "7",       aliases: ["dom7"],                beginner: 4, tones: [[0,1],[4,3],[7,5],[10,7]] },
  { key: "maj7",  abbr: "maj7",   full: "major 7th",            symbol: "maj7",    aliases: ["M7", "Δ7", "ma7"],     beginner: 3, tones: [[0,1],[4,3],[7,5],[11,7]] },
  { key: "m7",    abbr: "m7",     full: "minor 7th",            symbol: "m7",      aliases: ["min7", "mi7", "-7"],   beginner: 5, tones: [[0,1],[3,3],[7,5],[10,7]] },
  { key: "mmaj7", abbr: "m(maj7)", full: "minor major 7th",     symbol: "m(maj7)", aliases: ["mM7", "min(maj7)", "-Δ7"],          tones: [[0,1],[3,3],[7,5],[11,7]] },
  { key: "dim7",  abbr: "dim7",   full: "diminished 7th",       symbol: "dim7",    aliases: ["°7"],                               tones: [[0,1],[3,3],[6,5],[9,7]] },
  { key: "m7b5",  abbr: "m7♭5",   full: "half-diminished 7th",  symbol: "m7♭5",    aliases: ["ø", "ø7", "-7♭5"],                  tones: [[0,1],[3,3],[6,5],[10,7]] },
  { key: "aug7",  abbr: "aug7",   full: "augmented 7th",        symbol: "aug7",    aliases: ["+7", "7♯5"],                        tones: [[0,1],[4,3],[8,5],[10,7]] },
  { key: "add9",  abbr: "add9",   full: "add 9",                symbol: "add9",    aliases: [],                                   tones: [[0,1],[4,3],[7,5],[14,9]] },
  { key: "9",     abbr: "9",      full: "dominant 9th",         symbol: "9",       aliases: ["dom9"],                             tones: [[0,1],[4,3],[7,5],[10,7],[14,9]] },
  { key: "maj9",  abbr: "maj9",   full: "major 9th",            symbol: "maj9",    aliases: ["M9", "Δ9"],                         tones: [[0,1],[4,3],[7,5],[11,7],[14,9]] },
  { key: "m9",    abbr: "m9",     full: "minor 9th",            symbol: "m9",      aliases: ["min9", "mi9", "-9"],                tones: [[0,1],[3,3],[7,5],[10,7],[14,9]] },
];

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SIMPLE_SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const SIMPLE_FLAT  = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

// "x" is the usual plain-text double sharp; it displays on every device (the 𝄪 symbol doesn't).
function accidental(n) {
  if (n === 0) return "";
  if (n === 1) return "♯";
  if (n === 2) return "x";
  if (n === -1) return "♭";
  if (n === -2) return "♭♭";
  return "";
}

// "Db" -> "D♭", "F#" -> "F♯" (display form of an ASCII root name).
function fmt(name) {
  return name.replace("b", "♭").replace("#", "♯");
}

// Spell one chord tone: the degree picks the letter, the pitch picks the accidental.
// With avoidDouble, a double sharp/flat is replaced by the simpler enharmonic note.
function spell(rootName, semitones, degree, avoidDouble) {
  const rootLetter = rootName[0];
  const letter = LETTERS[(LETTERS.indexOf(rootLetter) + degree - 1) % 7];
  const rootPc = LETTER_PC[rootLetter] + (rootName[1] === "#" ? 1 : rootName[1] === "b" ? -1 : 0);
  const targetPc = (((rootPc + semitones) % 12) + 12) % 12;
  let diff = (targetPc - LETTER_PC[letter]) % 12;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  if (avoidDouble && Math.abs(diff) === 2) {
    return (diff > 0 ? SIMPLE_SHARP : SIMPLE_FLAT)[targetPc];
  }
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
function buildChord(rootName, quality, avoidDouble) {
  return quality.tones.map(([semis, degree], i) => ({
    semis,
    name: spell(rootName, semis, degree, avoidDouble),
    degree: degreeLabel(semis, degree),
    isRoot: i === 0,
  }));
}

const chordTitle = (rootName, quality) => fmt(rootName) + quality.symbol;
const chordFullName = (rootName, quality) => fmt(rootName) + " " + quality.full;
const chordAliases = (rootName, quality) => quality.aliases.map((a) => fmt(rootName) + a);

if (typeof module !== "undefined") {
  module.exports = { ROOTS, QUALITIES, buildChord, chordTitle, chordFullName, chordAliases, fmt };
}
