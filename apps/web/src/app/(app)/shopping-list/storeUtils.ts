export type StoreKey = string;

export interface StoreConfig {
  key: StoreKey;
  label: string;
  shopUrl: string;
  searchUrl: (q: string) => string;
  badgeBg: string;
  badgeText: string;
  selectBg: string;
}

const ZA_STORES: StoreConfig[] = [
  {
    key: "woolworths",
    label: "Woolworths",
    shopUrl: "https://www.woolworths.co.za/cat/_/N-lllp31",
    searchUrl: (q) => `https://www.woolworths.co.za/cat?Ntt=${encodeURIComponent(q)}`,
    badgeBg: "bg-flame-light",
    badgeText: "text-flame-dark",
    selectBg: "#FDE8E0",
  },
  {
    key: "checkers",
    label: "Checkers / Sixty60",
    shopUrl: "https://www.sixty60.co.za/",
    searchUrl: (q) => `https://www.sixty60.co.za/search?q=${encodeURIComponent(q)}`,
    badgeBg: "bg-sapphire-light",
    badgeText: "text-sapphire",
    selectBg: "#E6F1FB",
  },
  {
    key: "pnp",
    label: "Pick n Pay",
    shopUrl: "https://www.pnp.co.za/",
    searchUrl: (q) => `https://www.pnp.co.za/pnpstorefront/search?q=${encodeURIComponent(q)}`,
    badgeBg: "bg-herb-light",
    badgeText: "text-herb",
    selectBg: "#E8F5E9",
  },
];

const UK_STORES: StoreConfig[] = [
  {
    key: "waitrose",
    label: "Waitrose",
    shopUrl: "https://www.waitrose.com/ecom/shop/browse/groceries",
    searchUrl: (q) => `https://www.waitrose.com/ecom/shop/search?&searchTerm=${encodeURIComponent(q)}`,
    badgeBg: "bg-herb-light",
    badgeText: "text-herb",
    selectBg: "#E8F5E9",
  },
  {
    key: "sainsburys",
    label: "Sainsbury's",
    shopUrl: "https://www.sainsburys.co.uk/gol-ui/groceries",
    searchUrl: (q) => `https://www.sainsburys.co.uk/gol-ui/SearchDisplayView?filters[keyword]=${encodeURIComponent(q)}`,
    badgeBg: "bg-turmeric-light",
    badgeText: "text-turmeric-dark",
    selectBg: "#FEF9EC",
  },
  {
    key: "marks_spencer",
    label: "M&S Food",
    shopUrl: "https://www.marksandspencer.com/c/food-to-order",
    searchUrl: (q) => `https://www.marksandspencer.com/c/food?q=${encodeURIComponent(q)}`,
    badgeBg: "bg-flame-light",
    badgeText: "text-flame-dark",
    selectBg: "#FDE8E0",
  },
  {
    key: "tesco",
    label: "Tesco",
    shopUrl: "https://www.tesco.com/groceries/",
    searchUrl: (q) => `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(q)}`,
    badgeBg: "bg-sapphire-light",
    badgeText: "text-sapphire",
    selectBg: "#E6F1FB",
  },
];

const FR_STORES: StoreConfig[] = [
  {
    key: "auchan",
    label: "Auchan",
    shopUrl: "https://www.auchan.fr/",
    searchUrl: (q) => `https://www.auchan.fr/recherche?text=${encodeURIComponent(q)}`,
    badgeBg: "bg-turmeric-light",
    badgeText: "text-turmeric-dark",
    selectBg: "#FEF9EC",
  },
  {
    key: "carrefour",
    label: "Carrefour",
    shopUrl: "https://www.carrefour.fr/",
    searchUrl: (q) => `https://www.carrefour.fr/s?q=${encodeURIComponent(q)}`,
    badgeBg: "bg-sapphire-light",
    badgeText: "text-sapphire",
    selectBg: "#E6F1FB",
  },
  {
    key: "monoprix",
    label: "Monoprix",
    shopUrl: "https://www.monoprix.fr/courses-en-ligne",
    searchUrl: (q) => `https://www.monoprix.fr/courses-en-ligne/recherche?search=${encodeURIComponent(q)}`,
    badgeBg: "bg-herb-light",
    badgeText: "text-herb",
    selectBg: "#E8F5E9",
  },
  {
    key: "lidl",
    label: "Lidl",
    shopUrl: "https://www.lidl.fr/",
    searchUrl: (q) => `https://www.lidl.fr/q/${encodeURIComponent(q)}`,
    badgeBg: "bg-flame-light",
    badgeText: "text-flame-dark",
    selectBg: "#FDE8E0",
  },
];

