"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function greetingLabel() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ name }: { name: string }) {
  const label = useSyncExternalStore(subscribe, greetingLabel, () => "Hello");

  return (
    <p className="text-sm text-muted">
      {label}, {name}
    </p>
  );
}
