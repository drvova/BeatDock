export function getValidVolume(envValue: string | undefined, defaultValue = 80): number {
  const vol = parseInt(envValue ?? '', 10);
  return Number.isNaN(vol) ? defaultValue : Math.max(0, Math.min(150, vol));
}
