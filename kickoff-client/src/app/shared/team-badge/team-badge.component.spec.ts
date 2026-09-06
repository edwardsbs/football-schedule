import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TeamBadgeComponent } from './team-badge.component';

describe('TeamBadgeComponent', () => {
  let fixture: ComponentFixture<TeamBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TeamBadgeComponent] }).compileComponents();
    fixture = TestBed.createComponent(TeamBadgeComponent);
    fixture.componentRef.setInput('name', 'Notre Dame');
    fixture.componentRef.setInput('abbreviation', 'ND');
    fixture.componentRef.setInput('logoUrl', '/notre-dame.png');
  });

  it('renders a current rank immediately before the logo', () => {
    fixture.componentRef.setInput('rank', 4);
    fixture.detectChanges();

    const children = Array.from<HTMLElement>(fixture.nativeElement.children);
    expect(children[0].classList).toContain('rank');
    expect(children[0].textContent?.trim()).toBe('4');
    expect(children[1].tagName).toBe('IMG');
  });

  it('does not reserve rank space for an unranked team', () => {
    fixture.componentRef.setInput('rank', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.rank')).toBeNull();
    expect(fixture.nativeElement.firstElementChild.tagName).toBe('IMG');
  });

  it('glows for either a favorite or a ranked team', () => {
    fixture.componentRef.setInput('glow', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.classList).toContain('favorite-glow');
    expect(fixture.nativeElement.classList).not.toContain('ranked-glow');

    fixture.componentRef.setInput('glow', false);
    fixture.componentRef.setInput('rank', 4);
    fixture.detectChanges();
    expect(fixture.nativeElement.classList).toContain('ranked-glow');
    expect(fixture.nativeElement.classList).not.toContain('favorite-glow');
  });
});
