import type { ConsentTemplate, Estimate, Job, JobVehicle } from "@/lib/domain";
import { formatMoney } from "@/lib/money";
import { renderConsentWording, type ConsentContext } from "@/lib/tow-rules";

/** "2019 Black Ford F-150" */
export function vehicleName(v: JobVehicle): string {
  return [v.year, v.colour, v.make, v.model].filter(Boolean).join(" ") || v.plate || "the vehicle";
}

/** "CKR 4821 (AB) · 2019 Black Ford F-150" */
export function vehicleLine(v: JobVehicle): string {
  return [v.plate && `${v.plate} (${v.province})`, [v.year, v.colour, v.make, v.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
}

/** Ends a sentence with a name without doubling a trailing period ("Summit Towing Ltd."). */
export function endSentence(text: string): string {
  return text.endsWith(".") ? text : `${text}.`;
}

export function initials(name: string): string {
  return (
    name
      .replace(/\b(ltd|inc|corp)\.?/gi, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "TL"
  );
}

export function consentContext(
  companyName: string,
  job: Job,
  estimate: Estimate | undefined,
  overrides: { name?: string; relationship?: string; amountCents?: number } = {},
): ConsentContext {
  return {
    company: companyName,
    customer: overrides.name ?? job.customer.name,
    relationship: (overrides.relationship ?? job.customer.relationship).toLowerCase(),
    vehicle: vehicleName(estimate?.vehicle ?? job.vehicle),
    estimate: job.number,
    total: formatMoney(overrides.amountCents ?? estimate?.totalCents ?? 0),
    destination: estimate?.destination ?? job.destination,
    storage: formatMoney(estimate?.storagePerDayCents ?? 0),
  };
}

/** The company's heading and wording with this job's details filled in — exactly what the customer sees. */
export function renderConsent(template: ConsentTemplate, ctx: ConsentContext) {
  return {
    templateVersion: template.version,
    heading: renderConsentWording(template.heading, ctx),
    wording: renderConsentWording(template.body, ctx),
    acceptLabel: template.acceptLabel,
  };
}
