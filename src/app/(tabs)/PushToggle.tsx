"use client";

import { useEffect, useState } from "react";
import { removePush, savePush } from "./push-actions";

const key = (b64: string) => {
  const raw = atob(
    (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"),
  );
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/**
 * Morning notification switch. iOS only offers push to apps added to the home screen, and only
 * after a tap, so the switch shows there and asks then.
 */
export function PushToggle() {
  const [state, setState] = useState<"hidden" | "off" | "on" | "busy">("hidden");
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    )
      return;
    navigator.serviceWorker.ready
      .then((r) => r.pushManager.getSubscription())
      .then((s) => setState(s ? "on" : "off"))
      .catch(() => setState("hidden"));
  }, []);
  if (state === "hidden")
    return (
      <p className="caption">
        Add pulse to your Home Screen (Share → Add to Home Screen) and open it from there to turn
        this on.
      </p>
    );
  const toggle = async () => {
    setState("busy");
    const reg = await navigator.serviceWorker.ready;
    const current = await reg.pushManager.getSubscription();
    try {
      if (current) {
        // Browser first: a leftover server row is dropped by the next push (410).
        await current.unsubscribe();
        await removePush(current.endpoint);
      } else {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string),
        });
        // Not saved on the server = no pushes: don't leave the browser subscribed.
        await savePush(sub.toJSON() as Parameters<typeof savePush>[0]).catch(async (e) => {
          await sub.unsubscribe();
          throw e;
        });
      }
    } catch {
      // Permission refused or the server said no: the state below says where it landed.
    } finally {
      setState((await reg.pushManager.getSubscription()) ? "on" : "off");
    }
  };
  return (
    <button
      type="button"
      className="push-toggle"
      aria-pressed={state === "on"}
      disabled={state === "busy"}
      onClick={toggle}
    >
      <span>Morning notification</span>
      <span className="switch" aria-hidden="true" />
    </button>
  );
}
