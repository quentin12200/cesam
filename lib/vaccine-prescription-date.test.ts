import test from "node:test";
import assert from "node:assert/strict";
import { ordonnanceCompatibleDate } from "./vaccine-prescription-date.ts";

test("earlier prescription is eligible", () => assert.equal(ordonnanceCompatibleDate("2026-11-02", "2026-11-04"), true));
test("same-day prescription is eligible", () => assert.equal(ordonnanceCompatibleDate("2026-11-04T18:00:00.000Z", "2026-11-04"), true));
test("later prescription is rejected", () => assert.equal(ordonnanceCompatibleDate("2026-11-05", "2026-11-04"), false));
test("historical injection date is authoritative", () => assert.equal(ordonnanceCompatibleDate(new Date("2026-11-05T00:00:00.000Z"), new Date("2026-11-04T00:00:00.000Z")), false));
test("invalid injection date is rejected", () => assert.equal(ordonnanceCompatibleDate("2026-11-02", "not-a-date"), false));
