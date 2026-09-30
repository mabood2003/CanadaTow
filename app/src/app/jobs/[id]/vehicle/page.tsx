"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { Banner, Button, Checkbox, ErrorText, Field, inputClass, PageShell } from "@/components/ui";
import { GuardrailError, updateDetails } from "@/lib/jobs";
import { jobHref, nextHref } from "@/lib/job-steps";
import { attempt, mutateJob } from "@/lib/store";
import { currentEstimate, resolveWorkflow } from "@/lib/tow-rules";

const PROVINCES = ["AB", "BC", "SK", "MB", "ON", "QC", "NB", "NS", "PE", "NL", "YT", "NT", "NU", "Out of country"];

export default function VehicleStepPage() {
  return <JobScreen>{(ctx) => <VehicleForm {...ctx} />}</JobScreen>;
}

function VehicleForm({ app, job, type }: JobContext) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState(job.vehicle);
  const [pickup, setPickup] = useState(job.pickup);
  const [destination, setDestination] = useState(job.destination);
  const [confirmed, setConfirmed] = useState(job.destinationConfirmed);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exempt = resolveWorkflow(type).runs === "exempt";
  const towStarted = Boolean(job.tow.secured);
  const estimate = currentEstimate(job);
  const setV = (patch: Partial<typeof vehicle>) => setVehicle((v) => ({ ...v, ...patch }));

  const changeDestination = (value: string) => {
    setDestination(value);
    // A confirmation only covers the destination the customer actually saw.
    if (value !== job.destination) setConfirmed(false);
  };

  const useCurrentLocation = () => {
    if (!("geolocation" in navigator)) return setError("Location isn't available on this device — type the pickup address.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        setPickup(`GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)} m)`);
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location — type the pickup address.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const save = () => {
    const failure = attempt(() => {
      const v = { ...vehicle, plate: vehicle.plate.trim().toUpperCase(), make: vehicle.make.trim(), model: vehicle.model.trim(), colour: vehicle.colour.trim(), year: vehicle.year.trim() };
      if (!v.plate) throw new GuardrailError("Enter the plate (or VIN if there's no plate).");
      if (!v.make) throw new GuardrailError("Enter the vehicle make.");
      if (!pickup.trim()) throw new GuardrailError("Enter the pickup location.");
      if (!destination.trim()) throw new GuardrailError("Enter the destination.");
      const updated = mutateJob(job.id, (j, actor) =>
        updateDetails(
          j,
          actor,
          { vehicle: v, pickup: pickup.trim(), destination: destination.trim(), destinationConfirmed: exempt ? j.destinationConfirmed : confirmed },
          `Vehicle and tow details recorded: ${v.plate} ${v.province}; ${pickup.trim()} → ${destination.trim()}${!exempt && confirmed ? " (destination confirmed by customer)" : ""}`,
        ),
      );
      router.replace(nextHref(updated, type, "vehicle"));
    });
    setError(failure);
  };

  const destinationDiffersFromEstimate = estimate && destination.trim() !== estimate.destination;

  return (
    <PageShell>
      <StepHeader job={job} type={type} title="Vehicle and tow details" />
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Plate">
            <input className={`${inputClass} uppercase`} autoCapitalize="characters" value={vehicle.plate} onChange={(e) => setV({ plate: e.target.value })} />
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

        <Field label="Pickup location">
          <input className={inputClass} value={pickup} disabled={towStarted} onChange={(e) => setPickup(e.target.value)} placeholder="Address or intersection" />
        </Field>
        {!towStarted ? (
          <Button variant="secondary" full onClick={useCurrentLocation} disabled={locating}>
            {locating ? "Getting location…" : "Use current location"}
          </Button>
        ) : null}

        <Field label="Destination">
          <input className={inputClass} value={destination} disabled={towStarted} onChange={(e) => changeDestination(e.target.value)} placeholder="Where the customer wants it towed" />
        </Field>
        {!towStarted && app.yards.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {app.yards.map((yard) => {
              const value = `${yard.name} — ${yard.address}`;
              return (
                <button
                  key={yard.id}
                  type="button"
                  onClick={() => changeDestination(value)}
                  className="min-h-10 rounded-full bg-white px-3 text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:ring-slate-500"
                >
                  Our yard: {yard.name}
                </button>
              );
            })}
          </div>
        ) : null}

        {!exempt ? (
          <Checkbox checked={confirmed} disabled={towStarted} onChange={setConfirmed}>
            <strong>Destination confirmed by customer.</strong> The customer agreed this is where the vehicle goes.
          </Checkbox>
        ) : null}

        {destinationDiffersFromEstimate && !towStarted ? (
          <Banner tone="warn">This destination differs from estimate v{estimate.version}. You&apos;ll need to issue a revised estimate and get consent again.</Banner>
        ) : null}

        <ErrorText message={error} />
        <Button size="lg" full onClick={save}>
          Save and continue
        </Button>
      </div>
    </PageShell>
  );
}
