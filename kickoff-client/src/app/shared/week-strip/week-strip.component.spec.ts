import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { WeekStripComponent, WeekStripItem } from './week-strip.component';

describe('WeekStripComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [WeekStripComponent] }).compileComponents();
  });

  it('does not recenter the active week when refreshed items keep the same selection', fakeAsync(() => {
    const fixture = TestBed.createComponent(WeekStripComponent);
    const scrollIntoView = spyOn(HTMLElement.prototype, 'scrollIntoView');
    const items: WeekStripItem[] = [
      { key: 1, label: 'Week 1', range: 'SEP 3 - 7', active: true },
      { key: 2, label: 'Week 2', range: 'SEP 10 - 12', active: false },
    ];

    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    flushMicrotasks();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('items', items.map((item) => ({ ...item })));
    fixture.detectChanges();
    flushMicrotasks();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput(
      'items',
      items.map((item) => ({ ...item, active: item.key === 2 })),
    );
    fixture.detectChanges();
    flushMicrotasks();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  }));
});
