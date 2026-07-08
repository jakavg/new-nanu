-- Nanu name-bank pipeline (Option 4 engine -> Option 1 serving), in-DB, zero-AI.
--
-- Schema (lexicon_words / names_bank / name_blocklist) lives in the Supabase
-- migration `nanu_namebank_lexicon`. The lexicon rows are seeded from
-- scripts/lexicon-islami.json (see scripts/out/lexicon.sql for the generated
-- INSERT, or regenerate with `node scripts/compose-islami.js`).
--
-- This file is the canonical, idempotent composition + serving layer:
--   1. compose_meaning()  — turns word meanings into one Indonesian phrase
--   2. INSERT..SELECT x4  — composes the name bank from lexicon self-joins
--   3. pick_bank_names()  — random, filtered, exclude-aware serving (used by api/generate.js)
--   4. bank_has_origin()  — coverage check (which origins serve from the bank)
--
-- Re-running is safe: functions use CREATE OR REPLACE; inserts use
-- ON CONFLICT (origin,name_key) DO NOTHING. To rebuild a bank from scratch,
-- DELETE FROM names_bank WHERE origin='islami' first.
--
-- To cover a new origin: seed its lexicon_words, then run the 4 inserts with
-- the origin literal swapped (and adjust PER_BUCKET via the LIMIT).

-- 1) Meaning grammar -----------------------------------------------------------
CREATE OR REPLACE FUNCTION compose_meaning(nouns text[], adjs text[]) RETURNS text AS $$
DECLARE p text;
BEGIN
  IF cardinality(nouns) > 0 AND cardinality(adjs) > 0 THEN
    p := array_to_string(nouns, ' dan ') || ' yang ' || array_to_string(adjs, ' dan ');
  ELSIF cardinality(nouns) > 0 THEN
    p := array_to_string(nouns, ' dan ');
  ELSE
    p := array_to_string(adjs, ' dan ');
  END IF;
  RETURN upper(left(p, 1)) || substr(p, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2) Compose the Islami bank ---------------------------------------------------
-- 2-word, laki-laki
INSERT INTO names_bank (name,meaning,origin,length,gender,theme_tags,source_words,name_key,status)
SELECT a.word||' '||b.word,
       compose_meaning(
         array_remove(ARRAY[CASE WHEN a.pos='noun' THEN a.meaning END,
                            CASE WHEN b.pos='noun' THEN b.meaning END], NULL),
         array_remove(ARRAY[CASE WHEN a.pos='adj' THEN a.meaning END,
                            CASE WHEN b.pos='adj' THEN b.meaning END], NULL)),
       'islami', 2, 'lk',
       (SELECT array_agg(DISTINCT t) FROM unnest(a.theme_tags||b.theme_tags) AS t),
       ARRAY[a.word,b.word],
       lower(a.word||' '||b.word),
       'live'
FROM (SELECT * FROM lexicon_words WHERE origin='islami' AND status='live' AND gender IN ('lk','uni')) a
JOIN (SELECT * FROM lexicon_words WHERE origin='islami' AND status='live' AND gender IN ('lk','uni')) b
  ON a.id < b.id
WHERE a.meaning <> b.meaning
ORDER BY random() LIMIT 150
ON CONFLICT (origin,name_key) DO NOTHING;

-- 2-word, perempuan
INSERT INTO names_bank (name,meaning,origin,length,gender,theme_tags,source_words,name_key,status)
SELECT a.word||' '||b.word,
       compose_meaning(
         array_remove(ARRAY[CASE WHEN a.pos='noun' THEN a.meaning END,
                            CASE WHEN b.pos='noun' THEN b.meaning END], NULL),
         array_remove(ARRAY[CASE WHEN a.pos='adj' THEN a.meaning END,
                            CASE WHEN b.pos='adj' THEN b.meaning END], NULL)),
       'islami', 2, 'pr',
       (SELECT array_agg(DISTINCT t) FROM unnest(a.theme_tags||b.theme_tags) AS t),
       ARRAY[a.word,b.word],
       lower(a.word||' '||b.word),
       'live'
