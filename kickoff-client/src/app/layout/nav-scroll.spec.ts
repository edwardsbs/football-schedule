import { horizontalScrollAvailability } from './nav-scroll';

describe('horizontalScrollAvailability', () => {
  it('shows only the right control at the beginning', () => {
    expect(horizontalScrollAvailability(0, 500, 800)).toEqual({ left: false, right: true });
  });

  it('shows both controls in the middle', () => {
    expect(horizontalScrollAvailability(150, 500, 800)).toEqual({ left: true, right: true });
  });

  it('shows only the left control at the end and neither when everything fits', () => {
    expect(horizontalScrollAvailability(300, 500, 800)).toEqual({ left: true, right: false });
    expect(horizontalScrollAvailability(0, 800, 800)).toEqual({ left: false, right: false });
  });
});
