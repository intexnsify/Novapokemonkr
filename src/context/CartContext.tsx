import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSite } from './SiteContext';
import { Product } from '../types/nova';

export interface CartEntry {
  productId: string;
  quantity: number;
  addedAt: number;
}

export interface ResolvedCartItem {
  entry: CartEntry;
  product: Product;
  lineTotal: number;
}

interface CartContextValue {
  entries: CartEntry[];
  items: ResolvedCartItem[];
  totalCount: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (product: Product, qty?: number) => { ok: boolean; reason?: string };
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  clearCart: () => void;
}

const STORAGE_KEY = 'nova_cart_v1';
const CartContext = createContext<CartContextValue | null>(null);

function loadStoredCart(): CartEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is CartEntry =>
          x &&
          typeof x.productId === 'string' &&
          typeof x.quantity === 'number' &&
          Number.isFinite(x.quantity) &&
          x.quantity >= 1
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { products } = useSite();
  const [entries, setEntries] = useState<CartEntry[]>(loadStoredCart);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Ignore private browsing quota errors
    }
  }, [entries]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const items = useMemo<ResolvedCartItem[]>(() => {
    const resolved: ResolvedCartItem[] = [];
    for (const entry of entries) {
      const product = productMap.get(entry.productId);
      if (!product) continue;
      if (product.status === '판매완료') continue;
      const maxQty = product.category === '등급카드' || product.category === '싱글카드' ? 10 : 50;
      const safeQty = Math.max(1, Math.min(maxQty, Math.round(entry.quantity)));
      resolved.push({
        entry: { ...entry, quantity: safeQty },
        product,
        lineTotal: product.price * safeQty,
      });
    }
    return resolved;
  }, [entries, productMap]);

  const totalCount = useMemo(
    () => items.reduce((acc, item) => acc + item.entry.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + item.lineTotal, 0),
    [items]
  );

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((v) => !v), []);

  const addItem = useCallback((product: Product, qty = 1) => {
    if (product.status === '판매완료') {
      return { ok: false, reason: '이미 판매 완료된 상품입니다.' };
    }
    const cleanQty = Math.max(1, Math.min(20, Math.round(qty)));
    setEntries((prev) => {
      const existing = prev.find((e) => e.productId === product.id);
      if (existing) {
        return prev.map((e) =>
          e.productId === product.id
            ? { ...e, quantity: Math.min(20, e.quantity + cleanQty) }
            : e
        );
      }
      return [...prev, { productId: product.id, quantity: cleanQty, addedAt: Date.now() }];
    });
    return { ok: true };
  }, []);

  const removeItem = useCallback((productId: string) => {
    setEntries((prev) => prev.filter((e) => e.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setEntries((prev) => prev.filter((e) => e.productId !== productId));
      return;
    }
    const cleanQty = Math.max(1, Math.min(50, Math.round(qty)));
    setEntries((prev) =>
      prev.map((e) => (e.productId === productId ? { ...e, quantity: cleanQty } : e))
    );
  }, []);

  const clearCart = useCallback(() => {
    setEntries([]);
  }, []);

  return (
    <CartContext.Provider
      value={{
        entries,
        items,
        totalCount,
        subtotal,
        isOpen,
        openCart,
        closeCart,
        toggleCart,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
