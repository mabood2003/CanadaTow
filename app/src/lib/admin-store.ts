// TowLedger admin console actions. Every one writes an admin audit row (who, what, when, which company).
import type { Actor } from "@/lib/domain";
import { GuardrailError, newId } from "@/lib/jobs";
import { inviteMessage } from "@/lib/messages";
import { adminAudit, COMPANY_STATUS_LABELS, companyFromTemplate, validateOnboarding, type CompanyStatus, type OnboardingInput, type PlatformAdmin, type PlatformState } from "@/lib/platform";
import { deviceLabel, getPlatform, setPlatform } from "@/lib/store";

export function currentAdmin(p: PlatformState): PlatformAdmin | undefined {
  return p.admins.find((a) => a.id === p.adminSession);
}

function requireAdmin(p: PlatformState): PlatformAdmin {
  const admin = currentAdmin(p);
  if (!admin) throw new GuardrailError("Sign in to the TowLedger admin console first.");
  return admin;
}

function companyName(p: PlatformState, companyId: string) {
  const account = p.companies.find((c) => c.id === companyId);
  if (!account) throw new GuardrailError("Company not found.");
  return account.data.company.name;
}

export function adminSignIn(adminId: string) {
  setPlatform((p) => {
    const admin = p.admins.find((a) => a.id === adminId);
    if (!admin) return p;
    return adminAudit({ ...p, adminSession: admin.id }, admin.name, new Date().toISOString(), `Signed in to the admin console (${deviceLabel()})`);
  });
}

export function adminSignOut() {
  setPlatform((p) => {
    const admin = currentAdmin(p);
    const signedOut = { ...p, adminSession: null };
    return admin ? adminAudit(signedOut, admin.name, new Date().toISOString(), "Signed out of the admin console") : signedOut;
  });
}

/** Creates a company from the TowLedger starting template and invites its owner. Returns the new company id. */
export function onboardCompany(input: OnboardingInput): string {
  const p = getPlatform();
  const admin = requireAdmin(p);
  const problem = validateOnboarding(input, p.companies);
  if (problem) throw new GuardrailError(problem);
  const id = newId("co-");
  const actor: Actor = { by: admin.name, role: "system", device: "TowLedger admin", now: new Date().toISOString() };
  const data = companyFromTemplate(input, actor, window.location.origin);
  setPlatform((current) =>
    adminAudit(
      { ...current, companies: [...current.companies, { id, status: "onboarding", createdAt: actor.now, createdBy: admin.name, notes: "", data }] },
      admin.name,
      actor.now,
      `Onboarded ${data.company.name} from the TowLedger starting template; invited owner ${input.ownerName.trim()} (${input.ownerEmail.trim()})`,
      id,
    ),
  );
  return id;
}

export function setCompanyStatus(companyId: string, status: CompanyStatus) {
  setPlatform((p) => {
    const admin = requireAdmin(p);
    const account = p.companies.find((c) => c.id === companyId);
    if (!account || account.status === status) return p;
    const next = { ...p, companies: p.companies.map((c) => (c.id === companyId ? { ...c, status } : c)) };
    return adminAudit(next, admin.name, new Date().toISOString(), `Changed ${account.data.company.name} from ${COMPANY_STATUS_LABELS[account.status]} to ${COMPANY_STATUS_LABELS[status]}`, companyId);
  });
}

export function saveCompanyNotes(companyId: string, notes: string) {
  setPlatform((p) => {
    const admin = requireAdmin(p);
    const next = { ...p, companies: p.companies.map((c) => (c.id === companyId ? { ...c, notes } : c)) };
    return adminAudit(next, admin.name, new Date().toISOString(), `Updated internal notes for ${companyName(p, companyId)}`, companyId);
  });
}

/** Support access is read-only, and every look inside a company's records is logged. */
export function recordAdminView(companyId: string, what: string) {
  setPlatform((p) => {
    const admin = currentAdmin(p);
    if (!admin) return p;
    const now = new Date().toISOString();
    const action = `Viewed ${companyName(p, companyId)} — ${what}`;
    const last = p.adminAudit.at(-1);
    // Re-opening the same screen within a few seconds is one look, not two.
    if (last && last.by === admin.name && last.action === action && Date.parse(now) - Date.parse(last.at) < 5000) return p;
    return adminAudit(p, admin.name, now, action, companyId);
  });
}

export function resendOwnerInvite(companyId: string) {
  setPlatform((p) => {
    const admin = requireAdmin(p);
    const account = p.companies.find((c) => c.id === companyId);
    const owner = account?.data.team.find((m) => m.role === "owner");
    if (!account || !owner) throw new GuardrailError("This company has no owner to invite.");
    const now = new Date().toISOString();
    const message = inviteMessage({ name: owner.name, email: owner.email, company: account.data.company, origin: window.location.origin, actor: { by: admin.name, role: "system", device: "TowLedger admin", now } });
    const next = { ...p, companies: p.companies.map((c) => (c.id === companyId ? { ...c, data: { ...c.data, outbox: [message, ...c.data.outbox] } } : c)) };
    return adminAudit(next, admin.name, now, `Re-sent the owner invite to ${owner.name} (${owner.email})`, companyId);
  });
}
