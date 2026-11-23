/**
 * Utility to format a commodity name with its unit from master.
 * Example: formatCommodityNameWithUnit("Basmati Rice", "KG") -> "Basmati Rice (KG)"
 * Example: formatCommodityNameWithUnit("Wheat", "MT") -> "Wheat (MT)"
 */
export function formatCommodityNameWithUnit(commodityName?: string, unit?: string): string {
  const name = (commodityName || "Commodity").trim();
  const rawUnit = (unit || "").trim();
  if (!rawUnit) return name;

  // Format unit in standard uppercase display, e.g. "kg" -> "KG", "mt" -> "MT", "bag" -> "BAG"
  const formattedUnit = rawUnit.toUpperCase();

  // Avoid duplicating if the commodity name already contains the unit in parentheses
  const lowerName = name.toLowerCase();
  const lowerRaw = `(${rawUnit.toLowerCase()})`;
  const lowerFmt = `(${formattedUnit.toLowerCase()})`;
  if (lowerName.endsWith(lowerRaw) || lowerName.endsWith(lowerFmt)) {
    return name;
  }

  return `${name} (${formattedUnit})`;
}
