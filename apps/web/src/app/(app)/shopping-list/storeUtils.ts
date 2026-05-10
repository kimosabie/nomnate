export type StoreKey = "woolworths" | "checkers" | "pnp";

export const STORES: {
  key: StoreKey;
  label: string;
  shopUrl: string;
  searchUrl: (q: string) => string;
  badgeBg: string;
  badgeText: string;
  selectBg: string;
}[] = [
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

// Default to Checkers/Sixty60 — fresh produce, meat, dairy, general grocery
export function assignStore(ingredientName: string): StoreKey {
  const name = ingredientName.toLowerCase();
  if (WOOLWORTHS_TERMS.some((t) => name.includes(t))) return "woolworths";
  if (PNP_TERMS.some((t) => name.includes(t))) return "pnp";
  return "checkers";
}