const AU_STORES: StoreConfig[] = [
  {
    key: "coles",
    label: "Coles",
    shopUrl: "https://www.coles.com.au/",
    searchUrl: (q) => `https://www.coles.com.au/search?q=${encodeURIComponent(q)}`,
    badgeBg: "bg-flame-light",
    badgeText: "text-flame-dark",
    selectBg: "#FDE8E0",
  },
  {
    key: "woolworths_au",
    label: "Woolworths AU",
    shopUrl: "https://www.woolworths.com.au/",
    searchUrl: (q) => `https://www.woolworths.com.au/shop/search/products?searchTerm=${encodeURIComponent(q)}`,
    badgeBg: "bg-herb-light",
    badgeText: "text-herb",
    selectBg: "#E8F5E9",
  },
  {
    key: "iga",
    label: "IGA",
    shopUrl: "https://www.iga.com.au/",
    searchUrl: (q) => `https://www.iga.com.au/search/?q=${encodeURIComponent(q)}`,
    badgeBg: "bg-sapphire-light",
    badgeText: "text-sapphire",
    selectBg: "#E6F1FB",
  },
];

const AE_STORES: StoreConfig[] = [
  {
    key: "carrefour_ae",
    label: "Carrefour UAE",
    shopUrl: "https://www.carrefouruae.com/mafuae/en/c/FVEG",
    searchUrl: (q) => `https://www.carrefouruae.com/mafuae/en/search?q=${encodeURIComponent(q)}`,
    badgeBg: "bg-sapphire-light",
    badgeText: "text-sapphire",
    selectBg: "#E6F1FB",
  },
  {
    key: "lulu",
    label: "Lulu Hypermarket",
    shopUrl: "https://www.luluhypermarket.com/en-ae/",
    searchUrl: (q) => `https://www.luluhypermarket.com/en-ae/search/?q=${encodeURIComponent(q)}`,
    badgeBg: "bg-herb-light",
    badgeText: "text-herb",
    selectBg: "#E8F5E9",
  },
  {
    key: "spinneys",
    label: "Spinneys",
    shopUrl: "https://www.spinneys.com/en-ae/",
    searchUrl: (q) => `https://www.spinneys.com/en-ae/catalogue/search/?q=${encodeURIComponent(q)}`,
    badgeBg: "bg-turmeric-light",
    badgeText: "text-turmeric-dark",
    selectBg: "#FEF9EC",
  },
];

export function getStoresByCountry(country: string | null | undefined): StoreConfig[] {
  switch (country) {
    case "GB": return UK_STORES;
    case "FR": return FR_STORES;
    case "AU": return AU_STORES;
    case "AE": return AE_STORES;
    default: return ZA_STORES;
  }
}

// Keep backward-compat export for existing imports
export const STORES = ZA_STORES;

// Woolworths: premium/specialty items, fresh herbs, quality dairy, citrus
const WOOLWORTHS_TERMS = [
  // Specialty cheeses
  "feta", "halloumi", "brie", "camembert", "parmesan", "parmigiano",
  "gruyere", "gruyère", "mascarpone", "crème fraîche", "creme fraiche",
  "ricotta", "mozzarella", "burrata", "gorgonzola",
  // Specialty meats / deli
  "prosciutto", "pancetta", "chorizo", "salami", "serrano", "bresaola",
  // Specialty condiments / sauces
  "truffle", "tahini", "capers", "anchov", "pesto", "harissa", "za'atar",
  "sumac", "ras el hanout", "dukkah",
  // Premium produce
  "asparagus", "rocket", "avocado", "avo", "baby spinach", "broccolini",
  "sugar snap", "edamame",
  // Grains / specialty
  "quinoa", "couscous", "arborio", "risotto rice", "freekeh", "farro",
  // Asian pantry
  "sesame oil", "truffle oil", "oyster sauce", "fish sauce", "hoisin",
  "miso", "tempeh", "nori",
  // Exotic fruit
  "pomegranate", "dragon fruit", "passion fruit",
  // Fresh herbs (Woolworths has the best fresh herb selection in SA)
  "fresh coriander", "cilantro", "fresh parsley", "fresh basil",
  "fresh mint", "fresh thyme", "fresh dill", "fresh chives",
  "fresh rosemary", "fresh sage", "fresh tarragon",
  // Premium fresh dairy
  "fresh cream", "double cream", "whipping cream", "crème",
  // Citrus (Woolworths stocks these reliably)
  "lemon", "lime", "zest",
  // Fresh ginger (specialty fresh items)
  "fresh ginger",
];

