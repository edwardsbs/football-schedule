import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LogoBlitzComponent } from './logo-blitz.component';

describe('LogoBlitzComponent', () => {
  let fixture: ComponentFixture<LogoBlitzComponent>;
  let component: LogoBlitzComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogoBlitzComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(LogoBlitzComponent);
    fixture.componentRef.setInput('league', 'nfl');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('starts with one logo and four unique answer choices', () => {
    const question = component.question()!;
    expect(question.choices.length).toBe(4);
    expect(new Set(question.choices.map((team) => team.key)).size).toBe(4);
  });

  it('scores a correct logo and auto-advances', fakeAsync(() => {
    const first = component.question()!;
    component.answer(first.correct);
    expect(component.score()).toBe(1);
    tick(750);
    expect(component.questionNumber()).toBe(2);
    expect(component.question()?.correct.key).not.toBe(first.correct.key);
  }));
});
