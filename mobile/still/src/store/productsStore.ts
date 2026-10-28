import { create } from 'zustand';
import { DEMO_PRODUCTS, type Product } from '../data/demo';

type NewProduct = {
  name: string;
  description?: string;
  price_minor: number;
  category?: string;
  emoji?: string;
  stock?: number;
};

interface ProductsState {
  products: Product[];
  addProduct: (sellerId: string, sellerName: string, input: NewProduct) => Product;
  removeProduct: (id: string) => void;
  decrementStock: (id: string, quantity: number) => void;
}

/**
 * Demo catalogue store. When Supabase is configured the screens read from
 * Postgres instead; this store is only used in local sandbox mode.
 */
export const useProducts = create<ProductsState>((set) => ({
  products: DEMO_PRODUCTS,

  addProduct: (sellerId, sellerName, input) => {
    const product: Product = {
      id: `prd_${Date.now().toString(36)}`,
      seller_id: sellerId,
      seller: sellerName,
      name: input.name.trim(),
      description: input.description?.trim() || '',
      price_minor: input.price_minor,
      currency: 'NGN',
      stock: input.stock ?? 10,
      emoji: input.emoji || '📦',
      image_url: '',
      category: input.category || 'Objects',
      active: true,
    };
    set((state) => ({ products: [product, ...state.products] }));
    return product;
  },

  removeProduct: (id) =>
    set((state) => ({
      products: state.products.filter((p) => p.id !== id),
    })),

  decrementStock: (id, quantity) =>
    set((state) => ({
      products: state.products.map((p) =>
        p.id === id ? { ...p, stock: Math.max(0, p.stock - quantity) } : p,
      ),
    })),
}));
