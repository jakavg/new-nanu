// Offline composer (Option 4 engine -> Option 1 bank).
// Reads the Islami lexicon and composes name + meaning combinations purely
// algorithmically (zero AI). Emits SQL files (lexicon + name-bank chunks) that
// are loaded into Supabase via the management SQL endpoint.
//
// Run locally:  node scripts/compose-islami.js
// Output:       written to the path in OUT_DIR below.

const fs = require('fs');
const path = require('path');

const OUT_DIR = process.argv[2] || path.join(__dirname, 'out');
const ORIGIN = 'islami';
const PER_BUCKET = 150; // max composed names per (gender, length)
const CHUNK = 300; // names per SQL file
const LENGTHS = [2, 3];
const GENDERS = ['lk', 'pr'];

// deterministic PRNG so re-runs are stable
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260630);
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function joinAnd(arr) {
  if (arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(', ') + ' dan ' + arr[arr.length - 1];
}
function composeMeaning(words) {
  const nouns = words.filter((w) => w.pos === 'noun').map((w) => w.meaning);
  const adjs = words.filter((w) => w.pos === 'adj').map((w) => w.meaning);
  let phrase;
  if (nouns.length && adjs.length) phrase = joinAnd(nouns) + ' yang ' + joinAnd(adjs);
  else if (nouns.length) phrase = joinAnd(nouns);
  else phrase = joinAnd(adjs);
  return cap(phrase);
}
const genderOk = (w, g) => w.gender === g || w.gender === 'uni';

function composeBucket(pool, length, gender) {
  const out = [];
  const seenKeys = new Set();
  let attempts = 0;
  const maxAttempts = PER_BUCKET * 40;
  while (out.length < PER_BUCKET && attempts < maxAttempts) {
    attempts++;
    const picks = [];
    const used = new Set();
    while (picks.length < length) {
      const i = Math.floor(rand() * pool.length);
      if (used.has(i)) continue;
      used.add(i);
      picks.push(pool[i]);
    }
    const meanings = picks.map((p) => p.meaning);
    if (new Set(meanings).size !== meanings.length) continue;
    const name = picks.map((p) => cap(p.word)).join(' ');
    const nameKey = name.toLowerCase();
    if (seenKeys.has(nameKey)) continue;
    seenKeys.add(nameKey);
    out.push({
      name,
      meaning: composeMeaning(picks),
      length,
      gender,
      theme_tags: Array.from(new Set(picks.flatMap((p) => p.theme_tags || []))),
      source_words: picks.map((p) => p.word),
      name_key: nameKey,
    });
  }
  return out;
}

// --- SQL helpers ---
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const arr = (a) => "'{" + a.map((x) => '"' + String(x).replace(/"/g, '\\"') + '"').join(',') + "}'";

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const lex = JSON.parse(fs.readFileSync(path.join(__dirname, 'lexicon-islami.json'), 'utf8'));
  const words = lex.words;

  // 1) lexicon SQL
  const lexVals = words
    .map((w) => `(${q(ORIGIN)},${q(w.word)},${q(w.meaning)},${q(w.pos)},${q(w.gender)},${arr(w.theme_tags)},'live')`)
    .join(',\n');
  const lexSql =
    `INSERT INTO lexicon_words (origin,word,meaning,pos,gender,theme_tags,status) VALUES\n${lexVals}\n` +
    `ON CONFLICT (origin,word) DO UPDATE SET meaning=EXCLUDED.meaning,pos=EXCLUDED.pos,gender=EXCLUDED.gender,theme_tags=EXCLUDED.theme_tags,status=EXCLUDED.status;`;
  fs.writeFileSync(path.join(OUT_DIR, 'lexicon.sql'), lexSql);

  // 2) compose name bank
  const all = [];
  for (const gender of GENDERS) {
    const pool = words.filter((w) => genderOk(w, gender));
    for (const length of LENGTHS) {
      const composed = composeBucket(pool, length, gender);
      all.push(...composed);
      console.log(`${gender}/${length} -> ${composed.length} (pool ${pool.length})`);
    }
  }

  // 3) write name-bank SQL in chunks
  let file = 0;
  for (let i = 0; i < all.length; i += CHUNK) {
    const chunk = all.slice(i, i + CHUNK);
    const vals = chunk
      .map(
        (n) =>
          `(${q(n.name)},${q(n.meaning)},${q(ORIGIN)},${n.length},${q(n.gender)},${arr(n.theme_tags)},${arr(n.source_words)},${q(n.name_key)},'live')`
      )
      .join(',\n');
    const sql =
      `INSERT INTO names_bank (name,meaning,origin,length,gender,theme_tags,source_words,name_key,status) VALUES\n${vals}\n` +
      `ON CONFLICT (origin,name_key) DO NOTHING;`;
    fs.writeFileSync(path.join(OUT_DIR, `names_${file}.sql`), sql);
    file++;
  }
  console.log(`TOTAL composed: ${all.length}; wrote lexicon.sql + ${file} name file(s) to ${OUT_DIR}`);
}

main();
