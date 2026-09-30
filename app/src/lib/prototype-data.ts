export const companyProfile = {
  name: "Alberta Recovery Towing",
  address: "127 7 Ave SW, Calgary, AB",
  phone: "+1 (403) 555-0148",
  gstNumber: "GST 123456789RT0001",
  logo: "ART",
  driver: "Ava Thompson",
  yard: "Downtown Yard",
};

export type RequestWorkflow = "consumer" | "exempt" | "to_confirm";
export type RequestLegalStatus = "confirmed" | "to_be_confirmed";

export const requestTypes: Array<{
  id: string;
  label: string;
  workflow: RequestWorkflow;
  legalStatus: RequestLegalStatus;
}> = [
  { id: "owner_customer", label: "Vehicle owner/customer", workflow: "consumer", legalStatus: "confirmed" },
  { id: "owner_rep", label: "Owner's representative", workflow: "to_confirm", legalStatus: "to_be_confirmed" },
  { id: "motor_club", label: "Motor club / roadside assistance", workflow: "to_confirm", legalStatus: "to_be_confirmed" },
  { id: "insurance", label: "Insurance company", workflow: "to_confirm", legalStatus: "to_be_confirmed" },
  { id: "police", label: "Police", workflow: "exempt", legalStatus: "confirmed" },
  { id: "municipality", label: "Municipality/government", workflow: "exempt", legalStatus: "confirmed" },
  { id: "private_property", label: "Private-property owner", workflow: "to_confirm", legalStatus: "to_be_confirmed" },
  { id: "other", label: "Other", workflow: "to_confirm", legalStatus: "to_be_confirmed" },
];

export const recentJobs = [
  { id: "TW-2048", vehicle: "ABC 123", customer: "Jamie Clarke", status: "Complete", invoice: "Issued", consent: "Captured" },
  { id: "TW-2052", vehicle: "XYZ 781", customer: "A. Langford", status: "Waiting for consent", invoice: "Pending", consent: "Missing" },
  { id: "TW-2056", vehicle: "PQR 441", customer: "M. Singh", status: "Missing invoice", invoice: "Outstanding", consent: "Captured" },
];

export const rateCard = [
  { id: "hookup", label: "Hook-up", unit: "flat", amountCents: 17500 },
  { id: "km", label: "Kilometres travelled", unit: "per km", amountCents: 350 },
  { id: "winch", label: "Winching", unit: "flat", amountCents: 9000 },
  { id: "after_hours", label: "After-hours callout", unit: "flat", amountCents: 7000 },
  { id: "storage", label: "Storage", unit: "per day", amountCents: 3500 },
];

export const estimateRows = [
  { id: "hookup", label: "Hook-up", quantity: 1, amountCents: 17500 },
  { id: "km", label: "Kilometres travelled", quantity: 18, amountCents: 350 },
  { id: "winch", label: "Winching", quantity: 1, amountCents: 9000 },
  { id: "after_hours", label: "After-hours callout", quantity: 1, amountCents: 7000 },
  { id: "storage", label: "Storage", quantity: 2, amountCents: 3500 },
];

export const invoiceRows = [
  { id: "hookup", label: "Hook-up", quantity: 1, amountCents: 17500 },
  { id: "km", label: "Kilometres travelled", quantity: 22, amountCents: 350 },
  { id: "winch", label: "Winching", quantity: 1, amountCents: 9000 },
  { id: "after_hours", label: "After-hours callout", quantity: 1, amountCents: 7000 },
  { id: "storage", label: "Storage", quantity: 3, amountCents: 3500 },
];

export const officeJobs = [
  { id: "TW-2048", vehicle: "ABC 123", customer: "Jamie Clarke", driver: "Ava Thompson", requestType: "Vehicle owner/customer", estimate: "Sent", consent: "Signed", invoice: "Issued", status: "Complete" },
  { id: "TW-2052", vehicle: "XYZ 781", customer: "A. Langford", driver: "Ava Thompson", requestType: "Motor club / roadside assistance", estimate: "Pending", consent: "Missing", invoice: "Not issued", status: "Waiting for consent" },
  { id: "TW-2056", vehicle: "PQR 441", customer: "M. Singh", driver: "A. Patel", requestType: "Private-property owner", estimate: "Sent", consent: "Captured", invoice: "Not issued", status: "Problem state" },
];

export const demoScenarios: Array<{ name: string; workflow: RequestWorkflow }> = [
  { name: "Collision tow - customer called in", workflow: "consumer" },
  { name: "Motor-club breakdown tow", workflow: "to_confirm" },
  { name: "Private-property / police case", workflow: "exempt" },
];
