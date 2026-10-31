export interface DonationOption {
  amount: number;
  /** true for the button that covers whatever is left of the target */
  rest: boolean;
}

/**
 * Quick-donation buttons for something with a funding target: the presets that still fit in what is
 * left, plus a button for the exact remainder when a larger preset had to be hidden (so a target that is
 * nearly met can still be finished). Nothing is offered once the target is covered.
 */
export function donationOptions(remaining: number, presets: readonly number[]): DonationOption[] {
  const left = Math.ceil(remaining - 1e-9);
  if (left <= 0) return [];
  const fitting = presets.filter(p => p <= left).map(amount => ({ amount, rest: false }));
  const hidden = presets.some(p => p > left);
  return hidden && !fitting.some(o => o.amount === left) ? [...fitting, { amount: left, rest: true }] : fitting;
}
