import { test } from "node:test";
import assert from "node:assert/strict";
import { propertyRegionLabel, regionOptions } from "../lib/property-context";
import type { Property } from "../lib/model";

const property = (overrides: Partial<Property>): Property => ({
  id: "p",
  name: "테스트 단지",
  district: "11440",
  dong: "아현동",
  area: 84,
  owned: false,
  color: "#000",
  ...overrides,
});

test("property regions use a readable city county district label and preserve distinct legal codes", () => {
  const properties = [
    property({ id: "mapo", district: "11440", road_address: "서울특별시 마포구 신수동 1" }),
    property({ id: "bundang", district: "41135", jibun_address: "경기도 성남시 분당구 정자동 2" }),
    property({ id: "legacy", district: "99999" }),
  ];
  assert.equal(propertyRegionLabel(properties[1]), "경기 성남시 분당구");
  assert.deepEqual(regionOptions(properties), [
    { id: "41135", label: "경기 성남시 분당구" },
    { id: "11440", label: "서울 마포구" },
    { id: "99999", label: "지역 코드 99999" },
  ]);
});

test("property regions support the abbreviated addresses returned by Kakao search", () => {
  assert.equal(
    propertyRegionLabel(property({ road_address: "서울 서초구 반포대로 333" })),
    "서울 서초구",
  );
  assert.equal(
    propertyRegionLabel(property({ jibun_address: "경기 성남시 분당구 정자동 2" })),
    "경기 성남시 분당구",
  );
});
