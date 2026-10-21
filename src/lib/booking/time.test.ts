import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addCalendarDays, isISODate, isoWeekday, parseTime, zonedParts, zonedTimeToUtc } from "./time";

const UB = "Asia/Ulaanbaatar";

describe("studio time zone", () => {
  it("converts Ulaanbaatar wall-clock time to UTC (UTC+8)", () => {
    assert.equal(zonedTimeToUtc("2026-10-21", 10 * 60, UB).toISOString(), "2026-10-21T02:00:00.000Z");
    assert.equal(zonedTimeToUtc("2026-10-21", 0, UB).toISOString(), "2026-10-20T16:00:00.000Z");
  });

  it("reads the Ulaanbaatar date, minutes and weekday of an instant", () => {
    // 16:30 UTC on the 21st is 00:30 on Thursday the 22nd in Ulaanbaatar.
    assert.deepEqual(zonedParts(new Date("2026-10-21T16:30:00Z"), UB), { date: "2026-10-22", minutes: 30, weekday: 4 });
  });

  it("round-trips across the day boundary", () => {
    for (const minutes of [0, 7 * 60 + 59, 8 * 60, 23 * 60 + 59]) {
      const instant = zonedTimeToUtc("2026-03-01", minutes, UB);
      assert.deepEqual(zonedParts(instant, UB), { date: "2026-03-01", minutes, weekday: 0 });
    }
  });

  it("handles a zone with daylight saving time", () => {
    // 10:00 in New York is 14:00 UTC in summer and 15:00 UTC in winter.
    assert.equal(zonedTimeToUtc("2026-07-01", 600, "America/New_York").toISOString(), "2026-07-01T14:00:00.000Z");
    assert.equal(zonedTimeToUtc("2026-12-01", 600, "America/New_York").toISOString(), "2026-12-01T15:00:00.000Z");
  });
});

describe("calendar helpers", () => {
  it("adds days across month and year ends", () => {
    assert.equal(addCalendarDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addCalendarDays("2028-02-28", 1), "2028-02-29");
    assert.equal(addCalendarDays("2026-03-01", -1), "2026-02-28");
  });

  it("validates dates and times strictly", () => {
    assert.equal(isISODate("2026-02-29"), false);
    assert.equal(isISODate("2026-10-21"), true);
    assert.equal(isISODate("2026-10-21T00:00"), false);
    assert.equal(parseTime("09:30"), 570);
    assert.equal(parseTime("24:00"), null);
    assert.equal(parseTime("9:30"), null);
  });

  it("computes weekdays independently of the host time zone", () => {
    assert.equal(isoWeekday("2026-10-21"), 3);
  });
});
