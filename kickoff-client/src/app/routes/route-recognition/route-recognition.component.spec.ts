import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouteRecognitionComponent } from './route-recognition.component';

describe('RouteRecognitionComponent', () => {
  let fixture: ComponentFixture<RouteRecognitionComponent>;
  let component: RouteRecognitionComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouteRecognitionComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(RouteRecognitionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts with a twelve-question mixed round and four choices', () => {
    expect(component.roundLength()).toBe(12);
    expect(component.round().slice(0, 5).every((route) => route.group === 'Core tree')).toBeTrue();
    expect(component.round().slice(5, 9).every((route) => route.group === 'Advanced routes')).toBeTrue();
    expect(component.round().slice(9).every((route) => route.group === 'Combination concepts')).toBeTrue();
    expect(component.question()?.choices.length).toBe(4);
    expect(fixture.nativeElement.querySelector('.recognition-field svg')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.route-answer-panel .quiz-choices')).not.toBeNull();
  });

  it('keeps the feedback and next action beside the route diagram', () => {
    component.answer(component.question()!.correct);
    fixture.detectChanges();
    const answerPanel = fixture.nativeElement.querySelector('.route-answer-panel');
    expect(answerPanel.querySelector('.quiz-feedback')).not.toBeNull();
    expect(answerPanel.querySelector('.quiz-feedback button').textContent).toContain('Next Route');
  });

  it('uses every classic route once in core mode', () => {
    component.newRound('core');
    expect(component.pool().length).toBe(9);
    expect(component.roundLength()).toBe(9);
    expect(new Set(component.round().map((route) => route.number)).size).toBe(9);
  });

  it('scores a correct route and advances', () => {
    const first = component.question()!;
    component.answer(first.correct);
    expect(component.score()).toBe(1);
    component.next();
    expect(component.questionNumber()).toBe(2);
    expect(component.question()?.correct.number).not.toBe(first.correct.number);
  });

  it('does not repeat a correct route during a mixed try', () => {
    const seen = new Set<number | string>();
    while (!component.isComplete()) {
      const current = component.question()!;
      expect(seen.has(current.correct.number)).toBeFalse();
      seen.add(current.correct.number);
      component.answer(current.correct);
      component.next();
    }
    expect(seen.size).toBe(12);
  });
});
