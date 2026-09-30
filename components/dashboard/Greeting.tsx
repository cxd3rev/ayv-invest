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

export function Greeting({ name, withName = true }: { name: string; withName?: boolean }) {
  const label = useSyncExternalStore(subscribe, greetingLabel, () => "Hello");

  return <span>{withName ? `${label}, ${name}` : label}</span>;
}
