// =====================================================================
// packages/shared/src/localisation.ts
// =====================================================================
// Central config for country, stores, cuisines, and dietary requirements.
// Import from both web (Next.js) and mobile (Expo) apps via the shared
// package in your Turborepo workspace.
// =====================================================================

export type CountryCode = 'ZA' | 'GB' | 'FR' | 'AU' | 'AE';

export interface Store {
  name: string;
  /** Returns a deep-link URL for an ingredient or product search */
  deepLink: (query: string) => string;
}

export interface CountryConfig {
  code: CountryCode;
  name: string;
  currency: 'ZAR' | 'GBP' | 'EUR' | 'AUD' | 'AED';
  timezone: string; // IANA tz
  unitSystem: 'metric' | 'imperial';
  stores: Store[];
}

const enc = (q: string) => encodeURIComponent(q);

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    currency: 'ZAR',
    timezone: 'Africa/Johannesburg',
    unitSystem: 'metric',
    stores: [
      { name: 'Woolworths',       deepLink: q => `https://www.woolworths.co.za/cat?Ntt=${enc(q)}` },
      { name: 'Checkers Sixty60', deepLink: q => `https://www.sixty60.co.za/search?q=${enc(q)}` },
      { name: 'Pick n Pay',       deepLink: q => `https://www.pnp.co.za/pnpstorefront/search?q=${enc(q)}` },
    ],
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    timezone: 'Europe/London',
    unitSystem: 'metric',
    stores: [
      { name: 'Tesco',       deepLink: q => `https://www.tesco.com/groceries/en-GB/search?query=${enc(q)}` },
      { name: "Sainsbury's", deepLink: q => `https://www.sainsburys.co.uk/gol-ui/SearchResults/${enc(q)}` },
      { name: 'Ocado',       deepLink: q => `https://www.ocado.com/search?entry=${enc(q)}` },
    ],
  },
  FR: {
    code: 'FR',
    name: 'France',
    currency: 'EUR',
    timezone: 'Europe/Paris',
    unitSystem: 'metric',
    stores: [
      { name: 'Carrefour', deepLink: q => `https://www.carrefour.fr/s?q=${enc(q)}` },
      { name: 'Auchan',    deepLink: q => `https://www.auchan.fr/recherche?text=${enc(q)}` },
      { name: 'Monoprix',  deepLink: q => `https://courses.monoprix.fr/products?search=${enc(q)}` },
    ],
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    currency: 'AUD',
    // Default to Sydney; per-family timezone overrides this for Perth/Brisbane/etc.
    timezone: 'Australia/Sydney',
    unitSystem: 'metric',
    stores: [
      { name: 'Coles',          deepLink: q => `https://www.coles.com.au/search?q=${enc(q)}` },
      { name: 'Woolworths AU',  deepLink: q => `https://www.woolworths.com.au/shop/search/products?searchTerm=${enc(q)}` },
      { name: 'IGA',            deepLink: q => `https://www.iga.com.au/search/?q=${enc(q)}` },
    ],
  },
  AE: {
    code: 'AE',
    name: 'United Arab Emirates',
    currency: 'AED',
    timezone: 'Asia/Dubai',
    unitSystem: 'metric',
    stores: [
      { name: 'Carrefour UAE',     deepLink: q => `https://www.carrefouruae.com/mafuae/en/search?q=${enc(q)}` },
      { name: 'Lulu Hypermarket',  deepLink: q => `https://www.luluhypermarket.com/en-ae/search/?q=${enc(q)}` },
      { name: 'Spinneys',          deepLink: q => `https://www.spinneys.com/en-ae/catalogue/search/?q=${enc(q)}` },
    ],
  },
};

// ---------------------------------------------------------------------
// Cuisines
// ---------------------------------------------------------------------
export const CUISINES = [
  'south_african',
  'british',
  'french',
  'italian',
  'mediterranean',
  'middle_eastern',
  'indian',
  'asian',
  'chinese',
  'japanese',
  'thai',
  'mexican',
  'american',
  'comfort_food',
  'braai_bbq',
] as const;

export type Cuisine = typeof CUISINES[number];

export const CUISINE_LABELS: Record<Cuisine, string> = {
  south_african:  'South African',
  british:        'British',
  french:         'French',
  italian:        'Italian',
  mediterranean:  'Mediterranean',
  middle_eastern: 'Middle Eastern',
  indian:         'Indian',
  asian:          'Asian (general)',
  chinese:        'Chinese',
  japanese:       'Japanese',
  thai:           'Thai',
  mexican:        'Mexican',
  american:       'American',
  comfort_food:   'Comfort food',
  braai_bbq:      'Braai / BBQ',
};

// ---------------------------------------------------------------------
// Dietary requirements
// ---------------------------------------------------------------------
export const DIETARY_REQUIREMENTS = [
  'halal',
  'kosher',
  'vegetarian',
  'vegan',
  'pescatarian',
  'gluten_free',
  'dairy_free',
  'nut_free',
  'low_carb',
] as const;

export type DietaryRequirement = typeof DIETARY_REQUIREMENTS[number];

export const DIETARY_LABELS: Record<DietaryRequirement, string> = {
  halal:       'Halal',
  kosher:      'Kosher',
  vegetarian:  'Vegetarian',
  vegan:       'Vegan',
  pescatarian: 'Pescatarian',
  gluten_free: 'Gluten-free',
  dairy_free:  'Dairy-free',
  nut_free:    'Nut-free',
  low_carb:    'Low-carb',
};

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
export function getCountry(code: CountryCode): CountryConfig {
  return COUNTRIES[code];
}

export function getStoresFor(code: CountryCode): Store[] {
  return COUNTRIES[code].stores;
}
