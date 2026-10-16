export function calculateCommission(baseAmount: number, commissionRatePercent: number) {
  if (!Number.isFinite(baseAmount) || baseAmount < 0) throw new RangeError("Base amount must be non-negative.");
  if (!Number.isFinite(commissionRatePercent) || commissionRatePercent < 0 || commissionRatePercent > 100) {
    throw new RangeError("Commission rate must be between 0 and 100.");
  }
  return Math.round((baseAmount * commissionRatePercent / 100 + Number.EPSILON) * 100) / 100;
}

export function availableStock(physicalQuantity: number, reservedQuantity: number) {
  if (!Number.isFinite(physicalQuantity) || !Number.isFinite(reservedQuantity) || physicalQuantity < 0 || reservedQuantity < 0) {
    throw new RangeError("Stock quantities must be non-negative finite numbers.");
  }
  if (reservedQuantity > physicalQuantity) throw new RangeError("Reserved quantity cannot exceed physical stock.");
  return Math.max(0, physicalQuantity - reservedQuantity);
}

export function stockLotStatus(physicalQuantity: number, reservedQuantity: number, damagedQuantity: number) {
  if ([physicalQuantity, reservedQuantity, damagedQuantity].some((quantity) => !Number.isFinite(quantity) || quantity < 0)) {
    throw new RangeError("Stock quantities must be non-negative finite numbers.");
  }
  if (reservedQuantity > physicalQuantity) throw new RangeError("Reserved quantity cannot exceed physical stock.");
  if (physicalQuantity <= 0) return damagedQuantity > 0 ? "Damaged" : "Exhausted";
  if (reservedQuantity >= physicalQuantity) return "Reserved";
  if (reservedQuantity > 0) return "Partially Reserved";
  return "In Stock";
}

export function invoiceOutstanding(total: number, paid: number, credited: number) {
  if (![total, paid, credited].every(Number.isFinite) || total < 0 || paid < 0 || credited < 0) {
    throw new RangeError("Invoice amounts must be non-negative finite numbers.");
  }
  return Math.max(0, total - paid - credited);
}

export function paymentAllocationTotal(amount: number, allocations: number[]) {
  if (!Number.isFinite(amount) || amount < 0 || allocations.some((allocation) => !Number.isFinite(allocation) || allocation <= 0)) {
    throw new RangeError("Payment allocations must be positive finite amounts.");
  }
  const allocated = allocations.reduce((total, allocation) => total + allocation, 0);
  if (allocated > amount + 0.000001) throw new RangeError("Invoice allocations exceed the payment amount.");
  return allocated;
}
