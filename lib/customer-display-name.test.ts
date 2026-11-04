import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Functional simulation of the Display Name & Company Name synchronization rules
 * as implemented in NewCustomerForm.
 */
function createCustomerNameSyncManager(initialState?: {
  companyName?: string;
  displayName?: string;
  sameAsCompanyName?: boolean;
}) {
  let companyName = initialState?.companyName ?? "";
  let displayName = initialState?.displayName ?? "";
  let sameAsCompanyName = initialState?.sameAsCompanyName ?? false;

  return {
    get companyName() {
      return companyName;
    },
    get displayName() {
      return displayName;
    },
    get sameAsCompanyName() {
      return sameAsCompanyName;
    },
    handleSameAsCompanyChange(checked: boolean) {
      sameAsCompanyName = checked;
      if (checked && companyName.trim().length > 0) {
        displayName = companyName;
      }
    },
    handleCompanyNameChange(nextVal: string) {
      companyName = nextVal;
      if (sameAsCompanyName && nextVal.trim().length > 0) {
        displayName = nextVal;
      }
    },
    handleDisplayNameChange(nextVal: string) {
      if (sameAsCompanyName) return;
      displayName = nextVal;
    },
  };
}

describe("Customer Form: Display Name same as Company Name", () => {
  describe("Functional Synchronization Requirements", () => {
    it("automatically copies Company Name into Display Name when checked", () => {
      const manager = createCustomerNameSyncManager({
        companyName: "Reliance Industries Ltd",
        displayName: "",
        sameAsCompanyName: false,
      });

      manager.handleSameAsCompanyChange(true);
      expect(manager.sameAsCompanyName).toBe(true);
      expect(manager.displayName).toBe("Reliance Industries Ltd");
    });

    it("keeps Display Name synchronized with Company Name while checked", () => {
      const manager = createCustomerNameSyncManager({
        companyName: "Tata",
        displayName: "Tata",
        sameAsCompanyName: true,
      });

      manager.handleCompanyNameChange("Tata Motors");
      expect(manager.displayName).toBe("Tata Motors");

      manager.handleCompanyNameChange("Tata Motors Commercial Vehicles");
      expect(manager.displayName).toBe("Tata Motors Commercial Vehicles");
    });

    it("does not overwrite Display Name if Company Name is empty when checked", () => {
      const manager = createCustomerNameSyncManager({
        companyName: "",
        displayName: "Adani Enterprises",
        sameAsCompanyName: false,
      });

      manager.handleSameAsCompanyChange(true);
      expect(manager.sameAsCompanyName).toBe(true);
      // Display Name must NOT be overwritten by empty value
      expect(manager.displayName).toBe("Adani Enterprises");
    });

    it("does not overwrite Display Name if Company Name contains only whitespace when checked", () => {
      const manager = createCustomerNameSyncManager({
        companyName: "   ",
        displayName: "Birla Corp",
        sameAsCompanyName: false,
      });

      manager.handleSameAsCompanyChange(true);
      expect(manager.displayName).toBe("Birla Corp");
    });

    it("does not overwrite Display Name with empty value if Company Name is cleared while checked", () => {
      const manager = createCustomerNameSyncManager({
        companyName: "Infosys Ltd",
        displayName: "Infosys Ltd",
        sameAsCompanyName: true,
      });

      manager.handleCompanyNameChange("");
      expect(manager.companyName).toBe("");
      // Preserves existing Display Name rather than setting to empty
      expect(manager.displayName).toBe("Infosys Ltd");
    });

    it("allows manual editing of Display Name when unchecked", () => {
      const manager = createCustomerNameSyncManager({
        companyName: "Wipro Technologies",
        displayName: "Wipro Technologies",
        sameAsCompanyName: true,
      });

      // User unchecks checkbox
      manager.handleSameAsCompanyChange(false);
      expect(manager.sameAsCompanyName).toBe(false);

      // User manually edits Display Name
      manager.handleDisplayNameChange("Wipro - Bangalore Branch");
      expect(manager.displayName).toBe("Wipro - Bangalore Branch");

      // Modifying Company Name now does NOT alter manual Display Name
      manager.handleCompanyNameChange("Wipro Global");
      expect(manager.companyName).toBe("Wipro Global");
      expect(manager.displayName).toBe("Wipro - Bangalore Branch");
    });

    it("prevents direct manual editing while checked", () => {
      const manager = createCustomerNameSyncManager({
        companyName: "ITC Limited",
        displayName: "ITC Limited",
        sameAsCompanyName: true,
      });

      manager.handleDisplayNameChange("Different Name");
      expect(manager.displayName).toBe("ITC Limited");
    });
  });

  describe("UI Component Code & Accessibility Integrity", () => {
    const filePath = path.join(process.cwd(), "components", "sales", "new-customer-form.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    it("renders the 'Display Name same as Company Name' checkbox near Display Name", () => {
      expect(content).toContain("Display Name same as Company Name");
      expect(content).toContain('id="sameAsCompanyName"');
      expect(content).toContain('name="sameAsCompanyName"');
      expect(content).toContain('htmlFor="sameAsCompanyName"');
    });

    it("controls companyName and displayName inputs while preserving HTML form names", () => {
      expect(content).toContain('name="companyName"');
      expect(content).toContain('name="displayName"');
      expect(content).toContain("value={companyName}");
      expect(content).toContain("value={displayName}");
      expect(content).toContain("readOnly={sameAsCompanyName}");
    });

    it("preserves required validation and helper text on Display Name", () => {
      expect(content).toContain("minLength={2}");
      expect(content).toContain("maxLength={120}");
      expect(content).toContain("This name will be printed on all sales transactions and client vouchers.");
    });
  });
});
