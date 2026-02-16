const MAX_POLL_DELAY_MS = 30_000;

function toIntervalMs(intervalSec: number, fallbackSec: number): number {
  const seconds = Number.isFinite(intervalSec) && intervalSec > 0 ? intervalSec : fallbackSec;
  return Math.max(1000, Math.round(seconds * 1000));
}

export function computePollDelayMs(params: {
  isHidden: boolean;
  activeIntervalSec: number;
  backgroundIntervalSec: number;
  consecutiveErrors: number;
}): number {
  const baseIntervalMs = params.isHidden
    ? toIntervalMs(params.backgroundIntervalSec, 15)
    : toIntervalMs(params.activeIntervalSec, 3);

  if (params.consecutiveErrors <= 0) return baseIntervalMs;

  const multiplier = Math.pow(2, Math.max(0, params.consecutiveErrors - 1));
  return Math.min(MAX_POLL_DELAY_MS, baseIntervalMs * multiplier);
}
