"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function subscribeDisplayMode(callback: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** "Add to home screen" for this app. Android/Chrome gets a real Install button; iPhone gets the Share-menu steps. */
export function InstallApp({ appName }: { appName: string }) {
  const installed = useSyncExternalStore(subscribeDisplayMode, isStandalone, () => false);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios] = useState(() => typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent));

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (installed) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Icon name="check" className="h-4 w-4 text-ok" strokeWidth={3} /> {appName} is installed on this device.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">Put {appName} on your home screen so it opens full-screen like any other app.</p>
      {prompt ? (
        <Button
          icon="download"
          onClick={async () => {
            await prompt.prompt();
            setPrompt(null);
          }}
        >
          Install {appName}
        </Button>
      ) : ios ? (
        <ol className="list-decimal space-y-1 pl-5">
          <li>Tap the Share button in Safari.</li>
          <li>Choose “Add to Home Screen”.</li>
          <li>Tap “Add”.</li>
        </ol>
      ) : (
        <p>In your browser menu, choose “Install app” or “Add to Home screen”.</p>
      )}
    </div>
  );
}
