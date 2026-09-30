"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AssetSearchHotkey() {
  const router = useRouter();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      event.preventDefault();
      if (window.location.pathname.includes("/assets")) {
        window.dispatchEvent(new Event("ayv-focus-asset-search"));
        return;
      }
      router.push("/assets");
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
