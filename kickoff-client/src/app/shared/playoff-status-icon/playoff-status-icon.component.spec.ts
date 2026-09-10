import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayoffStatusIconComponent } from './playoff-status-icon.component';

describe('PlayoffStatusIconComponent', () => {
  let fixture: ComponentFixture<PlayoffStatusIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PlayoffStatusIconComponent] }).compileComponents();
    fixture = TestBed.createComponent(PlayoffStatusIconComponent);
  });

  it('renders a distinct svg class and label per status', () => {
    for (const status of ['hunt', 'clinched-berth', 'clinched-division', 'clinched-bye', 'eliminated'] as const) {
      fixture.componentRef.setInput('status', status);
      fixture.detectChanges();
      const svg: SVGElement = fixture.nativeElement.querySelector('svg');
      expect(svg.classList).toContain(status);
      expect(svg.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('draws a strike line only for the eliminated state', () => {
    fixture.componentRef.setInput('status', 'eliminated');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.strike')).not.toBeNull();

    fixture.componentRef.setInput('status', 'hunt');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.strike')).toBeNull();
  });

  it('draws a badge dot only for clinched-division and clinched-bye', () => {
    for (const status of ['clinched-division', 'clinched-bye'] as const) {
      fixture.componentRef.setInput('status', status);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.badge-dot')).not.toBeNull();
    }
    for (const status of ['hunt', 'clinched-berth', 'eliminated'] as const) {
      fixture.componentRef.setInput('status', status);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.badge-dot')).toBeNull();
    }
  });
});
