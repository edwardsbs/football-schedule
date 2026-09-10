import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StadiumRecognitionComponent } from './stadium-recognition.component';

describe('StadiumRecognitionComponent', () => {
  let fixture: ComponentFixture<StadiumRecognitionComponent>;
  let component: StadiumRecognitionComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StadiumRecognitionComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(StadiumRecognitionComponent);
    fixture.componentRef.setInput('league', 'nfl');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts a ten-question game with four team choices', () => {
    expect(component.question()).not.toBeNull();
    expect(component.question()?.choices.length).toBe(4);
    expect(component.questionNumber()).toBe(1);
  });

  it('scores the correct home team and advances to a different stadium', () => {
    const first = component.question()!;
    component.answer(first.stadium.team);
    expect(component.score()).toBe(1);
    expect(component.streak()).toBe(1);
    component.next();
    expect(component.questionNumber()).toBe(2);
    expect(component.question()?.stadium.name).not.toBe(first.stadium.name);
  });

  it('reveals the correct home team after a miss', () => {
    const current = component.question()!;
    const wrong = current.choices.find((team) => team.key !== current.stadium.team.key)!;
    component.answer(wrong);
    fixture.detectChanges();
    expect(component.score()).toBe(0);
    expect(fixture.nativeElement.querySelector('.stadium-choices .correct')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.stadium-choices .wrong')).not.toBeNull();
  });
});
