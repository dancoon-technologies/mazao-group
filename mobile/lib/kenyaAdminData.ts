/**
 * Kenya administrative hierarchy aligned with backend locations (regions, counties, sub_counties).
 * Used to map Nominatim reverse-geocode results (county name) to our region/county/subcounty names.
 */

export interface CountyMatch {
  region: string;
  county: string;
  subcounties: string[];
}

/** Normalize for lookup: lowercase, remove " county" / " city" */
function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\s+county\b/gi, '')
    .replace(/\s+city\b/gi, '')
    .trim();
}

/** Build lookup: normalized county key -> { region, county, subcounties } */
const COUNTY_LIST: { region: string; county: string; subcounties: string[] }[] = [
  { region: 'Central', county: 'Kiambu', subcounties: ['Gatundu North', 'Gatundu South', 'Githunguri', 'Juja', 'Kabete', 'Kiambaa', 'Kiambu', 'Kikuyu', 'Lari', 'Limuru', 'Ruiru', 'Thika Town'] },
  { region: 'Central', county: "Murang'a", subcounties: ['Gatanga', 'Kahuro', 'Kandara', 'Kangema', 'Kigumo', 'Kiharu', 'Mathioya', "Murang'a South"] },
  { region: 'Central', county: 'Kirinyaga', subcounties: ['Kirinyaga Central', 'Kirinyaga East', 'Kirinyaga West', 'Mwea East', 'Mwea West'] },
  { region: 'Central', county: 'Nyeri', subcounties: ['Kieni East', 'Kieni West', 'Mathira East', 'Mathira West', 'Mukurweini', 'Nyeri Town', 'Othaya', 'Tetu'] },
  { region: 'Central', county: 'Nyandarua', subcounties: ['Kinangop', 'Kipipiri', 'Ndaragwa', 'Ol Kalou', 'Ol Joro Orok'] },
  { region: 'Coast', county: 'Mombasa', subcounties: ['Changamwe', 'Jomvu', 'Kisauni', 'Likoni', 'Mvita', 'Nyali'] },
  { region: 'Coast', county: 'Kwale', subcounties: ['Kinango', 'Lunga Lunga', 'Matuga', 'Msambweni'] },
  { region: 'Coast', county: 'Kilifi', subcounties: ['Ganze', 'Kaloleni', 'Kilifi North', 'Kilifi South', 'Magarini', 'Malindi', 'Rabai'] },
  { region: 'Coast', county: 'Tana River', subcounties: ['Bura', 'Galole', 'Garsen'] },
  { region: 'Coast', county: 'Lamu', subcounties: ['Lamu East', 'Lamu West'] },
  { region: 'Coast', county: 'Taita-Taveta', subcounties: ['Mwatate', 'Taveta', 'Voi', 'Wundanyi'] },
  { region: 'Eastern', county: 'Meru', subcounties: ['Buuri', 'Igembe Central', 'Igembe North', 'Igembe South', 'Imenti Central', 'Imenti North', 'Imenti South', 'Tigania East', 'Tigania West'] },
  { region: 'Eastern', county: 'Tharaka-Nithi', subcounties: ['Chuka', 'Maara', 'Tharaka'] },
  { region: 'Eastern', county: 'Embu', subcounties: ['Manyatta', 'Mbeere North', 'Mbeere South', 'Runyenjes'] },
  { region: 'Eastern', county: 'Kitui', subcounties: ['Kitui Central', 'Kitui East', 'Kitui Rural', 'Kitui South', 'Kitui West', 'Mwingi Central', 'Mwingi North', 'Mwingi West'] },
  { region: 'Eastern', county: 'Machakos', subcounties: ['Kathiani', 'Machakos Town', 'Masinga', 'Matungulu', 'Mavoko', 'Mwala', 'Yatta'] },
  { region: 'Eastern', county: 'Makueni', subcounties: ['Kaiti', 'Kibwezi East', 'Kibwezi West', 'Kilome', 'Makueni', 'Mbooni'] },
  { region: 'Eastern', county: 'Marsabit', subcounties: ['Laisamis', 'Moyale', 'North Horr', 'Saku'] },
  { region: 'Eastern', county: 'Isiolo', subcounties: ['Garbatulla', 'Isiolo', 'Merti'] },
  { region: 'North Eastern', county: 'Garissa', subcounties: ['Balambala', 'Dadaab', 'Fafi', 'Garissa Township', 'Hulugho', 'Ijara', 'Lagdera'] },
  { region: 'North Eastern', county: 'Wajir', subcounties: ['Eldas', 'Tarbaj', 'Wajir East', 'Wajir North', 'Wajir South', 'Wajir West'] },
  { region: 'North Eastern', county: 'Mandera', subcounties: ['Banissa', 'Lafey', 'Mandera East', 'Mandera North', 'Mandera South', 'Mandera West'] },
  { region: 'Nairobi', county: 'Nairobi', subcounties: ['Dagoretti North', 'Dagoretti South', 'Embakasi Central', 'Embakasi East', 'Embakasi North', 'Embakasi South', 'Embakasi West', 'Kamukunji', 'Kasarani', 'Kibra', 'Langata', 'Makadara', 'Mathare', 'Roysambu', 'Ruaraka', 'Starehe', 'Westlands'] },
  { region: 'Rift Valley', county: 'Nakuru', subcounties: ['Bahati', 'Gilgil', 'Kuresoi North', 'Kuresoi South', 'Molo', 'Naivasha', 'Nakuru Town East', 'Nakuru Town West', 'Njoro', 'Rongai', 'Subukia'] },
  { region: 'Rift Valley', county: 'Uasin Gishu', subcounties: ['Ainabkoi', 'Kapseret', 'Kesses', 'Moiben', 'Soy', 'Turbo'] },
  { region: 'Rift Valley', county: 'Nandi', subcounties: ['Aldai', 'Chesumei', 'Emgwen', 'Mosop', 'Nandi Hills', 'Tindiret'] },
  { region: 'Rift Valley', county: 'Baringo', subcounties: ['Baringo Central', 'Baringo North', 'Baringo South', 'Eldama Ravine', 'Mogotio', 'Tiaty'] },
  { region: 'Rift Valley', county: 'Laikipia', subcounties: ['Laikipia Central', 'Laikipia East', 'Laikipia North', 'Laikipia West', 'Nyahururu'] },
  { region: 'Rift Valley', county: 'Samburu', subcounties: ['Samburu East', 'Samburu North', 'Samburu West'] },
  { region: 'Rift Valley', county: 'Trans-Nzoia', subcounties: ['Cherangany', 'Endebess', 'Kiminini', 'Kwanza', 'Saboti'] },
  { region: 'Rift Valley', county: 'West Pokot', subcounties: ['Kipkomo', 'Pokot Central', 'Pokot South', 'Sigor'] },
  { region: 'Rift Valley', county: 'Elgeyo-Marakwet', subcounties: ['Keiyo North', 'Keiyo South', 'Marakwet East', 'Marakwet West'] },
  { region: 'Rift Valley', county: 'Kericho', subcounties: ['Ainamoi', 'Belgut', 'Bureti', 'Kipkelion East', 'Kipkelion West', 'Soin Sigowet'] },
  { region: 'Rift Valley', county: 'Bomet', subcounties: ['Bomet Central', 'Bomet East', 'Chepalungu', 'Konoin', 'Sotik'] },
  { region: 'Rift Valley', county: 'Narok', subcounties: ['Narok East', 'Narok North', 'Narok South', 'Narok West', 'Transmara East', 'Transmara West'] },
  { region: 'Rift Valley', county: 'Kajiado', subcounties: ['Isinya', 'Kajiado Central', 'Kajiado North', 'Loitokitok', 'Mashuuru'] },
  { region: 'Rift Valley', county: 'Turkana', subcounties: ['Loima', 'Turkana Central', 'Turkana North', 'Turkana South', 'Turkana West'] },
  { region: 'Western', county: 'Kakamega', subcounties: ['Butere', 'Kakamega Central', 'Kakamega East', 'Kakamega North', 'Kakamega South', 'Khwisero', 'Lugari', 'Likuyani', 'Lurambi', 'Matete', 'Mumias', 'Mutungu', 'Navakholo'] },
  { region: 'Western', county: 'Vihiga', subcounties: ['Emuhaya', 'Hamisi', 'Luanda', 'Sabatia', 'Vihiga'] },
  { region: 'Western', county: 'Bungoma', subcounties: ['Bumula', 'Kabuchai', 'Kanduyi', 'Kimilil', 'Mt Elgon', 'Sirisia', 'Tongaren', 'Webuye East', 'Webuye West'] },
  { region: 'Western', county: 'Busia', subcounties: ['Budalangi', 'Butula', 'Funyula', 'Nambale', 'Teso North', 'Teso South'] },
  { region: 'Nyanza', county: 'Kisumu', subcounties: ['Kisumu Central', 'Kisumu East', 'Kisumu West', 'Muhoroni', 'Nyakach', 'Nyando', 'Seme'] },
  { region: 'Nyanza', county: 'Siaya', subcounties: ['Alego Usonga', 'Bondo', 'Gem', 'Rarieda', 'Ugenya', 'Unguja'] },
  { region: 'Nyanza', county: 'Homa Bay', subcounties: ['Homa Bay Town', 'Kabondo', 'Karachuonyo', 'Kasipul', 'Mbita', 'Ndhiwa', 'Rangwe', 'Suba'] },
  { region: 'Nyanza', county: 'Migori', subcounties: ['Awendo', 'Kuria East', 'Kuria West', 'Mabera', 'Ntimaru', 'Rongo', 'Suna East', 'Suna West', 'Uriri'] },
  { region: 'Nyanza', county: 'Kisii', subcounties: ['Bobasi', 'Bomachoge Borabu', 'Bomachoge Chache', 'Kitutu Chache North', 'Kitutu Chache South', 'Nyaribari Chache', 'Nyaribari Masaba'] },
  { region: 'Nyanza', county: 'Nyamira', subcounties: ['Borabu', 'Manga', 'Masaba North', 'Nyamira North', 'Nyamira South'] },
];

