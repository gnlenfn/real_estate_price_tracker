import assert from "node:assert/strict";
import { test } from "node:test";
import type { Property } from "../lib/model";
import { groupPropertiesByComplex, propertyAreaLabel } from "../lib/property-display";

const property = (overrides: Partial<Property>): Property => ({
  id: "property",
  name: "마포래미안푸르지오",
  district: "11440",
  dong: "아현동",
  area: 84.9,
  owned: false,
  color: "#285ee8",
  ...overrides,
});

test("properties with the same apartment identity form one area-sorted complex group", () => {
  const groups = groupPropertiesByComplex([
    property({ id: "84", area: 84.9, apt_seq: "11440-100" }),
    property({ id: "59", area: 59.8, apt_seq: "11440-100" }),
    property({ id: "other", area: 84.7, apt_seq: "11440-200" }),
  ]);

  assert.deepEqual(
    groups.map((group) => group.properties.map(({ id }) => id)),
    [["59", "84"], ["other"]],
  );
});

test("legacy properties group by location and normalized complex name", () => {
  const groups = groupPropertiesByComplex([
    property({ id: "59", area: 59.8, name: " 마포 래미안푸르지오 " }),
    property({ id: "84", area: 84.9, name: "마포래미안푸르지오" }),
    property({ id: "different-dong", area: 84.9, dong: "공덕동" }),
  ]);

  assert.deepEqual(
    groups.map((group) => group.properties.map(({ id }) => id)),
    [["59", "84"], ["different-dong"]],
  );
});

test("property labels always include the registered integer area", () => {
  assert.equal(propertyAreaLabel(property({ area: 84.9 })), "마포래미안푸르지오 · 84㎡");
});
