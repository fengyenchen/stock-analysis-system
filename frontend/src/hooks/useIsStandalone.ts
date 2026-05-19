import { useState, useEffect } from "react";

export function useIsStandalone() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS property
      window.navigator.standalone === true;
    setIsStandalone(standalone);
  }, []);

  return isStandalone;
}
