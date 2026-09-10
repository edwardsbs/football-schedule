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

  it('starts with the classic nine-route pool and four choices', () => {
    expect(component.pool().length).toBe(9);
    expect(component.question()?.choices.length).toBe(4);
    expect(fixture.nativeElement.querySelector('.recognition-field svg')).not.toBeNull();
  });

  it('includes advanced routes and concepts in full playbook mode', () => {
    component.newRound('full');
    expect(component.pool().length).toBeGreaterThan(20);
  });

  it('scores a correct route and advances', () => {
    const first = component.question()!;
    component.answer(first.correct);
    expect(component.score()).toBe(1);
    component.next();
    expect(component.questionNumber()).toBe(2);
    expect(component.question()?.correct.number).not.toBe(first.correct.number);
  });
});
