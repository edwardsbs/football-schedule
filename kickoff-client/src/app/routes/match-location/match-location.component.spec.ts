import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatchLocationComponent } from './match-location.component';

describe('MatchLocationComponent', () => {
  let fixture: ComponentFixture<MatchLocationComponent>;
  let component: MatchLocationComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchLocationComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MatchLocationComponent);
    fixture.componentRef.setInput('league', 'nfl');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts a standard NFL round with the full state map', () => {
    expect(component.round().length).toBe(16);
    expect(component.states.length).toBe(50);
    expect(fixture.nativeElement.querySelectorAll('.state-target').length).toBe(50);
  });

  it('places a selected team in its correct state', () => {
    const tile = component.round()[0];
    const target = component.states.find((state) => state.code === tile.targetKey)!;

    component.onTileClick(tile);
    component.onStateTap(target);

    expect(component.placedCount()).toBe(1);
    expect(component.placed().get(target.code)?.[0]).toBe(tile);
    expect(component.mistakes()).toBe(0);
  });

  it('counts an incorrect state without removing the team', () => {
    const tile = component.round()[0];
    const wrong = component.states.find((state) => state.code !== tile.targetKey)!;

    component.onTileClick(tile);
    component.onStateTap(wrong);

    expect(component.mistakes()).toBe(1);
    expect(component.round()).toContain(tile);
  });

  it('resolves the revealed hint to a state name and map target', () => {
    const tile = component.round()[0];
    component.hintTileKey.set(tile.key);

    expect(component.hintStateCode()).toBe(tile.targetKey);
    expect(component.stateName(tile.targetKey)).not.toBe(tile.targetKey);
  });
});
