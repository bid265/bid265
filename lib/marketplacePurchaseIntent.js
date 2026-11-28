const PENDING_PURCHASE_KEY = "marketplace-pending-purchase";
const PURCHASE_KINDS = ["DAILY_SALE", "PROPERTY", "PROPERTY_RENT"];

export function savePendingMarketplacePurchase(intent) {
  sessionStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(intent));
}

export function takePendingMarketplacePurchase() {
  const savedIntent = sessionStorage.getItem(PENDING_PURCHASE_KEY);
  if (!savedIntent) return null;

  sessionStorage.removeItem(PENDING_PURCHASE_KEY);

  let intent;
  try {
    intent = JSON.parse(savedIntent);
  } catch {
    return null;
  }

  if (
    intent?.type === "listing" &&
    Number.isInteger(intent.listingId) &&
    intent.listingId > 0 &&
    PURCHASE_KINDS.includes(intent.kind)
  ) {
    return intent;
  }

  if (
    intent?.type === "cart" &&
    Array.isArray(intent.listingIds) &&
    intent.listingIds.length > 0 &&
    intent.listingIds.every((id) => Number.isInteger(id) && id > 0)
  ) {
    return intent;
  }

  return null;
}