FROM (SELECT * FROM lexicon_words WHERE origin='islami' AND status='live' AND gender IN ('pr','uni')) a
JOIN (SELECT * FROM lexicon_words WHERE origin='islami' AND status='live' AND gender IN ('pr','uni')) b
  ON a.id < b.id
WHERE a.meaning <> b.meaning
ORDER BY random() LIMIT 150
ON CONFLICT (origin,name_key) DO NOTHING;

-- 3-word, laki-laki
INSERT INTO names_bank (name,meaning,origin,length,gender,theme_tags,source_words,name_key,status)
SELECT a.word||' '||b.word||' '||c.word,
       compose_meaning(
         array_remove(ARRAY[CASE WHEN a.pos='noun' THEN a.meaning END,
                            CASE WHEN b.pos='noun' THEN b.meaning END,
                            CASE WHEN c.pos='noun' THEN c.meaning END], NULL),
         array_remove(ARRAY[CASE WHEN a.pos='adj' THEN a.meaning END,
                            CASE WHEN b.pos='adj' THEN b.meaning END,
                            CASE WHEN c.pos='adj' THEN c.meaning END], NULL)),
       'islami', 3, 'lk',
       (SELECT array_agg(DISTINCT t) FROM unnest(a.theme_tags||b.theme_tags||c.theme_tags) AS t),
       ARRAY[a.word,b.word,c.word],
       lower(a.word||' '||b.word||' '||c.word),
       'live'
FROM (SELECT * FROM lexicon_words WHERE origin='islami' AND status='live' AND gender IN ('lk','uni')) a
JOIN (SELECT * FROM lexicon_words WHERE origin='islami' AND status='live' AND gender IN ('lk','uni')) b ON a.id < b.id
JOIN (SELECT * FROM lexicon_words WHERE origin='islami' AND status='live' AND gender IN ('lk','uni')) c ON b.id < c.id
WHERE a.meaning <> b.meaning AND a.meaning <> c.meaning AND b.meaning <> c.meaning
ORDER BY random() LIMIT 150
ON CONFLICT (origin,name_key) DO NOTHING;

-- 3-word, perempuan
INSERT INTO names_bank (name,meaning,origin,length,gender,theme_tags,source_words,name_key,status)
SELECT a.word||' '||b.word||' '||c.word,
       compose_meaning(
         array_remove(ARRAY[CASE WHEN a.pos='noun' THEN a.meaning END,
                            CASE WHEN b.pos='noun' THEN b.meaning END,
                            CASE WHEN c.pos='noun' THEN c.meaning END], NULL),
         array_remove(ARRAY[CASE WHEN a.pos='adj' THEN a.meaning END,
                            CASE WHEN b.pos='adj' THEN b.meaning END,
                            CASE WHEN c.pos='adj' THEN c.meaning END], NULL)),
       'islami', 3, 'pr',
       (SELECT array_agg(DISTINCT t) FROM unnest(a.theme_tags||b.theme_tags||c.theme_tags) AS t),
       ARRAY[a.word,b.word,c.word],
       lower(a.word||' '||b.word||' '||c.word),
       'live'
FROM (SELECT * FROM lexicon_words WHERE origin='islami' AND status='live' AND gender IN ('pr','uni')) a
JOIN (SELECT * FROM lexicon_words WHERE origin='islami' AND status='live' AND gender IN ('pr','uni')) b ON a.id < b.id
JOIN (SELECT * FROM lexicon_words WHERE origin='islami' AND status='live' AND gender IN ('pr','uni')) c ON b.id < c.id
WHERE a.meaning <> b.meaning AND a.meaning <> c.meaning AND b.meaning <> c.meaning
ORDER BY random() LIMIT 150
ON CONFLICT (origin,name_key) DO NOTHING;

