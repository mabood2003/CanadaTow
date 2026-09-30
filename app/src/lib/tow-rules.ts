export type Workflow = "consumer" | "exempt" | "to_confirm";

export interface TowGateState {
  workflow?: Workflow;
  estimateSent: boolean;
  consentCaptured: boolean;
  destinationConfirmed: boolean;
}

export function calculateGst(amountCents: number): number {
  return Math.round((amountCents * 5) / 100);
}

export function buildEstimate(subtotalCents: number) {
  const gstCents = calculateGst(subtotalCents);

  return {
    subtotalCents: subtotalCents,
    gstCents,
    totalCents: subtotalCents + gstCents,
  };
}

export function canStartTow({
  workflow = "consumer",
  estimateSent,
  consentCaptured,
  destinationConfirmed,
}: TowGateState): boolean {
  if (workflow === "exempt") {
    return true;
  }

  return estimateSent && consentCaptured && destinationConfirmed;
}

export function getTowGateMessage(state: TowGateState): string {
  if (state.workflow === "exempt") {
    return "Tow may begin.";
  }

  if (!state.estimateSent || !state.consentCaptured || !state.destinationConfirmed) {
    return "Do not begin tow — consent missing.";
  }

  return "Tow may begin.";
}
