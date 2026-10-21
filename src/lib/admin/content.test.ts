import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mn } from "@/i18n/dictionaries/mn";
import { en } from "@/i18n/dictionaries/en";
import { applyTextOverrides, curate, defaultProfile, phoneHrefFor, resolveProfile, resolveTexts } from "./content";

describe("website content", () => {
  it("falls back to the defaults for missing or invalid stored data", () => {
    assert.deepEqual(resolveProfile(null), defaultProfile);
    assert.deepEqual(resolveProfile({ name: 42 }), defaultProfile);
    assert.equal(resolveProfile({ name: "Chair & Co" }).name, "Chair & Co");
    assert.deepEqual(resolveProfile({ name: "Chair & Co" }).hours, defaultProfile.hours);
  });

  it("overrides copy per language and keeps the default for a blank one", () => {
    const overrides = resolveTexts({ "home.statement": { mn: "", en: "New statement" }, "servicesPage.notes": { mn: "Нэг\nХоёр", en: "" } });
    const english = applyTextOverrides(en, overrides, "en");
    const mongolian = applyTextOverrides(mn, overrides, "mn");
    assert.equal(english.home.statement, "New statement");
    assert.equal(mongolian.home.statement, mn.home.statement);
    assert.deepEqual(mongolian.servicesPage.notes, ["Нэг", "Хоёр"]);
    assert.deepEqual(english.servicesPage.notes, en.servicesPage.notes);
    assert.notEqual(english, en, "the shared dictionary object is never mutated");
    assert.notEqual(en.home.statement, "New statement");
  });

  it("ignores unknown copy keys", () => {
    assert.deepEqual(resolveTexts({ "admin.common.save": { mn: "x", en: "y" } }), {});
  });

  it("orders and hides gallery items", () => {
    const items = ["a", "b", "c", "d"].map((id) => ({ id }));
    assert.deepEqual(curate(items, { order: ["c", "a"], hidden: ["b"] }).map((i) => i.id), ["c", "a", "d"]);
  });

  it("builds a tel: link from a display number", () => {
    assert.equal(phoneHrefFor("+976 8800-1234"), "tel:+97688001234");
    assert.equal(phoneHrefFor(""), "");
  });
});
