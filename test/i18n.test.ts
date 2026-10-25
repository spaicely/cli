import { describe, expect, it } from "vitest";
import { fromEnvironment, setLocale, t } from "../src/i18n.js";

describe("i18n", () => {
  it("picks the language from the environment", () => {
    expect(fromEnvironment({ LANG: "nl_NL.UTF-8" })).toBe("nl");
    expect(fromEnvironment({ LANG: "ja_JP.UTF-8" })).toBe("en");
  });

  it("fills in values", () => {
    setLocale("de");
    expect(t("published", { number: 7 })).toBe("Version 7 ist live.");
    setLocale("en");
  });
});

describe("messages", () => {
  it("has every text in every language", async () => {
    const { messages } = await import("../src/i18n.js");
    const keys = Object.keys(messages.nl).sort();
    for (const texts of Object.values(messages)) expect(Object.keys(texts).sort()).toEqual(keys);
  });
});
