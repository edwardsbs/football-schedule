export type DayPanelSize = 'small' | 'medium' | 'live';
export type DayPanelSizePreference = 'auto' | DayPanelSize;

/** Smart Day-view density based on the number of currently visible games. */
export function automaticDayPanelSize(gameCount: number): DayPanelSize {
  if (gameCount <= 5) return 'live';
  if (gameCount <= 10) return 'medium';
  return 'small';
}

export function isDayPanelSizePreference(value: string | null): value is DayPanelSizePreference {
  return value === 'auto' || value === 'small' || value === 'medium' || value === 'live';
}
