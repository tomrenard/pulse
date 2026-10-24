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
  if (state === "hidden") return null;
  const toggle = async () => {
    setState("busy");
    const reg = await navigator.serviceWorker.ready;
    const current = await reg.pushManager.getSubscription();
    if (current) {
      await removePush(current.endpoint);
      await current.unsubscribe();
      setState("off");
      return;
    }
    try {
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string),
      });
      await savePush(sub.toJSON() as Parameters<typeof savePush>[0]);
      setState("on");
    } catch {
      setState("off"); // permission refused
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
