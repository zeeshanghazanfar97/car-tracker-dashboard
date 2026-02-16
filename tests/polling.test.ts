import { describe, expect, it } from "vitest";
import { computePollDelayMs } from "@/lib/polling";

describe("computePollDelayMs", () => {
  it("uses active interval when tab is visible", () => {
    expect(
      computePollDelayMs({
        isHidden: false,
        activeIntervalSec: 3,
        backgroundIntervalSec: 15,
        consecutiveErrors: 0
      })
    ).toBe(3000);
  });

  it("uses background interval when tab is hidden", () => {
    expect(
      computePollDelayMs({
        isHidden: true,
        activeIntervalSec: 3,
        backgroundIntervalSec: 15,
        consecutiveErrors: 0
      })
    ).toBe(15000);
  });

  it("applies exponential backoff and caps at 30 seconds", () => {
    expect(
      computePollDelayMs({
        isHidden: false,
        activeIntervalSec: 3,
        backgroundIntervalSec: 15,
        consecutiveErrors: 1
      })
    ).toBe(3000);

    expect(
      computePollDelayMs({
        isHidden: false,
        activeIntervalSec: 3,
        backgroundIntervalSec: 15,
        consecutiveErrors: 3
      })
    ).toBe(12000);

    expect(
      computePollDelayMs({
        isHidden: true,
        activeIntervalSec: 3,
        backgroundIntervalSec: 15,
        consecutiveErrors: 6
      })
    ).toBe(30000);
  });
});
