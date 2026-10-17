/**
 * Delays calling `fn` until `waitMs` has passed without another call.
 *
 * @param fn - The function to delay
 * @param waitMs - Quiet period before it runs
 * @returns The delayed function, plus `cancel()` to drop a pending call
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function debounced(...args: A) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  }
  debounced.cancel = () => clearTimeout(timer);

  return debounced;
}
