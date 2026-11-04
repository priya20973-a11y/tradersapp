export const STORAGE_KEY_INVENTORY_ENABLED = "ledgerflow_inventory_enabled";

export function getStoredInventoryPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INVENTORY_ENABLED);
    if (raw === null) return false;
    return raw === "true";
  } catch {
    return false;
  }
}

export function setStoredInventoryPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_INVENTORY_ENABLED, String(enabled));
    window.dispatchEvent(new CustomEvent("inventory_preference_updated", { detail: { enabled } }));
  } catch {
    // Ignore storage write errors
  }
}

export async function fetchInventoryPreference(): Promise<boolean> {
  try {
    const res = await fetch("/api/settings/preferences/items");
    if (!res.ok) return getStoredInventoryPreference();
    const data = await res.json();
    const enabled = Boolean(data.inventoryEnabled);
    setStoredInventoryPreference(enabled);
    return enabled;
  } catch {
    return getStoredInventoryPreference();
  }
}

export async function saveInventoryPreference(enabled: boolean): Promise<boolean> {
  // Update local storage immediately
  setStoredInventoryPreference(enabled);
  try {
    const res = await fetch("/api/settings/preferences/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventoryEnabled: enabled }),
    });
    if (!res.ok) {
      throw new Error("Failed to save inventory preference");
    }
    const data = await res.json();
    const saved = Boolean(data.inventoryEnabled);
    setStoredInventoryPreference(saved);
    return saved;
  } catch {
    return enabled;
  }
}
