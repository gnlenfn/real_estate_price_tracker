import { test } from "node:test";
import assert from "node:assert/strict";
import { apartmentCandidates, jibunFromAddress } from "../lib/apartment";

test("Kakao place results keep apartment candidates and remove realtors and duplicates", () => {
  const apartment = {
    id: "1",
    place_name: "래미안 원베일리 아파트",
    category_name: "부동산 > 주거시설 > 아파트",
    address_name: "서울 서초구 반포동 1-1",
    road_address_name: "서울 서초구 반포대로 333",
    x: "127",
    y: "37",
  };
  assert.deepEqual(
    apartmentCandidates(
      [
        apartment,
        apartment,
        {
          ...apartment,
          id: "2",
          place_name: "원베일리공인중개사",
          category_name: "부동산 > 중개업소",
        },
      ],
      "원베일리",
    ),
    [
      {
        id: "1",
        name: "래미안 원베일리",
        address: "서울 서초구 반포동 1-1",
        roadAddress: "서울 서초구 반포대로 333",
        x: "127",
        y: "37",
      },
    ],
  );
});

test("lot number is extracted from a full Korean address", () => {
  assert.equal(jibunFromAddress("서울 서초구 반포동 1-1"), "1-1");
  assert.equal(jibunFromAddress("주소 없음"), "");
});
