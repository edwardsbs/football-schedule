import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KickoffDriveComponent } from './kickoff-drive.component';

describe('KickoffDriveComponent', () => {
  let fixture: ComponentFixture<KickoffDriveComponent>;
  let component: KickoffDriveComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KickoffDriveComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(KickoffDriveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('starts ready with four plays and touch controls', () => {
    expect(component.phase()).toBe('ready');
    expect(component.plays.length).toBe(4);
    expect(fixture.nativeElement.querySelectorAll('.drive-play').length).toBe(4);
    expect(fixture.nativeElement.querySelector('.drive-stick')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.drive-field')).not.toBeNull();
  });

  it('lets the player select a play and snap the ball', () => {
    component.selectPlay('zone');
    expect(component.selectedPlayId()).toBe('zone');
    component.snap();
    expect(component.phase()).toBe('snap');
    expect(component.ball().visible).toBeTrue();
  });

  it('resets the scoreboard and series for a new game', () => {
    component.score.set(14);
    component.gameClock.set(3);
    component.ballOn.set(72);
    component.newGame();
    expect(component.score()).toBe(0);
    expect(component.gameClock()).toBe(60);
    expect(component.ballOn()).toBe(32);
    expect(component.phase()).toBe('ready');
  });
});

