import type { ImageSourcePropType } from 'react-native';

export type Product = {
  id: string;
  seller_id: string;
  seller: string;
  name: string;
  description: string;
  price_minor: number;
  currency: 'NGN';
  stock: number;
  emoji: string;
  image_url: string;
  image?: ImageSourcePropType;
  category: string;
  active: boolean;
};

const STUDIO = { id: 'usr_studio', username: 'Atelier Sandbox' };

const make = (
  id: string,
  name: string,
  description: string,
  priceNaira: number,
  stock: number,
  emoji: string,
  image: ImageSourcePropType,
  category: string,
): Product => ({
  id,
  seller_id: STUDIO.id,
  seller: STUDIO.username,
  name,
  description,
  price_minor: priceNaira * 100,
  currency: 'NGN',
  stock,
  emoji,
  image_url: '',
  image,
  category,
  active: true,
});

/**
 * The same twelve objects used by the web sandbox (backend/seed.py), with the
 * repository's local product photography so the catalogue works offline.
 */
export const DEMO_PRODUCTS: Product[] = [
  make(
    'prd_arc_stool',
    'Arc Counter Stool',
    'Solid oak with a powder-coated steel footrest. 66 cm seat height, built for long mornings at the counter.',
    78000,
    14,
    '🪑',
    require('../../assets/products/arc-counter-stool.jpg'),
    'Furniture',
  ),
  make(
    'prd_pivot_chair',
    'Pivot Lounge Chair',
    'A moulded shell on a solid ash base. Low, wide and unexpectedly comfortable — the chair everyone reaches for.',
    145000,
    9,
    '🪑',
    require('../../assets/products/pivot-lounge-chair.jpg'),
    'Furniture',
  ),
  make(
    'prd_moss_sofa',
    'Moss Velvet Sofa',
    'Three generous seats in dense cotton velvet. Solid beech frame, feather-wrapped cushions, removable covers.',
    480000,
    4,
    '🛋️',
    require('../../assets/products/moss-velvet-sofa.jpg'),
    'Furniture',
  ),
  make(
    'prd_tan_sofa',
    'Tan Leather Sofa',
    'Full-grain leather that softens with use. Three seats, low arms and solid oak feet. A piece that gets better with age.',
    520000,
    3,
    '🛋️',
    require('../../assets/products/tan-leather-sofa.jpg'),
    'Furniture',
  ),
  make(
    'prd_studio_mug',
    'Studio Mug',
    'Stoneware mug with a generous handle and a satin glaze. 350 ml, dishwasher safe, made for the second cup.',
    12500,
    36,
    '☕',
    require('../../assets/products/studio-mug.jpg'),
    'Kitchen',
  ),
  make(
    'prd_flask',
    'Everyday Flask',
    'Double-wall stainless steel, 500 ml. Keeps coffee hot for six hours and fits the side pocket of almost any bag.',
    18000,
    28,
    '🧴',
    require('../../assets/products/everyday-flask.jpg'),
    'Objects',
  ),
  make(
    'prd_watch',
    'Field Watch',
    'Brushed aluminium case, sapphire face and a soft silicone strap. Water-resistant to 50 m, quietly precise.',
    95000,
    11,
    '⌚',
    require('../../assets/products/field-watch.jpg'),
    'Objects',
  ),
  make(
    'prd_camera',
    'Instant Camera',
    'Point-and-shoot instant camera with a built-in flash. Uses standard instant film — the good kind of slow.',
    165000,
    7,
    '📷',
    require('../../assets/products/instant-camera.jpg'),
    'Objects',
  ),
  make(
    'prd_runner',
    'Knit Runner',
    'Lightweight knit upper on a cushioned sole. Made for the walk that turns into a run.',
    72000,
    16,
    '👟',
    require('../../assets/products/knit-runner.jpg'),
    'Apparel',
  ),
  make(
    'prd_mini_bag',
    'Leather Mini Bag',
    'Structured mini bag in pebbled leather. Fits a phone, cardholder and keys — nothing more, which is the point.',
    88000,
    12,
    '👜',
    require('../../assets/products/leather-mini-bag.jpg'),
    'Carry',
  ),
  make(
    'prd_coffee',
    'Single Origin Coffee',
    'Washed Ethiopian beans roasted for filter. Notes of peach, jasmine and brown sugar. 250 g, whole bean.',
    9500,
    42,
    '☕',
    require('../../assets/products/single-origin-coffee.jpg'),
    'Kitchen',
  ),
  make(
    'prd_face_oil',
    'Botanical Face Oil',
    'Cold-pressed rosehip and squalane. Three drops, morning and night, and a minute that belongs to you.',
    24000,
    25,
    '🧴',
    require('../../assets/products/botanical-face-oil.jpg'),
    'Apothecary',
  ),
];

export type DemoAccount = {
  id: string;
  email: string;
  username: string;
  password: string;
  role: 'customer' | 'shop_owner' | 'superuser';
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { id: 'usr_admin', email: 'admin@still.local', username: 'admin', password: 'Admin1234!', role: 'shop_owner' },
  { id: 'usr_superuser', email: 'superuser@still.local', username: 'superuser', password: 'Super1234!', role: 'superuser' },
  { id: 'usr_customer', email: 'customer@still.local', username: 'customer', password: 'Customer1234!', role: 'customer' },
];

export const CATEGORIES = [
  'All',
  'Furniture',
  'Kitchen',
  'Objects',
  'Apparel',
  'Carry',
  'Apothecary',
];
