import { describe, expect, it } from "vitest";
import { ResetPasswordSchema, SignInSchema, SignUpSchema } from "@/features/auth/schemas/auth";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";

describe("auth validation schemas", () => {
  it("normalizes email for sign in", () => {
    const parsed = SignInSchema.parse({
      email: " USER@Example.COM ",
      password: "password",
      next: "/member"
    });

    expect(parsed.email).toBe("user@example.com");
  });

  it("rejects weak registration passwords", () => {
    const parsed = SignUpSchema.safeParse({
      fullName: "Apex Member",
      email: "member@example.com",
      phone: "9876543210",
      password: "password",
      confirmPassword: "password"
    });

    expect(parsed.success).toBe(false);
  });

  it("requires password confirmation during reset", () => {
    const parsed = ResetPasswordSchema.safeParse({
      password: "StrongPass123",
      confirmPassword: "Different123"
    });

    expect(parsed.success).toBe(false);
  });

  it("blocks open redirects", () => {
    expect(sanitizeRedirectPath("https://evil.example", "/member")).toBe("/member");
    expect(sanitizeRedirectPath("//evil.example", "/member")).toBe("/member");
    expect(sanitizeRedirectPath("/admin", "/member")).toBe("/admin");
  });
});
