import { useCallback, useMemo, useSyncExternalStore } from "react";

const DAILY_SALE_CART_KEY = "bid265-daily-sale-cart";
const DAILY_SALE_CART_CHANGE_EVENT = "bid265-daily-sale-cart-change";

function parseDailySaleCart(serializedCart) {
  if (!serializedCart) return [];
  try {
    const cart = JSON.parse(serializedCart);
    if (!Array.isArray(cart)) {
      throw new Error("Stored daily sale cart is not a list.");
    }
    return cart.filter((item) =>
      item &&
      Number.isSafeInteger(item.id) &&
      item.id > 0 &&
      Number.isFinite(Number(item.price)) &&
      typeof item.title === "string"
    );
  } catch (error) {
    console.error("[Marketplace cart]", error);
    return [];
  }
}

function getSnapshot() {
  return sessionStorage.getItem(DAILY_SALE_CART_KEY) || "[]";
}

function getServerSnapshot() {
  return "[]";
}

function subscribe(callback) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(DAILY_SALE_CART_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DAILY_SALE_CART_CHANGE_EVENT, callback);
  };
}

export function useDailySaleCart() {
  const serializedCart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const cart = useMemo(() => parseDailySaleCart(serializedCart), [serializedCart]);
  const setCart = useCallback((update) => {
    const currentCart = parseDailySaleCart(getSnapshot());
    const nextCart = typeof update === "function" ? update(currentCart) : update;
    writeDailySaleCart(nextCart);
  }, []);

  return [cart, setCart];
}

export function writeDailySaleCart(cart) {
  sessionStorage.setItem(DAILY_SALE_CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event(DAILY_SALE_CART_CHANGE_EVENT));
}