// Pick n Pay: dry staples, pantry basics, canned goods, common dairy, spices
const PNP_TERMS = [
  "flour", "sugar", "brown sugar", "icing sugar", "castor sugar",
  "salt", "rice", "basmati", "jasmine rice",
  "pasta", "spaghetti", "penne", "macaroni", "fettuccine", "linguine",
  "tagliatelle", "rigatoni", "fusilli", "farfalle", "noodles",
  "lentils", "chickpeas", "kidney beans", "black beans", "cannellini",
  "split peas", "dried beans",
  "milk", "butter", "eggs", "egg", "cheddar", "gouda", "cream cheese",
  "olive oil", "vegetable oil", "sunflower oil", "canola oil",
  "vinegar", "balsamic", "apple cider vinegar", "red wine vinegar",
  "white wine vinegar",
  "tomato paste", "passata", "tomato purée", "tomato puree",
  "coconut cream", "coconut milk", "evaporated milk", "condensed milk",
  "soy sauce", "worcestershire", "tabasco", "hot sauce", "mustard",
  "ketchup", "mayonnaise", "relish",
  "stock", "broth", "stock cube", "stock powder", "bouillon",
  "baking powder", "baking soda", "bicarbonate", "yeast", "cornstarch",
  "cornflour", "maizena", "cream of tartar",
  "cumin", "coriander seed", "turmeric", "paprika", "cayenne", "chilli",
  "chili", "cinnamon", "nutmeg", "cloves", "cardamom", "garam masala",
  "curry powder", "curry paste", "mixed spice", "allspice",
  "oregano", "mixed herbs", "bay leaf", "bay leaves", "dried thyme",
  "dried rosemary", "dried sage", "dried parsley", "dried dill",
  "onion", "garlic", "potato", "sweet potato", "carrot", "celery",
  "butternut", "pumpkin", "aubergine", "eggplant", "beetroot",
  "bread", "rolls", "pita", "wraps", "tortillas", "crackers", "crispbread",
  "tinned tomatoes", "canned tomatoes", "crushed tomatoes", "whole tomatoes",
  "honey", "golden syrup", "treacle", "maple syrup", "agave",
  "chocolate", "cocoa", "dark chocolate", "milk chocolate", "vanilla",
  "breadcrumbs", "panko",
  "oil spray", "cooking spray",
  "peanut butter", "almond butter",
  "oats", "oatmeal", "granola", "muesli",
  // Spices not covered above
  "pepper", "black pepper", "white pepper", "mixed peppercorn",
  "ginger", "ground ginger", "five spice", "smoked paprika",
  // Generic oil catch-all (must come after specific oils like sesame oil / olive oil in woolworths)
  "cooking oil", "frying oil",
  // Tinned / jarred basics
  "chopped tomatoes", "diced tomatoes", "tinned", "canned",
  "jar of", "tin of",
];

// ZA: smart assignment. Non-ZA: first store in list (no term-based logic yet)
export function assignStore(ingredientName: string, country?: string | null): StoreKey {
  if (country && country !== "ZA") {
    return getStoresByCountry(country)[0]?.key ?? "checkers";
  }
  const name = ingredientName.toLowerCase();
  if (WOOLWORTHS_TERMS.some((t) => name.includes(t))) return "woolworths";
  if (PNP_TERMS.some((t) => name.includes(t))) return "pnp";
  return "checkers";
}
