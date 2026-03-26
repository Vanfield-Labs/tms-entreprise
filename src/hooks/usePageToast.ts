import { useState } from "react";

export function usePageToast(duration = 2500) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(message: string) {
    setToastMessage(message);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => {
      setToastMessage(null);
    }, duration);
  }

  function clearToast() {
    setToastMessage(null);
  }

  return {
    toastMessage,
    showToast,
    clearToast,
  };
}