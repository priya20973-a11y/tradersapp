import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { itemInputSchema } from "@/app/api/items/route";
import { standardCategories } from "@/components/items/item-constants";
import { getMarginColorClass } from "@/components/items/item-types";

describe("Commodity / Item Edit Functionality", () => {
  const rootDir = process.cwd().endsWith("tradersapp")
    ? process.cwd()
    : path.join(process.cwd(), "tradersapp");

  const tableViewPath = path.resolve(rootDir, "components/items/item-table-view.tsx");
  const tableViewContent = fs.readFileSync(tableViewPath, "utf-8");

  const gridViewPath = path.resolve(rootDir, "components/items/item-grid-view.tsx");
  const gridViewContent = fs.readFileSync(gridViewPath, "utf-8");

  const quickViewPath = path.resolve(rootDir, "components/items/item-quick-view-modal.tsx");
  const quickViewContent = fs.readFileSync(quickViewPath, "utf-8");

  const marginPreviewPath = path.resolve(rootDir, "components/items/item-margin-preview.tsx");
  const marginPreviewContent = fs.readFileSync(marginPreviewPath, "utf-8");

  const formPath = path.resolve(rootDir, "components/items/new-item-form.tsx");
  const formContent = fs.readFileSync(formPath, "utf-8");

  const itemsPagePath = path.resolve(rootDir, "app/items/page.tsx");
  const itemsPageContent = fs.readFileSync(itemsPagePath, "utf-8");

  const newPagePath = path.resolve(rootDir, "app/items/new/page.tsx");
  const newPageExists = fs.existsSync(newPagePath);
  const newPageContent = newPageExists ? fs.readFileSync(newPagePath, "utf-8") : "";

  const editPagePath = path.resolve(rootDir, "app/items/[id]/edit/page.tsx");
  const editPageExists = fs.existsSync(editPagePath);
  const editPageContent = editPageExists ? fs.readFileSync(editPagePath, "utf-8") : "";

  const apiIdRoutePath = path.resolve(rootDir, "app/api/items/[id]/route.ts");
  const apiIdRouteExists = fs.existsSync(apiIdRoutePath);
  const apiIdRouteContent = apiIdRouteExists ? fs.readFileSync(apiIdRoutePath, "utf-8") : "";

  const apiRoutePath = path.resolve(rootDir, "app/api/items/route.ts");
  const apiRouteContent = fs.readFileSync(apiRoutePath, "utf-8");

  describe("1. Item Validation Schema (itemInputSchema)", () => {
    it("validates a complete item payload with category", () => {
      const result = itemInputSchema.safeParse({
        name: "Sharbati Wheat Grade A",
        sku: "SKU-WHT-001",
        type: "goods",
        unit: "qtl",
        category: "Grains & Cereals",
        salesPrice: 2850,
        purchasePrice: 2400,
        salesAccount: "Sales",
        purchaseAccount: "Cost of Goods Sold",
        salesDescription: "Export quality cleaned wheat",
        purchaseDescription: "Direct mandi procurement",
        preferredVendor: "Bharat Agro Foods",
        openingStock: 100,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Sharbati Wheat Grade A");
        expect(result.data.category).toBe("Grains & Cereals");
        expect(result.data.unit).toBe("qtl");
        expect(result.data.salesPrice).toBe(2850);
        expect(result.data.purchasePrice).toBe(2400);
      }
    });

    it("rejects an item payload with missing name", () => {
      const result = itemInputSchema.safeParse({
        name: "   ",
        sku: "SKU-TEST",
      });
      expect(result.success).toBe(false);
    });

    it("defaults unit to pcs and type to goods when omitted", () => {
      const result = itemInputSchema.safeParse({
        name: "Soybean Crude Oil",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.unit).toBe("pcs");
        expect(result.data.type).toBe("goods");
      }
    });
  });

  describe("2. Table View Action Column Edit Button", () => {
    it("imports Pencil icon in ItemTableView", () => {
      expect(tableViewContent).toContain("Pencil");
    });

    it("defines onEditItem in ItemTableViewProps", () => {
      expect(tableViewContent).toContain("onEditItem?: (item: ItemRecord) => void;");
    });

    it("renders Edit Item button with Pencil icon and stopPropagation in Action column", () => {
      expect(tableViewContent).toContain('title="Edit Item"');
      expect(tableViewContent).toContain("<Pencil className=\"h-4 w-4\"");
      expect(tableViewContent).toContain("onEditItem?.(item)");
      expect(tableViewContent).toContain("e.stopPropagation()");
    });
  });

  describe("3. Grid View & Quick View Modal Edit Trigger", () => {
    it("provides edit action button in ItemGridView", () => {
      expect(gridViewContent).toContain("Pencil");
      expect(gridViewContent).toContain("onEditItem");
      expect(gridViewContent).toContain('title="Edit Item"');
    });

    it("provides Edit Item action button in ItemQuickViewModal", () => {
      expect(quickViewContent).toContain("Pencil");
      expect(quickViewContent).toContain("onEdit");
      expect(quickViewContent).toContain("Edit Item");
    });
  });

  describe("4. NewItemForm Edit Mode & Population", () => {
    it("supports mode, initialData, and itemId in NewItemFormProps", () => {
      expect(formContent).toContain('mode?: "create" | "edit";');
      expect(formContent).toContain("initialData?: Partial<ItemRecord> | null;");
      expect(formContent).toContain("itemId?: string;");
    });

    it("includes Category field with datalist suggestions", () => {
      expect(formContent).toContain("Category / Commodity");
      expect(formContent).toContain('list="category-suggestions"');
      expect(formContent).toContain("<datalist id=\"category-suggestions\">");
      expect(formContent).toContain("standardCategories.map");
      expect(standardCategories).toContain("Grains & Cereals");
      expect(standardCategories).toContain("Pulses & Legumes");
    });

    it("displays Edit Item title and Save Changes button in edit mode", () => {
      expect(formContent).toContain('isEdit ? "Edit Item" : "Create New Item"');
      expect(formContent).toContain('isEdit ? "Save Changes" : "Save Item"');
    });

    it("submits via PUT to /api/items/[id] or /api/items in edit mode", () => {
      expect(formContent).toContain('const method = isEdit ? "PUT" : "POST";');
      expect(formContent).toContain("const endpoint = isEdit && targetId ? `/api/items/${targetId}` : \"/api/items\";");
    });
  });

  describe("5. Items Page Modal Integration", () => {
    it("manages editingItem state and opens modal in edit mode", () => {
      expect(itemsPageContent).toContain("const [editingItem, setEditingItem] = useState<ItemRecord | null>(null);");
      expect(itemsPageContent).toContain("handleEditItem");
      expect(itemsPageContent).toContain("setEditingItem(item)");
      expect(itemsPageContent).toContain("setShowModal(true)");
    });

    it("passes onEditItem to table and grid views and onEdit to quick view modal", () => {
      expect(itemsPageContent).toContain("onEditItem={handleEditItem}");
      expect(itemsPageContent).toContain("onEdit={handleEditItem}");
    });

    it("renders NewItemForm with mode, initialData, and itemId", () => {
      expect(itemsPageContent).toContain('mode={editingItem ? "edit" : "create"}');
      expect(itemsPageContent).toContain("initialData={editingItem}");
      expect(itemsPageContent).toContain("itemId={editingItem?.id}");
    });
  });

  describe("6. API Endpoints for Updating Items", () => {
    it("creates app/api/items/[id]/route.ts with GET, PUT, PATCH", () => {
      expect(apiIdRouteExists).toBe(true);
      expect(apiIdRouteContent).toContain("export async function GET");
      expect(apiIdRouteContent).toContain("export async function PUT");
      expect(apiIdRouteContent).toContain("export async function PATCH");
    });

    it("verifies app/api/items/[id]/route.ts checks for SKU duplicates excluding current item", () => {
      expect(apiIdRouteContent).toContain("_id: { $ne: id }");
      expect(apiIdRouteContent).toContain("An item with this SKU already exists");
    });

    it("verifies app/api/items/route.ts supports PUT updates", () => {
      expect(apiRouteContent).toContain("export async function PUT");
      expect(apiRouteContent).toContain("_id: { $ne: id }");
    });

    it("creates standalone edit route at app/items/[id]/edit/page.tsx", () => {
      expect(editPageExists).toBe(true);
      expect(editPageContent).toContain("<NewItemForm mode=\"edit\" itemId={id} />");
    });
  });

  describe("7. Modal and Page Viewport Visibility & Scrolling Fixes", () => {
    it("ensures Item Classification cards (Goods vs Service) are defined in form", () => {
      expect(formContent).toContain("Item Classification");
      expect(formContent).toContain('onClick={() => setType("goods")}');
      expect(formContent).toContain('onClick={() => setType("service")}');
    });

    it("supports inModal prop and internal overflow-y-auto scrolling in NewItemForm", () => {
      expect(formContent).toContain("inModal?: boolean;");
      expect(formContent).toContain("overflow-y-auto");
      expect(formContent).toContain("overscroll-contain");
    });

    it("prevents modal clipping with items-start / sm:items-center and max-height constraints", () => {
      expect(itemsPageContent).toContain("items-start sm:items-center");
      expect(itemsPageContent).toContain("max-h-[calc(100dvh-2rem)]");
      expect(itemsPageContent).toContain("inModal={true}");
    });

    it("ensures standalone new item page has generous top spacing", () => {
      expect(newPageExists).toBe(true);
      expect(newPageContent).toMatch(/py-[4-8]/);
    });

    it("ensures standalone edit item page has generous top spacing", () => {
      expect(editPageExists).toBe(true);
      expect(editPageContent).toMatch(/py-[4-8]/);
    });
  });

  describe("8. Gross Margin Display & Negative Value Styling", () => {
    it("returns light red class (text-red-500) for negative margin values", () => {
      expect(getMarginColorClass(-1)).toBe("text-red-500");
      expect(getMarginColorClass(-15)).toBe("text-red-500");
      expect(getMarginColorClass(-50)).toBe("text-red-500");
    });

    it("preserves existing colors for zero and positive margin values", () => {
      expect(getMarginColorClass(0)).toBe("text-slate-400");
      expect(getMarginColorClass(10)).toBe("text-blue-600");
      expect(getMarginColorClass(20)).toBe("text-emerald-600");
      expect(getMarginColorClass(35)).toBe("text-emerald-600");
    });

    it("applies light red styling to negative margin in ItemTableView", () => {
      expect(tableViewContent).toContain("getMarginColorClass");
      expect(tableViewContent).toContain("{marginPercent}% margin");
    });

    it("applies light red styling to negative margin in ItemGridView", () => {
      expect(gridViewContent).toContain('marginPercent < 0 ? "text-red-500" : "text-emerald-600"');
      expect(gridViewContent).toContain("{marginPercent}% margin");
    });

    it("applies light red styling to negative margin in ItemMarginPreview", () => {
      expect(marginPreviewContent).toContain("isNegative");
      expect(marginPreviewContent).toContain('isNegative ? "text-red-500" : "text-emerald-950"');
    });

    it("applies light red styling to negative margin in ItemQuickViewModal", () => {
      expect(quickViewContent).toContain("getMarginColorClass");
      expect(quickViewContent).toContain("{marginPercent}% margin");
    });
  });
});
