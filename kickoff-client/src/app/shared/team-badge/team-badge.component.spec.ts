import { ComponentFixture, TestBed } from '@angular/core/testing';
import { needsLightLogoOutline, officialNflLogoUrl, TeamBadgeComponent } from './team-badge.component';

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

  it('upgrades an ESPN NFL logo to the official vector asset', () => {
    fixture.componentRef.setInput('name', 'Las Vegas Raiders');
    fixture.componentRef.setInput('abbreviation', 'LV');
    fixture.componentRef.setInput('logoUrl', 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png');
    fixture.detectChanges();

    const logo = fixture.nativeElement.querySelector('.logo') as HTMLImageElement;
    expect(logo.src).toBe('https://static.www.nfl.com/league/api/clubs/logos/LV.svg');
    expect(logo.classList).toContain('official-nfl-logo');
  });

  it('falls back to the ESPN raster before using a monogram', () => {
    const espnUrl = 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png';
    fixture.componentRef.setInput('name', 'Las Vegas Raiders');
    fixture.componentRef.setInput('abbreviation', 'LV');
    fixture.componentRef.setInput('logoUrl', espnUrl);
    fixture.detectChanges();

    let logo = fixture.nativeElement.querySelector('.logo') as HTMLImageElement;
    logo.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    logo = fixture.nativeElement.querySelector('.logo') as HTMLImageElement;
    expect(logo.src).toBe(espnUrl);
    expect(logo.classList).not.toContain('official-nfl-logo');

    logo.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.logo')).toBeNull();
    expect(fixture.nativeElement.querySelector('.monogram')).not.toBeNull();
  });

});

describe('officialNflLogoUrl', () => {
  it('maps Washington and leaves NCAA logos alone', () => {
    expect(officialNflLogoUrl('https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png'))
      .toBe('https://static.www.nfl.com/league/api/clubs/logos/WAS.svg');
    expect(officialNflLogoUrl('https://a.espncdn.com/i/teamlogos/ncaa/500/333.png')).toBeNull();
  });
});

function solidPixels(value: number, alpha = 255): Uint8ClampedArray {
  return new Uint8ClampedArray(Array.from({ length: 10 }, () => [value, value, value, alpha]).flat());
}
