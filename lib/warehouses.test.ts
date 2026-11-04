import { describe, it, expect } from "vitest";
import { z } from "zod";

const warehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Warehouse code must be at least 2 characters.")
    .max(30, "Warehouse code cannot exceed 30 characters.")
    .regex(/^[a-zA-Z0-9_\-\s./]+$/, "Warehouse code can only contain letters, numbers, hyphens, slashes, underscores, and spaces."),
  name: z.string().trim().min(2, "Warehouse name must be at least 2 characters.").max(120, "Warehouse name cannot exceed 120 characters."),
  address: z.string().trim().max(250).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  locations: z.array(z.object({
    code: z.string().trim().min(1, "Location code is required.").max(30),
    name: z.string().trim().min(1, "Location name is required.").max(100),
    type: z.enum(["Chamber", "Floor", "Stack", "Rack", "Other"]).default("Other"),
    capacity: z.coerce.number().positive().optional(),
    unit: z.string().trim().max(30).optional(),
  })).max(200).default([]),
});

describe("Warehouse Schema & Validation", () => {
  it("accepts valid warehouse codes with hyphens, underscores, slashes, and spaces", () => {
    const validInputs = [
      { code: "WH-01", name: "Main Warehouse" },
      { code: "SHED 4", name: "Grain Storage Shed" },
      { code: "COLD_ROOM_A", name: "Cold Storage Facility" },
      { code: "WH/APMC/02", name: "APMC Branch Yard" },
    ];

    for (const input of validInputs) {
      const result = warehouseSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it("rejects codes that are too short (< 2 characters)", () => {
    const result = warehouseSchema.safeParse({ code: "W", name: "Main Warehouse" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("at least 2 characters");
    }
  });

  it("rejects empty names", () => {
    const result = warehouseSchema.safeParse({ code: "WH-01", name: " " });
    expect(result.success).toBe(false);
  });

  it("handles optional address, city, state without error when empty strings", () => {
    const result = warehouseSchema.safeParse({
      code: "WH-01",
      name: "Main Warehouse",
      address: "",
      city: "",
      state: "",
    });
    expect(result.success).toBe(true);
  });

  it("validates storage area locations correctly", () => {
    const result = warehouseSchema.safeParse({
      code: "WH-01",
      name: "Central Godown",
      locations: [
        { code: "CH-01", name: "Cold Chamber 1", type: "Chamber" },
        { code: "FL-02", name: "Floor Grid B", type: "Floor" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.locations).toHaveLength(2);
      expect(result.data.locations[0].type).toBe("Chamber");
    }
  });

  it("rejects locations with empty codes", () => {
    const result = warehouseSchema.safeParse({
      code: "WH-01",
      name: "Central Godown",
      locations: [{ code: "", name: "Area Without Code", type: "Other" }],
    });
    expect(result.success).toBe(false);
  });
});