const _MAP = new Map<string, CountyMatch>();
COUNTY_LIST.forEach(({ region, county, subcounties }) => {
  const key = norm(county);
  if (!_MAP.has(key)) _MAP.set(key, { region, county, subcounties });
  const withApostrophe = county.replace(/'/g, '');
  if (withApostrophe !== county && !_MAP.has(norm(withApostrophe))) _MAP.set(norm(withApostrophe), { region, county, subcounties });
});

/** Normalize for subcounty match: lowercase, remove common suffixes */
function normSub(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\s+sub-?county\b/gi, '')
    .replace(/\s+constituency\b/gi, '')
    .replace(/\s+ward\b/gi, '')
    .trim();
}

/** Match a raw string (from Nominatim) to one of the known subcounty names. Returns the canonical subcounty name or null. */
export function fuzzyMatchSubcounty(rawString: string | undefined, subcounties: string[]): string | null {
  if (!rawString || !subcounties.length) return null;
  const normalized = normSub(rawString);
  if (!normalized) return null;
  const normalizedList = subcounties.map((sc) => ({ original: sc, norm: normSub(sc) }));
  const exact = normalizedList.find(({ norm }) => norm === normalized);
  if (exact) return exact.original;
  const contains = normalizedList.find(
    ({ norm }) => norm.includes(normalized) || normalized.includes(norm)
  );
  if (contains) return contains.original;
  const wordMatch = normalizedList.find(({ norm }) => {
    const rawWords = normalized.split(/\s+/);
    const subWords = norm.split(/\s+/);
    return rawWords.some((w) => w.length > 2 && (norm.startsWith(w) || subWords.some((sw) => sw.startsWith(w) || w.startsWith(sw))));
  });
  if (wordMatch) return wordMatch.original;
  return null;
}

/** Direct and fuzzy lookup: "Nairobi City County" / "Kiambu" -> { region, county, subcounties } */
export function fuzzyMatchCounty(detectedString: string | undefined): CountyMatch | null {
  if (!detectedString) return null;
  const normalized = norm(detectedString);
  const direct = _MAP.get(normalized);
  if (direct) return direct;
  for (const [key, value] of _MAP) {
    if (normalized.includes(key) || key.includes(normalized)) return value;
  }
  return null;
}

export { COUNTY_LIST };
