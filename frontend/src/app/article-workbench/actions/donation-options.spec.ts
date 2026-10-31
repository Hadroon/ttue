import { donationOptions } from './donation-options';

describe('donationOptions', () => {
  const presets = [10, 25, 50, 100];
  const amounts = (remaining: number) => donationOptions(remaining, presets).map(o => (o.rest ? `rest ${o.amount}` : o.amount));

  it('offers every preset while the target is far away', () => {
    expect(amounts(5000)).toEqual([10, 25, 50, 100]);
    expect(amounts(100)).toEqual([10, 25, 50, 100]);
  });

  it('hides presets larger than what is left and offers the remainder', () => {
    expect(amounts(60)).toEqual([10, 25, 50, 'rest 60']);
    expect(amounts(99)).toEqual([10, 25, 50, 'rest 99']);
  });

  it('does not repeat a preset that already equals the remainder', () => {
    expect(amounts(25)).toEqual([10, 25]);
    expect(amounts(10)).toEqual([10]);
  });

  it('offers only the remainder when it is below the smallest preset', () => {
    expect(amounts(7)).toEqual(['rest 7']);
    expect(amounts(1)).toEqual(['rest 1']);
  });

  it('rounds a fractional remainder up to a whole unit', () => {
    expect(amounts(7.2)).toEqual(['rest 8']);
    expect(amounts(12)).toEqual([10, 'rest 12']);
  });

  it('offers nothing once the target is covered', () => {
    expect(amounts(0)).toEqual([]);
    expect(amounts(-40)).toEqual([]);
  });
});
