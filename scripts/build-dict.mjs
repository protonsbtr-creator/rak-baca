// Builds dict/ from two Open English WordNet release files: english-wordnet-XXXX.xml.gz, and the
// index.sense inside english-wordnet-XXXX-index.sense-fixed.zip, which numbers each word's senses.
//   npm run dict -- path/to/english-wordnet-2025.xml.gz path/to/index.sense dict
// The output is committed, so this only needs running again for a new WordNet edition.
// One file per first two letters: { "run": [["v", "definition", "example"], ...], "ran": "run" }.
// A string value points an irregular form at its dictionary word. A form that is also a word of its own
// keeps its entry and adds "=said": "say", so the word box can offer both.
import { createReadStream, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { join } from "node:path";

const [input, indexSense, outDir] = process.argv.slice(2);
if (!input || !indexSense || !outDir) { console.error("usage: build-dict.mjs <wordnet.xml[.gz]> <index.sense> <output dir>"); process.exit(1); }
const MAX_SENSES_PER_POS = 6;

const decode = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[e]);
const attr = (line, name) => { const m = new RegExp(`\\b${name}="([^"]*)"`).exec(line); return m ? decode(m[1]) : null; };
// Lower case without accents and with a straight apostrophe, the same way the app cleans a tapped word.
const normalise = (w) => w.normalize("NFD").replace(/\p{M}/gu, "").replace(/’/g, "'").toLowerCase();
const isWord = (w) => /^[a-z][a-z'-]*$/.test(w);

const rank = new Map();
for (const line of readFileSync(indexSense, "utf8").split("\n")) {
  const [key, , number] = line.split(" ");
  if (key) rank.set(key, +number);
}
// oewn-run__2.38.00.. in the XML is run%2:38:00:: in index.sense.
const rankOf = (senseId) => {
  const [word, rest] = senseId.replace(/^oewn-/, "").split("__");
  return rank.get(word.replace(/-ap-/g, "'").replace(/-sl-/g, "/").toLowerCase() + "%" + rest.replace(/\./g, ":")) ?? 999;
};

const entries = []; // { word, pos, proper, senses: [{ rank, synset }] }
const forms = new Map(); // irregular form -> dictionary word
const synsets = new Map(); // id -> [definition, example]
let entry = null, synset = null;

const stream = createReadStream(input);
const lines = createInterface({ input: input.endsWith(".gz") ? stream.pipe(createGunzip()) : stream, crlfDelay: Infinity });
for await (const line of lines) {
  if (line.includes("<LexicalEntry")) entry = { word: null, pos: null, proper: false, senses: [] };
  else if (entry && line.includes("<Lemma ")) {
    const written = attr(line, "writtenForm");
    entry.word = normalise(written); entry.pos = attr(line, "partOfSpeech");
    entry.proper = written !== written.toLowerCase(); // "Fox" the people, after "fox" the animal
  }
  else if (entry && line.includes("<Form ")) {
    const f = normalise(attr(line, "writtenForm"));
    if (isWord(f) && entry.word && isWord(entry.word) && f !== entry.word && !forms.has(f)) forms.set(f, entry.word);
  }
  else if (entry && line.includes("<Sense ")) entry.senses.push({ rank: rankOf(attr(line, "id")), synset: attr(line, "synset") });
  else if (line.includes("</LexicalEntry>")) { if (entry?.word && isWord(entry.word)) entries.push(entry); entry = null; }
  else if (line.includes("<Synset ")) { synset = [null, null]; synsets.set(attr(line, "id"), synset); }
  else if (synset && !synset[0] && line.includes("<Definition")) synset[0] = decode(/<Definition[^>]*>(.*)<\/Definition>/.exec(line)?.[1] ?? "");
  else if (synset && !synset[1] && line.includes("<Example")) synset[1] = decode(/<Example[^>]*>(.*)<\/Example>/.exec(line)?.[1] ?? "");
  else if (line.includes("</Synset>")) synset = null;
}

// WordNet has no usage counts, so a word's senses go by its own numbering with proper names last,
// and the part of speech with the most senses comes first ("run" the verb before "run" the noun).
const byWord = new Map();
for (const { word, pos, proper, senses } of entries) {
  const p = pos === "s" ? "a" : pos; // satellite adjectives are simply adjectives to a reader
  if (!byWord.has(word)) byWord.set(word, new Map());
  const byPos = byWord.get(word);
  if (!byPos.has(p)) byPos.set(p, []);
  for (const { rank: r, synset } of senses) {
    const s = synsets.get(synset);
    if (s?.[0]) byPos.get(p).push({ proper, rank: r, def: s[0], ex: s[1] });
  }
}
const dict = new Map();
for (const [word, byPos] of byWord) {
  const rows = [];
  const order = [...byPos.entries()].sort((a, b) => b[1].length - a[1].length || "nvar".indexOf(a[0]) - "nvar".indexOf(b[0]));
  for (const [p, senses] of order) {
    senses.sort((a, b) => a.proper - b.proper || a.rank - b.rank);
    const seen = new Set();
    for (const s of senses) {
      if (seen.size >= MAX_SENSES_PER_POS || seen.has(s.def)) continue;
      seen.add(s.def);
      rows.push(s.ex ? [p, s.def, s.ex] : [p, s.def]);
    }
  }
  if (rows.length) dict.set(word, rows);
}
for (const [form, word] of forms) if (dict.has(word)) dict.set(dict.has(form) ? "=" + form : form, word);

const files = new Map();
const fileOf = (w) => (w + "_").slice(0, 2).replace(/[^a-z]/g, "_");
for (const [word, value] of dict) {
  const f = fileOf(word.replace(/^=/, ""));
  if (!files.has(f)) files.set(f, {});
  files.get(f)[word] = value;
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
let bytes = 0, largest = 0;
for (const [f, obj] of files) {
  const json = JSON.stringify(obj);
  writeFileSync(join(outDir, f + ".json"), json);
  const n = Buffer.byteLength(json);
  bytes += n; largest = Math.max(largest, n);
}
writeFileSync(join(outDir, "NOTICE.md"), `# Kamus Rak Baca

Definitions come from [Open English WordNet](https://github.com/globalwordnet/english-wordnet) 2025 edition by the Open English Wordnet team, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It is derived from [Princeton WordNet](https://wordnet.princeton.edu/).

Changes: kept single words only, at most ${MAX_SENSES_PER_POS} senses per part of speech and one example per sense, and split the result into one JSON file per first two letters. Rebuild with \`scripts/build-dict.mjs\`.
`);
console.log(`${[...dict.keys()].filter((k) => k[0] !== "=").length} words, ${files.size} files, ${(bytes / 1e6).toFixed(1)} MB total, largest ${(largest / 1e3).toFixed(0)} KB`);
