import { ComponentFixture, TestBed } from '@angular/core/testing';
import { needsLightLogoOutline, TeamBadgeComponent } from './team-badge.component';

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

  it('reserves a blank rank column for an unranked team so logos align', () => {
    fixture.componentRef.setInput('rank', null);
    fixture.componentRef.setInput('reserveRankSpace', true);
    fixture.detectChanges();

    const rank = fixture.nativeElement.querySelector('.rank') as HTMLElement;
    expect(rank.classList).toContain('empty');
    expect(rank.textContent?.trim()).toBe('');
    expect(fixture.nativeElement.children[1].tagName).toBe('IMG');
  });

  it('does not reserve blank rank space in compact contexts unless requested', () => {
    fixture.componentRef.setInput('rank', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.rank')).toBeNull();
    expect(fixture.nativeElement.firstElementChild.tagName).toBe('IMG');
  });

  it('detects dark visible logo pixels without treating transparency as black', () => {
    expect(needsLightLogoOutline(solidPixels(20))).toBeTrue();
    expect(needsLightLogoOutline(solidPixels(230))).toBeFalse();
    expect(needsLightLogoOutline(solidPixels(0, 0))).toBeFalse();
  });

});

function solidPixels(value: number, alpha = 255): Uint8ClampedArray {
  return new Uint8ClampedArray(Array.from({ length: 10 }, () => [value, value, value, alpha]).flat());
}
