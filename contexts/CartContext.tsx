'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface CartItem {
  id: string;
  name: string;
  risk?: "High" | "Medium" | "Low";
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  isInCart: (itemId: string) => boolean;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const normId = (x: unknown) => String(x ?? "").trim();

  const addToCart = useCallback((item: CartItem) => {
    setItems((prev) => {
      const itemIdNorm = normId(item.id);
      if (prev.some((i) => normId(i.id) === itemIdNorm)) {
        return prev;
      }
      return [...prev, { ...item, id: itemIdNorm || item.id }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    const idNorm = normId(itemId);
    setItems((prev) => prev.filter((item) => normId(item.id) !== idNorm));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback((itemId: string) => {
    const idNorm = normId(itemId);
    return items.some((item) => normId(item.id) === idNorm);
  }, [items]);

  const value = {
    items,
    addToCart,
    removeFromCart,
    clearCart,
    isInCart,
    cartCount: items.length,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

