/**
 * CLIENT UNIT TESTS — pure helpers in src/lib/utils.ts.
 *
 * These are the cheapest tests in the project: no DOM, no network, no React.
 * They are also where real bugs hide, because date and string formatting is
 * exactly the kind of code nobody reads carefully.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cn, checkIsLiked, multiFormatDateString, formatDateString } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("resolves conflicting Tailwind classes, keeping the last", () => {
    // This is the whole reason tailwind-merge exists: in CSS the winner is
    // decided by stylesheet order, not by the order in the class attribute.
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("keeps non-conflicting classes from the same family", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });
});

describe("checkIsLiked", () => {
  it("returns true when the user id is present", () => {
    expect(checkIsLiked(["u1", "u2"], "u1")).toBe(true);
  });

  it("returns false when it is absent", () => {
    expect(checkIsLiked(["u1", "u2"], "u3")).toBe(false);
  });

  it("returns false for an empty list", () => {
    expect(checkIsLiked([], "u1")).toBe(false);
  });

  it("is exact, not a substring match", () => {
    expect(checkIsLiked(["u10"], "u1")).toBe(false);
  });
});

describe("multiFormatDateString", () => {
  const NOW = new Date("2026-10-12T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

  it("says 'Just now' for a few seconds ago", () => {
    expect(multiFormatDateString(ago(30 * 1000))).toBe("Just now");
  });

  it("reports minutes", () => {
    expect(multiFormatDateString(ago(5 * 60 * 1000))).toBe("5 minutes ago");
  });

  it("reports hours", () => {
    expect(multiFormatDateString(ago(3 * 60 * 60 * 1000))).toBe("3 hours ago");
  });

  it("uses the singular for exactly one day", () => {
    expect(multiFormatDateString(ago(24 * 60 * 60 * 1000))).toBe("1 day ago");
  });

  it("uses the plural for several days", () => {
    expect(multiFormatDateString(ago(5 * 24 * 60 * 60 * 1000))).toBe("5 days ago");
  });

  it("falls back to an absolute date beyond 30 days", () => {
    const result = multiFormatDateString(ago(40 * 24 * 60 * 60 * 1000));
    expect(result).toMatch(/\d{4}/);       // contains a year
    expect(result).not.toMatch(/ago/);
  });

  it("should say '1 hour ago', not '1 hours ago'", () => {
    expect(multiFormatDateString(ago(60 * 60 * 1000))).toBe("1 hour ago");
  });

  it("should say '1 minute ago', not '1 minutes ago'", () => {
    expect(multiFormatDateString(ago(60 * 1000))).toBe("1 minute ago");
  });

  it("does not crash on an empty string", () => {
    expect(() => multiFormatDateString("")).not.toThrow();
  });

  it("does not crash on an unparseable date", () => {
    expect(() => multiFormatDateString("banana")).not.toThrow();
  });
});

describe("formatDateString", () => {
  it("renders a readable absolute date", () => {
    const out = formatDateString("2026-03-15T14:30:00Z");
    expect(out).toContain("2026");
    expect(out).toContain("at");
  });
});
