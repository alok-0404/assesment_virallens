/** Per-process lock registry used to reject concurrent sends for the same conversation. */
export function createInFlightRegistry() {
  const active = new Set();

  return {
    acquire(key) {
      if (active.has(key)) return null;
      active.add(key);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active.delete(key);
      };
    },
    size: () => active.size,
  };
}
