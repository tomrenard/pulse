import { beforeAll, expect, test } from "vitest";
import { MAX_AGE, newSession, passwordMatches, validSession } from "./session.ts";

beforeAll(() => {
  process.env.SESSION_SECRET = "x".repeat(32);
  process.env.APP_PASSWORD = "correct horse";
});

test("a fresh session is valid until it expires", () => {
  const s = newSession(0);
  expect(validSession(s, 1000)).toBe(true);
  expect(validSession(s, (MAX_AGE + 1) * 1000)).toBe(false);
});

test("a tampered or missing session is rejected", () => {
  const [, mac] = newSession(0).split(".");
  expect(validSession(`99999999999.${mac}`, 0)).toBe(false);
  expect(validSession(undefined)).toBe(false);
  expect(validSession("garbage")).toBe(false);
});

test("password check", () => {
  expect(passwordMatches("correct horse")).toBe(true);
  expect(passwordMatches("correct hors")).toBe(false);
});
