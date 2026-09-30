import { describe, expect, it } from "vitest";

import { buildEstimate, calculateGst, canStartTow, getTowGateMessage } from "@/lib/tow-rules";

describe("TowLedger guardrails", () => {
  it("calculates GST at 5% of the subtotal", () => {
    expect(calculateGst(10000)).toBe(500);
    expect(calculateGst(17500)).toBe(875);
  });

  it("builds a customer-facing estimate with subtotal, GST and total", () => {
    const estimate = buildEstimate(15000);

    expect(estimate).toEqual({
      subtotalCents: 15000,
      gstCents: 750,
      totalCents: 15750,
    });
  });

  it("locks the tow gate unless the estimate, consent and destination are all complete", () => {
    expect(
      canStartTow({
        workflow: "consumer",
        estimateSent: true,
        consentCaptured: true,
        destinationConfirmed: true,
      }),
    ).toBe(true);

    expect(
      canStartTow({
        workflow: "consumer",
        estimateSent: true,
        consentCaptured: false,
        destinationConfirmed: true,
      }),
    ).toBe(false);

    expect(
      getTowGateMessage({
        workflow: "consumer",
        estimateSent: true,
        consentCaptured: false,
        destinationConfirmed: true,
      }),
    ).toBe("Do not begin tow — consent missing.");
  });
});
