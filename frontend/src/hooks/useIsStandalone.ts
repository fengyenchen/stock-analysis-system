import { useState } from "react";

function getIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS property
    window.navigator.standalone === true
  );
}

export function useIsStandalone() {
  const [isStandalone] = useState(getIsStandalone);
  return isStandalone;
}
