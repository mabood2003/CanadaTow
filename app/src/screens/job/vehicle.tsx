"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { Banner, Button, ErrorText, Field, inputClass, PageShell } from "@/components/ui";
import { GuardrailError, updateDetails } from "@/lib/jobs";
import { jobHref, nextHref } from "@/lib/job-steps";
import { attempt, mutateJob } from "@/lib/store";
import { currentEstimate } from "@/lib/tow-rules";

const PROVINCES = ["AB", "BC", "SK", "MB", "ON", "QC", "NB", "NS", "PE", "NL", "YT", "NT", "NU", "Out of country"];
const SAMPLE_LOCATION = "Near 17 Ave SW & 4 St SW, Calgary";

export default function VehicleStepPage() {
  return <JobScreen>{(ctx) => <VehicleForm {...ctx} />}</JobScreen>;
}

function VehicleForm({ app, job }: JobContext) {
  const router = useRouter();
  const prefill = job.prefill ?? {};
  const fresh = !job.vehicle.plate;
  const [vehicle, setVehicle] = useState(fresh && prefill.vehicle ? prefill.vehicle : job.vehicle);
  const [pickup, setPickup] = useState(job.pickup);
  const [destination, setDestination] = useState(job.destination);
  const [suppliedBy, setSuppliedBy] = useState(job.destinationConfirmedBy || prefill.destinationConfirmedBy || "");
  const [notes, setNotes] = useState(job.notes);
  const [located, setLocated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const towStarted = Boolean(job.tow.secured);
  const estimate = currentEstimate(job);
  const requireDestination = Boolean(job.workflow?.requireDestination);
  const setV = (patch: Partial<typeof vehicle>) => setVehicle((v) => ({ ...v, ...patch }));

  // Prototype: location lookup is simulated so the demo works anywhere.
  const useCurrentLocation = () => {
    setPickup(prefill.pickup ?? SAMPLE_LOCATION);
    setLocated(true);
  };

  const save = () => {
    const failure = attempt(() => {
      const v = { ...vehicle, plate: vehicle.plate.trim().toUpperCase(), make: vehicle.make.trim(), model: vehicle.model.trim(), colour: vehicle.colour.trim(), year: vehicle.year.trim() };
      if (!v.plate) throw new GuardrailError("Enter the plate (or VIN if there's no plate).");
      if (!v.make) throw new GuardrailError("Enter the vehicle make.");
      if (!pickup.trim()) throw new GuardrailError("Enter the pickup location.");
      if (!destination.trim()) throw new GuardrailError("Enter the intended destination.");
      if (requireDestination && !suppliedBy.trim()) throw new GuardrailError("Record who supplied or confirmed the destination.");
      const updated = mutateJob(job.id, (j, actor) =>
        updateDetails(
          j,
          actor,
          { vehicle: v, pickup: pickup.trim(), destination: destination.trim(), destinationConfirmedBy: suppliedBy.trim(), notes: notes.trim() },
          `Vehicle and job details recorded: ${v.plate} ${v.province}; ${pickup.trim()} → ${destination.trim()}${suppliedBy.trim() ? ` (destination supplied by ${suppliedBy.trim()})` : ""}`,
        ),
      );
      router.replace(nextHref(updated, "vehicle"));
    });
    setError(failure);
  };

  const destinationDiffersFromEstimate = estimate && destination.trim() !== estimate.destination;
  const suggestions = [job.customer.name, job.contactName].filter((s, i, all) => s && all.indexOf(s) === i);

  return (
    <PageShell>
      <StepHeader job={job} step="vehicle" title="Vehicle and job details" />
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Plate">
            <input className={`${inputClass} font-mono uppercase tracking-wider`} autoCapitalize="characters" value={vehicle.plate} onChange={(e) => setV({ plate: e.target.value })} />
          </Field>
          <Field label="Province">
            <select className={inputClass} value={vehicle.province} onChange={(e) => setV({ province: e.target.value })}>
              {PROVINCES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Make">
            <input className={inputClass} value={vehicle.make} onChange={(e) => setV({ make: e.target.value })} />
          </Field>
          <Field label="Model">
            <input className={inputClass} value={vehicle.model} onChange={(e) => setV({ model: e.target.value })} />
          </Field>
          <Field label="Year">
            <input className={inputClass} inputMode="numeric" maxLength={4} value={vehicle.year} onChange={(e) => setV({ year: e.target.value.replace(/\D/g, "") })} />
          </Field>
          <Field label="Colour">
            <input className={inputClass} value={vehicle.colour} onChange={(e) => setV({ colour: e.target.value })} />
          </Field>
        </div>

        {towStarted ? (
          <Banner tone="neutral" title="Tow in progress">
            Pickup and destination are locked. To move the vehicle somewhere else, use “Destination changed” on the{" "}
            <a className="font-semibold underline" href={jobHref(job, "tow")}>
              tow screen
            </a>
            .
          </Banner>
        ) : null}

        <Field label="Pickup location" hint={located ? "Prototype: location lookup is simulated." : undefined}>
          <input className={inputClass} value={pickup} disabled={towStarted} onChange={(e) => setPickup(e.target.value)} placeholder="Address or intersection" />
        </Field>
        {!towStarted ? (
          <Button variant="secondary" full icon="navigation" onClick={useCurrentLocation}>
            Use current location
          </Button>
        ) : null}

        <Field label="Intended destination">
          <input className={inputClass} value={destination} disabled={towStarted} onChange={(e) => setDestination(e.target.value)} placeholder="Where the vehicle is going" />
        </Field>
        {!towStarted && app.yards.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {[prefill.destination, ...app.yards.map((y) => `${y.name} — ${y.address}`)]
              .filter((d): d is string => Boolean(d))
              .filter((d, i, all) => all.indexOf(d) === i)
              .map((value) => (
                <button key={value} type="button" onClick={() => setDestination(value)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-sm font-medium text-ink hover:border-pine/50">
                  <Icon name="mapPin" className="h-4 w-4 text-pine" />
                  {value.split(" — ")[0]}
                </button>
              ))}
          </div>
        ) : null}

        <Field label="Destination supplied / confirmed by" optional={!requireDestination} hint={requireDestination ? `${app.company.name}'s workflow records who supplied the destination.` : undefined}>
          <input className={inputClass} value={suppliedBy} disabled={towStarted} onChange={(e) => setSuppliedBy(e.target.value)} placeholder="Person's name" />
        </Field>
        {!towStarted && suggestions.length > 0 ? (
          <div className="-mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => setSuppliedBy(s)} className="min-h-9 rounded-full bg-mint px-3 text-sm font-semibold text-pine">
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {destinationDiffersFromEstimate && !towStarted ? (
          <Banner tone="warn">This destination differs from estimate v{estimate.version}. You&apos;ll need to issue a revised estimate and repeat the consent step.</Banner>
        ) : null}

        <Field label="Notes" optional>
          <textarea className={`${inputClass} min-h-24`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access, damage, keys, anything the office should know" />
        </Field>

        <ErrorText message={error} />
        <Button size="lg" full onClick={save}>
          Save and continue
        </Button>
      </div>
    </PageShell>
  );
}
