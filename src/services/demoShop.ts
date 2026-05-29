export interface ProductVariant {
  id: string;
  label: string;
}

export interface Seller {
  id: string;
  name: string;
  avatar: string;
  cover: string;
  bio: string;
  rating: number;
  followers: number;
  verified: boolean;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice: number;
  currency: string;
  images: string[];
  rating: number;
  reviewsCount: number;
  soldCount: number;
  sellerId: string;
  shopName: string;
  shopAvatar: string;
  category: ProductCategory;
  freeShipping: boolean;
  variants: ProductVariant[];
  badges: string[];
  onSale: boolean;
}

export type ProductCategory =
  | "all"
  | "fashion"
  | "beauty"
  | "tech"
  | "home"
  | "fitness"
  | "accessories";

export interface ShopCategory {
  id: ProductCategory;
  label: string;
  icon: string;
}

export const SHOP_CATEGORIES: ShopCategory[] = [
  { id: "all", label: "Tout", icon: "✨" },
  { id: "fashion", label: "Mode", icon: "👗" },
  { id: "beauty", label: "Beauté", icon: "💄" },
  { id: "tech", label: "Tech", icon: "🎧" },
  { id: "home", label: "Maison", icon: "🛋️" },
  { id: "fitness", label: "Sport", icon: "🏋️" },
  { id: "accessories", label: "Accessoires", icon: "👜" },
];

const SELLERS: Seller[] = [
  {
    id: "seller-urban",
    name: "Urban Thread",
    avatar: "https://i.pravatar.cc/200?img=33",
    cover: "https://picsum.photos/seed/urbancover/900/400",
    bio: "Streetwear & denim premium. Expédition sous 48h.",
    rating: 4.8,
    followers: 128400,
    verified: true,
  },
  {
    id: "seller-glow",
    name: "Glow Lab",
    avatar: "https://i.pravatar.cc/200?img=44",
    cover: "https://picsum.photos/seed/glowcover/900/400",
    bio: "Skincare clean & cruelty-free. Approuvé dermato.",
    rating: 4.9,
    followers: 215300,
    verified: true,
  },
  {
    id: "seller-sound",
    name: "SoundPeak",
    avatar: "https://i.pravatar.cc/200?img=51",
    cover: "https://picsum.photos/seed/soundcover/900/400",
    bio: "Audio & wearables. Garantie 2 ans.",
    rating: 4.7,
    followers: 342900,
    verified: true,
  },
  {
    id: "seller-maison",
    name: "Maison Co",
    avatar: "https://i.pravatar.cc/200?img=12",
    cover: "https://picsum.photos/seed/maisoncover/900/400",
    bio: "Déco & accessoires lifestyle. Made with care.",
    rating: 4.6,
    followers: 89200,
    verified: false,
  },
  {
    id: "seller-flex",
    name: "FlexFit",
    avatar: "https://i.pravatar.cc/200?img=20",
    cover: "https://picsum.photos/seed/flexcover/900/400",
    bio: "Équipement sport & bien-être. Bougez mieux.",
    rating: 4.8,
    followers: 156700,
    verified: true,
  },
];

// Maps a shop display name to its seller id (demo products use shopName).
const SHOP_NAME_TO_SELLER: Record<string, string> = {
  "Urban Thread": "seller-urban",
  "Glow Lab": "seller-glow",
  SoundPeak: "seller-sound",
  "Maison Co": "seller-maison",
  FlexFit: "seller-flex",
};

export function getSellers(): Seller[] {
  return SELLERS;
}

export function getSellerById(id: string): Seller | undefined {
  return SELLERS.find(s => s.id === id);
}

type SeedProduct = Omit<Product, "sellerId" | "onSale">;

