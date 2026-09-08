import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeagueSectionToggleComponent } from './league-section-toggle.component';

describe('LeagueSectionToggleComponent', () => {
  let fixture: ComponentFixture<LeagueSectionToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeagueSectionToggleComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LeagueSectionToggleComponent);
    fixture.componentRef.setInput('league', 'ncaa');
    fixture.componentRef.setInput('activeSection', 'conference');
    fixture.detectChanges();
  });

  it('links both views within the selected league', () => {
    const links = [...fixture.nativeElement.querySelectorAll('a')] as HTMLAnchorElement[];
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Schedule', 'Conferences']);
    expect(links[0].getAttribute('href')).toBe('/season/ncaa');
    expect(links[1].getAttribute('href')).toBe('/conferences/ncaa');
    expect(links[1].classList).toContain('active');
    expect(links[1].getAttribute('aria-current')).toBe('page');
  });
});
