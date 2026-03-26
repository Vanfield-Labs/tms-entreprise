import { useState } from "react";

export function useFlashHighlight(duration = 3000) {
  const [flashIds, setFlashIds] = useState<Record<string, boolean>>({});

  function flash(id: string) {
    setFlashIds((prev) => ({ ...prev, [id]: true }));

    window.setTimeout(() => {
      setFlashIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, duration);
  }

  return { flashIds, flash };
}