const SEED_PRODUCTS: SeedProduct[] = [
  {
    id: "p1",
    title: "Veste oversize en denim premium",
    description:
      "Veste en denim épais coupe oversize, lavage vintage. Coutures renforcées, poches plaquées. Pièce phare de la saison, portée par les créateurs.",
    price: 49.9,
    originalPrice: 89.9,
    currency: "€",
    images: [
      "https://picsum.photos/seed/denim1/600/800",
      "https://picsum.photos/seed/denim2/600/800",
      "https://picsum.photos/seed/denim3/600/800",
    ],
    rating: 4.8,
    reviewsCount: 2143,
    soldCount: 12400,
    shopName: "Urban Thread",
    shopAvatar: "https://i.pravatar.cc/100?img=33",
    category: "fashion",
    freeShipping: true,
    variants: [
      { id: "xs", label: "XS" },
      { id: "s", label: "S" },
      { id: "m", label: "M" },
      { id: "l", label: "L" },
      { id: "xl", label: "XL" },
    ],
    badges: ["Coup de cœur", "Livraison gratuite"],
  },
  {
    id: "p2",
    title: "Sérum éclat vitamine C 30ml",
    description:
      "Sérum concentré en vitamine C stabilisée et acide hyaluronique. Unifie le teint, réduit les taches, hydrate en profondeur. Testé dermatologiquement.",
    price: 18.5,
    originalPrice: 34.0,
    currency: "€",
    images: [
      "https://picsum.photos/seed/serum1/600/800",
      "https://picsum.photos/seed/serum2/600/800",
    ],
    rating: 4.9,
    reviewsCount: 5821,
    soldCount: 38900,
    shopName: "Glow Lab",
    shopAvatar: "https://i.pravatar.cc/100?img=44",
    category: "beauty",
    freeShipping: true,
    variants: [
      { id: "30ml", label: "30 ml" },
      { id: "50ml", label: "50 ml" },
    ],
    badges: ["Best-seller", "Livraison gratuite"],
  },
  {
    id: "p3",
    title: "Écouteurs sans fil ANC Pro",
    description:
      "Réduction de bruit active, 36h d'autonomie avec le boîtier, son Hi-Fi, appairage instantané. Résistants à l'eau IPX5. Idéal sport et trajets.",
    price: 39.99,
    originalPrice: 79.99,
    currency: "€",
    images: [
      "https://picsum.photos/seed/buds1/600/800",
      "https://picsum.photos/seed/buds2/600/800",
      "https://picsum.photos/seed/buds3/600/800",
    ],
    rating: 4.7,
    reviewsCount: 9342,
    soldCount: 56200,
    shopName: "SoundPeak",
    shopAvatar: "https://i.pravatar.cc/100?img=51",
    category: "tech",
    freeShipping: true,
    variants: [
      { id: "black", label: "Noir" },
      { id: "white", label: "Blanc" },
      { id: "purple", label: "Violet" },
    ],
    badges: ["-50%", "Livraison gratuite"],
  },
  {
    id: "p4",
    title: "Lampe de bureau LED tactile",
    description:
      "Lampe LED à intensité réglable, 3 températures de couleur, port USB intégré, bras articulé. Design minimaliste pour bureau ou chevet.",
    price: 24.9,
    originalPrice: 39.9,
    currency: "€",
    images: [
      "https://picsum.photos/seed/lamp1/600/800",
      "https://picsum.photos/seed/lamp2/600/800",
    ],
    rating: 4.6,
    reviewsCount: 1287,
    soldCount: 8700,
    shopName: "Maison Co",
    shopAvatar: "https://i.pravatar.cc/100?img=12",
    category: "home",
    freeShipping: false,
    variants: [
      { id: "white", label: "Blanc" },
      { id: "black", label: "Noir" },
    ],
    badges: ["Nouveau"],
  },
  {
    id: "p5",
    title: "Tapis de yoga antidérapant 6mm",
    description:
      "Tapis épais en TPE écologique, double face antidérapante, sangle de transport incluse. Amorti optimal pour yoga, pilates et fitness.",
    price: 21.0,
    originalPrice: 35.0,
    currency: "€",
    images: [
      "https://picsum.photos/seed/yoga1/600/800",
      "https://picsum.photos/seed/yoga2/600/800",
    ],
    rating: 4.8,
    reviewsCount: 3401,
    soldCount: 19800,
    shopName: "FlexFit",
    shopAvatar: "https://i.pravatar.cc/100?img=20",
    category: "fitness",
    freeShipping: true,
    variants: [
      { id: "purple", label: "Violet" },
      { id: "teal", label: "Turquoise" },
      { id: "gray", label: "Gris" },
    ],
    badges: ["Livraison gratuite"],
  },
  {
    id: "p6",
    title: "Sac à bandoulière cuir vegan",
    description:
      "Sac compact en cuir vegan, bandoulière ajustable, fermeture aimantée, intérieur doublé. Parfait pour le quotidien, format téléphone + essentiels.",
    price: 32.9,
    originalPrice: 59.9,
    currency: "€",
    images: [
      "https://picsum.photos/seed/bag1/600/800",
      "https://picsum.photos/seed/bag2/600/800",
      "https://picsum.photos/seed/bag3/600/800",
    ],
    rating: 4.7,
    reviewsCount: 1903,
    soldCount: 11200,
    shopName: "Maison Co",
    shopAvatar: "https://i.pravatar.cc/100?img=12",
    category: "accessories",
    freeShipping: true,
    variants: [
      { id: "tan", label: "Camel" },
      { id: "black", label: "Noir" },
      { id: "red", label: "Rouge" },
    ],
    badges: ["Tendance", "Livraison gratuite"],
  },
  {
    id: "p7",
    title: "Hoodie unisexe coton bio",
    description:
      "Sweat à capuche épais 380g, coton biologique brossé, coupe relax. Cordon de serrage, poche kangourou. Doux et chaud, ultra confortable.",
    price: 34.0,
    originalPrice: 55.0,
    currency: "€",
    images: [
      "https://picsum.photos/seed/hoodie1/600/800",
      "https://picsum.photos/seed/hoodie2/600/800",
    ],
    rating: 4.9,
    reviewsCount: 4210,
    soldCount: 27600,
    shopName: "Urban Thread",
    shopAvatar: "https://i.pravatar.cc/100?img=33",
    category: "fashion",
    freeShipping: true,
    variants: [
      { id: "s", label: "S" },
      { id: "m", label: "M" },
      { id: "l", label: "L" },
      { id: "xl", label: "XL" },
    ],
    badges: ["Best-seller"],
  },
  {
    id: "p8",
    title: "Palette maquillage 18 teintes",
    description:
      "Palette de fards à paupières 18 teintes mates et satinées, pigmentation intense, longue tenue. Miroir intégré, formule cruelty-free.",
    price: 15.9,
    originalPrice: 29.9,
    currency: "€",
    images: [
      "https://picsum.photos/seed/palette1/600/800",
      "https://picsum.photos/seed/palette2/600/800",
    ],
    rating: 4.6,
    reviewsCount: 2876,
    soldCount: 21300,
    shopName: "Glow Lab",
    shopAvatar: "https://i.pravatar.cc/100?img=44",
    category: "beauty",
    freeShipping: false,
    variants: [
      { id: "warm", label: "Tons chauds" },
      { id: "cool", label: "Tons froids" },
    ],
    badges: ["-47%"],
  },
  {
    id: "p9",
    title: "Montre connectée sport AMOLED",
    description:
      'Écran AMOLED 1.43", suivi cardiaque et SpO2, 100+ modes sport, GPS, autonomie 14 jours, étanche 5ATM. Notifications et appels Bluetooth.',
    price: 45.0,
    originalPrice: 99.0,
    currency: "€",
    images: [
      "https://picsum.photos/seed/watch1/600/800",
      "https://picsum.photos/seed/watch2/600/800",
      "https://picsum.photos/seed/watch3/600/800",
    ],
    rating: 4.7,
    reviewsCount: 7654,
    soldCount: 41800,
    shopName: "SoundPeak",
    shopAvatar: "https://i.pravatar.cc/100?img=51",
    category: "tech",
    freeShipping: true,
    variants: [
      { id: "black", label: "Noir" },
      { id: "silver", label: "Argent" },
      { id: "gold", label: "Or rose" },
    ],
    badges: ["Coup de cœur", "Livraison gratuite"],
  },
  {
    id: "p10",
    title: "Bouteille isotherme 750ml",
    description:
      "Gourde inox double paroi, garde le froid 24h et le chaud 12h. Bouchon anti-fuite, sans BPA. Idéale sport, bureau et voyage.",
    price: 16.5,
    originalPrice: 27.0,
    currency: "€",
    images: [
      "https://picsum.photos/seed/bottle1/600/800",
      "https://picsum.photos/seed/bottle2/600/800",
    ],
    rating: 4.8,
    reviewsCount: 1564,
    soldCount: 9900,
    shopName: "FlexFit",
    shopAvatar: "https://i.pravatar.cc/100?img=20",
    category: "fitness",
    freeShipping: false,
    variants: [
      { id: "matteblack", label: "Noir mat" },
      { id: "sky", label: "Bleu ciel" },
      { id: "sand", label: "Sable" },
    ],
    badges: ["Nouveau"],
  },
  {
    id: "p11",
    title: "Lunettes de soleil polarisées",
    description:
      "Verres polarisés UV400, monture légère acétate, étui rigide inclus. Style intemporel qui convient à toutes les formes de visage.",
    price: 19.9,
    originalPrice: 39.9,
    currency: "€",
    images: [
      "https://picsum.photos/seed/sun1/600/800",
      "https://picsum.photos/seed/sun2/600/800",
    ],
    rating: 4.5,
    reviewsCount: 982,
    soldCount: 7400,
    shopName: "Maison Co",
    shopAvatar: "https://i.pravatar.cc/100?img=12",
    category: "accessories",
    freeShipping: true,
    variants: [
      { id: "black", label: "Noir" },
      { id: "tortoise", label: "Écaille" },
    ],
    badges: ["Livraison gratuite"],
  },
  {
    id: "p12",
    title: "Coussin déco velours côtelé",
    description:
      "Housse de coussin en velours côtelé doux, fermeture éclair invisible, 45x45cm. Ajoute une touche cosy à ton canapé ou ton lit.",
    price: 12.9,
    originalPrice: 22.0,
    currency: "€",
    images: [
      "https://picsum.photos/seed/cushion1/600/800",
      "https://picsum.photos/seed/cushion2/600/800",
    ],
    rating: 4.7,
    reviewsCount: 654,
    soldCount: 5300,
    shopName: "Maison Co",
    shopAvatar: "https://i.pravatar.cc/100?img=12",
    category: "home",
    freeShipping: false,
    variants: [
      { id: "rust", label: "Terracotta" },
      { id: "olive", label: "Olive" },
      { id: "cream", label: "Crème" },
    ],
    badges: ["Tendance"],
  },
];

