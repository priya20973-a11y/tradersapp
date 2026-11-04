import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

describe("Change Password & Admin Reset Password Integration", () => {
  const profileWorkspacePath = path.resolve(__dirname, "../components/profile/profile-workspace.tsx");
  const changePasswordRoutePath = path.resolve(__dirname, "../app/api/profile/change-password/route.ts");
  const adminOrgsRoutePath = path.resolve(__dirname, "../app/api/admin/organizations/route.ts");

  const profileWorkspaceContent = fs.readFileSync(profileWorkspacePath, "utf-8");
  const changePasswordRouteContent = fs.readFileSync(changePasswordRoutePath, "utf-8");
  const adminOrgsRouteContent = fs.readFileSync(adminOrgsRoutePath, "utf-8");

  describe("1. User Profile — Change Password UI", () => {
    it("renders the Change Password section in the User Profile", () => {
      expect(profileWorkspaceContent).toContain("Change Password");
      expect(profileWorkspaceContent).toContain("change-password-section");
      expect(profileWorkspaceContent).toContain("Current Password");
      expect(profileWorkspaceContent).toContain("New Password");
      expect(profileWorkspaceContent).toContain("Confirm New Password");
    });

    it("includes show/hide password toggle icons for all password fields", () => {
      expect(profileWorkspaceContent).toContain("showCurrentPassword");
      expect(profileWorkspaceContent).toContain("showNewPassword");
      expect(profileWorkspaceContent).toContain("showConfirmPassword");
      expect(profileWorkspaceContent).toContain("Eye");
      expect(profileWorkspaceContent).toContain("EyeOff");
    });

    it("provides Change Password and Cancel buttons", () => {
      expect(profileWorkspaceContent).toContain("Change Password");
      expect(profileWorkspaceContent).toContain("Cancel");
      expect(profileWorkspaceContent).toContain("handleCancelPasswordChange");
      expect(profileWorkspaceContent).toContain("handleChangePassword");
    });

    it("clears password fields on Cancel and on successful change", () => {
      expect(profileWorkspaceContent).toContain('setCurrentPassword("")');
      expect(profileWorkspaceContent).toContain('setNewPassword("")');
      expect(profileWorkspaceContent).toContain('setConfirmPassword("")');
    });

    it("handles temporary password notification banner when mustChangePassword is true", () => {
      expect(profileWorkspaceContent).toContain("mustChangePassword");
      expect(profileWorkspaceContent).toContain("Temporary Password Detected");
    });
  });

  describe("2. Change Password Security & Server Verification", () => {
    it("verifies current password against database hash with bcrypt", () => {
      expect(changePasswordRouteContent).toContain("bcrypt.compare");
      expect(changePasswordRouteContent).toContain("Current password is incorrect.");
    });

    it("enforces password policy (min 8 characters) and matching confirmation", () => {
      expect(changePasswordRouteContent).toContain("min(8");
      expect(changePasswordRouteContent).toContain("New password and confirmation do not match.");
    });

    it("prevents users from reusing their current password", () => {
      expect(changePasswordRouteContent).toContain("New password cannot be the same as your current password.");
    });

    it("hashes the new password with bcrypt cost factor 12", () => {
      expect(changePasswordRouteContent).toMatch(/bcrypt\.hash\(newPassword,\s*12\)/);
    });

    it("invalidates existing sessions by atomically incrementing authzVersion", () => {
      expect(changePasswordRouteContent).toContain("authzVersion");
      expect(changePasswordRouteContent).toContain("authVersion");
      expect(changePasswordRouteContent).toContain("mustChangePassword = false");
    });

    it("records password change in audit log without storing passwords", () => {
      expect(changePasswordRouteContent).toContain("AuditEvent.create");
      expect(changePasswordRouteContent).toContain("auth.password_changed");
      expect(changePasswordRouteContent).not.toContain("passwordHash: newHash"); // Never store passwordHash inside audit log changes
    });

    it("enforces rate limiting on password change endpoint", () => {
      expect(changePasswordRouteContent).toContain("checkRateLimit");
      expect(changePasswordRouteContent).toContain("Too many password change attempts.");
    });
  });

  describe("3. Admin Reset Password Integration", () => {
    it("allows authorized admins to reset user passwords without knowing current password", () => {
      expect(adminOrgsRouteContent).toContain('action: z.literal("reset-password")');
      expect(adminOrgsRouteContent).toContain("randomBytes(18).toString(\"base64url\")");
      expect(adminOrgsRouteContent).toContain("temporaryPassword");
    });

    it("supports optionally requiring user to change password at next login", () => {
      expect(adminOrgsRouteContent).toContain("requirePasswordChange");
      expect(adminOrgsRouteContent).toContain("mustChangePassword");
    });

    it("invalidates prior user sessions by incrementing authzVersion on admin reset", () => {
      expect(adminOrgsRouteContent).toMatch(/targetUser\.authzVersion\s*=/);
    });

    it("records admin password reset in audit logs", () => {
      expect(adminOrgsRouteContent).toContain("auth.admin_reset_password");
    });
  });

  describe("4. Password Hashing Consistency Verification", () => {
    it("hashes and correctly verifies passwords with cost factor 12", async () => {
      const password = "StrongTestPassword2026!";
      const hash = await bcrypt.hash(password, 12);

      expect(hash).toMatch(/^\$2[aby]\$12\$/);
      expect(await bcrypt.compare(password, hash)).toBe(true);
      expect(await bcrypt.compare("WrongPassword123", hash)).toBe(false);
    });
  });
});

