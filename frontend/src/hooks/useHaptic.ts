export function useHaptic() {
  const trigger = (pattern: number | number[] = 10) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  return { trigger };
}