-- 3) Serving function (called by api/generate.js via supabase.rpc) --------------
-- Scalability: instead of ORDER BY random() (full scan + sort of the whole
-- filtered bucket, ~23ms @ ~1600 rows), we keep a static indexed random column
-- `rnd` and SEEK from a random point (two-pass wrap-around) → no full sort,
-- ~4x+ faster and scales with LIMIT not table size. Re-shuffle periodically:
--   UPDATE names_bank SET rnd = random();   (e.g. weekly cron)
ALTER TABLE names_bank ADD COLUMN IF NOT EXISTS rnd double precision;
UPDATE names_bank SET rnd = random() WHERE rnd IS NULL;
ALTER TABLE names_bank ALTER COLUMN rnd SET DEFAULT random();
ALTER TABLE names_bank ALTER COLUMN rnd SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_pick ON names_bank (origin, gender, length, rnd) WHERE status = 'live';

CREATE OR REPLACE FUNCTION pick_bank_names(
  p_origin text, p_gender text, p_length int, p_keyword text, p_limit int, p_exclude text[]
) RETURNS TABLE(name text, meaning text) LANGUAGE plpgsql VOLATILE AS $$
#variable_conflict use_column
DECLARE v_seed double precision := random();
BEGIN
  RETURN QUERY
  WITH pass1 AS (  -- rows at/after the random seed, in rnd order
    SELECT nb.name, nb.meaning, nb.rnd FROM names_bank nb
    WHERE nb.origin = p_origin AND nb.status = 'live'
      AND (p_gender IS NULL OR nb.gender = p_gender)
      AND (p_length IS NULL OR nb.length = p_length)
      AND nb.rnd >= v_seed
      AND (p_keyword IS NULL OR p_keyword = '' OR nb.meaning ILIKE '%'||p_keyword||'%'
           OR nb.name ILIKE '%'||p_keyword||'%'
           OR EXISTS (SELECT 1 FROM unnest(nb.theme_tags) t WHERE t ILIKE '%'||p_keyword||'%'))
      AND (p_exclude IS NULL OR NOT (nb.name = ANY(p_exclude)))
      AND NOT EXISTS (SELECT 1 FROM name_blocklist b
        WHERE nb.name ILIKE b.pattern
           OR EXISTS (SELECT 1 FROM unnest(nb.source_words) sw WHERE sw ILIKE b.pattern))
    ORDER BY nb.rnd LIMIT GREATEST(p_limit, 1)
  ),
  pass2 AS (  -- wrap-around: rows before the seed
    SELECT nb.name, nb.meaning, nb.rnd FROM names_bank nb
    WHERE nb.origin = p_origin AND nb.status = 'live'
      AND (p_gender IS NULL OR nb.gender = p_gender)
      AND (p_length IS NULL OR nb.length = p_length)
      AND nb.rnd < v_seed
      AND (p_keyword IS NULL OR p_keyword = '' OR nb.meaning ILIKE '%'||p_keyword||'%'
           OR nb.name ILIKE '%'||p_keyword||'%'
           OR EXISTS (SELECT 1 FROM unnest(nb.theme_tags) t WHERE t ILIKE '%'||p_keyword||'%'))
      AND (p_exclude IS NULL OR NOT (nb.name = ANY(p_exclude)))
      AND NOT EXISTS (SELECT 1 FROM name_blocklist b
        WHERE nb.name ILIKE b.pattern
           OR EXISTS (SELECT 1 FROM unnest(nb.source_words) sw WHERE sw ILIKE b.pattern))
    ORDER BY nb.rnd LIMIT GREATEST(p_limit, 1)
  )
  SELECT p.name, p.meaning FROM (
    SELECT name, meaning, rnd, 0 AS ord FROM pass1
    UNION ALL SELECT name, meaning, rnd, 1 AS ord FROM pass2
  ) p ORDER BY p.ord, p.rnd LIMIT GREATEST(p_limit, 1);
END;
$$;

-- 4) Coverage check ------------------------------------------------------------
CREATE OR REPLACE FUNCTION bank_has_origin(p_origin text) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM names_bank WHERE origin = p_origin AND status = 'live');
$$ LANGUAGE sql STABLE;
