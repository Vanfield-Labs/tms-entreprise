// src/lib/debounce.ts
export function debounce<T extends (...args: any[]) => void>(fn: T, delay = 400) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}