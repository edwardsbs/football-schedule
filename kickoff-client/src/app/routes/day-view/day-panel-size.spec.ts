import { automaticDayPanelSize, isDayPanelSizePreference } from './day-panel-size';

describe('Day panel sizing', () => {
  it('uses Live-sized panels for one through five games', () => {
    expect(automaticDayPanelSize(1)).toBe('live');
    expect(automaticDayPanelSize(5)).toBe('live');
  });

  it('uses medium double-width panels for six through ten games', () => {
    expect(automaticDayPanelSize(6)).toBe('medium');
    expect(automaticDayPanelSize(10)).toBe('medium');
  });

  it('uses the smallest panels for full slates of eleven or more games', () => {
    expect(automaticDayPanelSize(11)).toBe('small');
    expect(automaticDayPanelSize(68)).toBe('small');
  });

  it('accepts only supported saved manual preferences', () => {
    expect(isDayPanelSizePreference('auto')).toBeTrue();
    expect(isDayPanelSizePreference('live')).toBeTrue();
    expect(isDayPanelSizePreference('huge')).toBeFalse();
  });
});