function normalizeSeed(seed: SeedProduct): Product {
  return {
    ...seed,
    sellerId: SHOP_NAME_TO_SELLER[seed.shopName] ?? "seller-urban",
    onSale: true,
  };
}

// Mutable runtime catalog: demo seed + products created by sellers in-session.
const CATALOG: Product[] = SEED_PRODUCTS.map(normalizeSeed);

export function getProducts(category: ProductCategory = "all"): Product[] {
  const visible = CATALOG.filter(p => p.onSale);
  if (category === "all") return visible;
  return visible.filter(p => p.category === category);
}

export function getProductById(id: string): Product | undefined {
  return CATALOG.find(p => p.id === id);
}

export function getProductsBySeller(sellerId: string): Product[] {
  return CATALOG.filter(p => p.sellerId === sellerId);
}

export interface ProductInput {
  title: string;
  description: string;
  price: number;
  originalPrice: number;
  category: ProductCategory;
  images: string[];
  variants: ProductVariant[];
  freeShipping: boolean;
  onSale: boolean;
}

let productSeq = 1000;

export function createProduct(sellerId: string, input: ProductInput): Product {
  const seller = getSellerById(sellerId);
  const product: Product = {
    id: `usr-p${productSeq++}`,
    title: input.title,
    description: input.description,
    price: input.price,
    originalPrice: input.originalPrice > 0 ? input.originalPrice : input.price,
    currency: "€",
    images: input.images.length
      ? input.images
      : ["https://picsum.photos/seed/newprod/600/800"],
    rating: 5,
    reviewsCount: 0,
    soldCount: 0,
    sellerId,
    shopName: seller?.name ?? "Ma boutique",
    shopAvatar: seller?.avatar ?? "https://i.pravatar.cc/100?img=5",
    category: input.category,
    freeShipping: input.freeShipping,
    variants: input.variants.length
      ? input.variants
      : [{ id: "default", label: "Standard" }],
    badges: input.onSale ? ["Nouveau"] : [],
    onSale: input.onSale,
  };
  CATALOG.unshift(product);
  return product;
}

export function updateProduct(
  id: string,
  patch: Partial<ProductInput>,
): Product | undefined {
  const idx = CATALOG.findIndex(p => p.id === id);
  if (idx < 0) return undefined;
  const current = CATALOG[idx];
  const updated: Product = {
    ...current,
    ...patch,
    originalPrice: patch.originalPrice ?? current.originalPrice,
    images: patch.images?.length ? patch.images : current.images,
    variants: patch.variants?.length ? patch.variants : current.variants,
  };
  CATALOG[idx] = updated;
  return updated;
}

export function setProductOnSale(id: string, onSale: boolean): void {
  const p = CATALOG.find(x => x.id === id);
  if (p) p.onSale = onSale;
}

export function formatPrice(value: number, currency = "€"): string {
  return `${value.toFixed(2).replace(".", ",")}\u00A0${currency}`;
}

export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  return String(n);
}
