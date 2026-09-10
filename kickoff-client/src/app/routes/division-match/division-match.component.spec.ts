import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DivisionMatchComponent } from './division-match.component';

describe('DivisionMatchComponent', () => {
  let fixture: ComponentFixture<DivisionMatchComponent>;
  let component: DivisionMatchComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DivisionMatchComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DivisionMatchComponent);
    fixture.componentRef.setInput('league', 'nfl');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts a standard round of 12 NFL tiles on load', () => {
    expect(component.round().length).toBe(12);
    expect(component.totalTiles()).toBe(12);
    expect(component.placedCount()).toBe(0);
  });

  it('places a tile correctly via tap-select then tap-target', () => {
    const tile = component.round()[0];
    component.onTileClick(tile);
    expect(component.selectedTileKey()).toBe(tile.key);

    component.onTargetTap({ key: tile.targetKey, label: tile.targetKey });

    expect(component.placedCount()).toBe(1);
    expect(component.round().find((t) => t.key === tile.key)).toBeUndefined();
    expect(component.mistakes()).toBe(0);
  });

  it('counts a mistake and keeps the tile in the tray on a wrong target', () => {
    const tile = component.round()[0];
    const wrongTarget = component.targets().find((t) => t.key !== tile.targetKey)!;

    component.onTileClick(tile);
    component.onTargetTap(wrongTarget);

    expect(component.mistakes()).toBe(1);
    expect(component.round().find((t) => t.key === tile.key)).toBe(tile);
    expect(component.placedCount()).toBe(0);
  });

  it('deselects a tile when tapped a second time', () => {
    const tile = component.round()[0];
    component.onTileClick(tile);
    component.onTileClick(tile);
    expect(component.selectedTileKey()).toBeNull();
  });

  it('reports complete once every tile in the round is placed', () => {
    for (const tile of [...component.round()]) {
      component.onTileClick(tile);
      component.onTargetTap({ key: tile.targetKey, label: tile.targetKey });
    }
    expect(component.isComplete()).toBeTrue();
    expect(component.placedCount()).toBe(12);
  });

  it('resolves the hint target from the currently revealed tile', () => {
    const tile = component.round()[0];
    component.hintTileKey.set(tile.key);
    expect(component.hintTargetKey()).toBe(tile.targetKey);
  });

  it('has no hint target when nothing is revealed', () => {
    expect(component.hintTargetKey()).toBeNull();
  });

  it('resets mistakes and placements on a new round', () => {
    const tile = component.round()[0];
    const wrongTarget = component.targets().find((t) => t.key !== tile.targetKey)!;
    component.onTileClick(tile);
    component.onTargetTap(wrongTarget);
    expect(component.mistakes()).toBe(1);

    component.newRound('quick');

    expect(component.mistakes()).toBe(0);
    expect(component.placedCount()).toBe(0);
    expect(component.round().length).toBe(8);
  });
});

describe('DivisionMatchComponent NCAA round sizes', () => {
  let component: DivisionMatchComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DivisionMatchComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(DivisionMatchComponent);
    fixture.componentRef.setInput('league', 'ncaa');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('uses NCAA-scaled Quick/Standard sizes, much bigger than the NFL pool', () => {
    component.newRound('quick');
    expect(component.round().length).toBe(32);

    component.newRound('standard');
    expect(component.round().length).toBe(64);
  });

  it('caps a round size at the pool itself if the pool is smaller', () => {
    // Sanity check: even a mis-tuned constant can't ask for more tiles than exist.
    expect(component.quickSize()).toBeLessThanOrEqual(component.poolSize());
    expect(component.standardSize()).toBeLessThanOrEqual(component.poolSize());
  });
});
