export function millisecondsUntil(targetIso: string, now: () => number = Date.now): number {
  return Math.max(0, new Date(targetIso).getTime() - now());
}

export function formatCountdownDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}
