// Minimal CSV parser + district-record lookup, ported from the original
// pa-district-map.html prototype's parseCSV/norm/loadData functions.
//
// This is intentionally a hand-rolled parser (handles quoted fields,
// embedded commas/newlines) rather than a dependency — the original file
// is small (a few dozen rows today, low hundreds at most once every PA
// district has a row) and this avoids pulling in a CSV library for
// something this scoped.

/** Parse raw CSV text into an array of row objects keyed by header. */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const dataRows = rows.filter((r) => r.length > 1 || r[0] !== '');
  if (!dataRows.length) return [];

  const header = dataRows.shift().map((h) => h.trim().toUpperCase());
  return dataRows.map((r) => {
    const obj = {};
    header.forEach((key, i) => {
      obj[key] = (r[i] || '').trim();
    });
    return obj;
  });
}

/**
 * Normalize a district name for matching: uppercase, strip "School
 * District" / "SD" suffixes and all non-alphanumeric characters. Lets
 * "Abington Heights SD" (baked geometry) match "Abington Heights School
 * District" (a CSV entered by hand) without exact-string fuss.
 */
export function normalizeDistrictName(name) {
  return (name || '')
    .toUpperCase()
    .replace(/SCHOOL DISTRICT|S\.?D\.?\b/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

// Accepts both the raw SharePoint-list wording and the already-normalized
// values used in district-master.csv, so whichever export format a future
// CSV comes in still lands on the same three buckets.
const STATUS_MAP = {
  client: 'active',
  'active pursuit': 'contracted',
  'past client': 'past',
  active: 'active',
  contracted: 'contracted',
  past: 'past',
  none: 'none',
};

/** "$40.0M" / "$34,070,773.00" / "12.6M" -> a plain number of dollars. */
export function parseMoney(s) {
  if (!s) return 0;
  const m = String(s)
    .replace(/[,$]/g, '')
    .match(/([\d.]+)\s*([kmb]?)/i);
  if (!m) return 0;
  const scale = { k: 1e3, m: 1e6, b: 1e9, '': 1 }[m[2].toLowerCase()];
  return (parseFloat(m[1]) || 0) * scale;
}

/** A plain number of dollars -> "$40.0M" / "$122K" / "$4,500" — the
 * inverse of parseMoney, used for derived totals (e.g. summing multiple
 * projects) that don't have an original hand-formatted string to fall
 * back on. */
export function formatMoney(n) {
  if (!n) return '$0';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * Pull every PROJECT_<n> a row actually has (PROJECT_1, PROJECT_2, ...
 * PROJECT_11, whatever) instead of a hardcoded slot count. Lets the CSV
 * grow a 4th, 5th, Nth project column for any district with zero code
 * changes here — add the columns in the sheet and they show up.
 */
function extractProjects(r) {
  const nums = new Set();
  Object.keys(r).forEach((key) => {
    const m = key.match(/^PROJECT_(\d+)$/);
    if (m) nums.add(Number(m[1]));
  });
  return [...nums]
    .sort((a, b) => a - b)
    .map((n) => ({
      name: r[`PROJECT_${n}`] || '',
      year: r[`YEAR_${n}`] || '',
      value: parseMoney(r[`VALUE_${n}`]),
      // Keep the original hand-entered string ("$40.0M") too — reformatting
      // the parsed number loses whatever precision/rounding whoever typed
      // it chose, so the raw string is what the UI should show; `value`
      // (the number) exists for summing into totalValue below.
      valueDisplay: r[`VALUE_${n}`] || '',
    }))
    .filter((p) => p.name);
}

/**
 * Fetch and parse district-data.csv into lookup maps keyed by AUN and by
 * normalized district name. AUN is preferred when present; today's export
 * doesn't have real AUNs populated yet, so matching effectively always
 * falls through to name matching for now — expected, not a bug. Once real
 * AUNs land in a future export this starts using them automatically, no
 * code change needed.
 *
 * Project count/value come from a dynamic PROJECT_<n>/YEAR_<n>/VALUE_<n>
 * scan (see extractProjects) — any number of project columns, not capped
 * at three. Add PROJECT_4/YEAR_4/VALUE_4 (etc.) to the CSV and they show
 * up automatically, no code change needed here or in the card UI.
 */
export async function loadDistrictData(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const text = await res.text();
  const rows = parseCSV(text);

  const byAun = {};
  const byName = {};

  rows.forEach((r) => {
    const rawStatus = (r.STATUS || '').toLowerCase().trim();
    const projects = extractProjects(r);

    const record = {
      status: STATUS_MAP[rawStatus] || 'none',
      company: r.COMPANY || '',
      website: r.WEBSITE || '',
      logo: r.LOGO && r.LOGO !== '[MISSING]' ? r.LOGO : '',
      logoWhite: r.LOGO_WHITE && r.LOGO_WHITE !== '[MISSING]' ? r.LOGO_WHITE : '',
      marketSector: r.MARKET_SECTOR || '',
      teamLead: r.TEAM_LEAD || '',
      projectType: r.PROJECT_TYPE || '',
      facilityType: r.FACILITY_TYPE || '',
      keyStats: r.KEY_STATS || '',
      // Newly wired fields — present in the CSV already but not parsed
      // into the record until now.
      enrollment: r.ENROLLMENT || '',
      sizeSqft: r.SIZE_SQFT || '',
      constructionCost: r.CONSTRUCTION_COST || '',
      constructionCostValue: parseMoney(r.CONSTRUCTION_COST),
      projects,
      projectCount: projects.length,
      totalValue: projects.reduce((sum, p) => sum + p.value, 0),
      // Full original row, untouched. Lets the UI (or a future feature)
      // reach any column — including ones added to the CSV later that
      // nothing above has been taught to parse yet — without another
      // round of "wire this field into the record" edits here.
      raw: r,
    };
    if (r.AUN) byAun[r.AUN] = record;
    if (r.DISTRICT) byName[normalizeDistrictName(r.DISTRICT)] = record;
  });

  return { byAun, byName };
}

/** Look up a district's CSV record, preferring AUN over name. */
export function matchDistrictRecord(data, name, aun) {
  if (!data) return null;
  if (aun && data.byAun[aun]) return data.byAun[aun];
  return data.byName[normalizeDistrictName(name)] || null;
}
