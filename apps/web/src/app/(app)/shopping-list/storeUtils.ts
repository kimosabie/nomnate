export type StoreKey = "woolworths" | "sixty60" | "pnp";

export const STORES = [
  {
    key: "woolworths" as StoreKey,
    label: "Woolworths",
    shopUrl: "https://www.woolworths.co.za/cat/_/N-lllp31",
    searchUrl: (q: string) =>
      `https://www.woolworths.co.za/cat?Ntt=${encodeURIComponent(q)}`,
    headerBg: "bg-[#f5f0eb]",
    headerText: "text-[#4a3728]",
    countBg: "bg-[#e8ddd4] text-[#4a3728]",
  },
  {
    key: "sixty60" as StoreKey,
    label: "Sixty60",
    shopUrl: "https://www.sixty60.co.za/",
    searchUrl: (q: string) =>
      `https://www.sixty60.co.za/search?q=${encodeURIComponent(q)}`,
    headerBg: "bg-[#ffe600]",
    headerText: "text-[#1a1a1a]",
    countBg: "bg-[#e5cf00] text-[#1a1a1a]",
  },
  {
    key: "pnp" as StoreKey,
    label: "Pick n Pay",
    shopUrl: "https://www.pnp.co.za/",
    searchUrl: (q: string) =>
      `https://www.pnp.co.za/pnpstorefront/search?q=${encodeURIComponent(q)}`,
    headerBg: "bg-[#e2001a]",
    headerText: "text-white",
    countBg: "bg-[#bf0016] text-white",
  },
] as const;

// Woolworths: specialty, premium, or hard-to-find items
const WOOLWORTHS_TERMS = [
  "feta", "halloumi", "brie", "camembert", "parmesan", "parmigiano",
  "gruyere", "gruyère", "mascarpone", "crème fraîche", "creme fraiche",
  "ricotta", "mozzarella", "burrata", "gorgonzola",
  "prosciutto", "pancetta", "chorizo", "salami", "serrano", "bresaola",
  "truffle", "tahini", "capers", "anchov", "pesto", "harissa", "za'atar",
  "sumac", "ras el hanout", "dukkah",
  "asparagus", "rocket", "avocado", "avo", "baby spinach", "broccolini",
  "sugar snap", "edamame",
  "quinoa", "couscous", "arborio", "risotto rice", "freekeh", "farro",
  "sesame oil", "truffle oil", "oyster sauce", "fish sauce", "hoisin",
  "miso", "tempeh", "nori", "tahini",
  "pomegranate", "dragon fruit", "passion fruit",
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
];

// Default to Sixty60 — fresh produce, meat, dairy, general grocery
export function assignStore(ingredientName: string): StoreKey {
  const name = ingredientName.toLowerCase();
  if (WOOLWORTHS_TERMS.some((t) => name.includes(t))) return "woolworths";
  if (PNP_TERMS.some((t) => name.includes(t))) return "pnp";
  return "sixty60";
}
