import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WhosMissingComponent } from './whos-missing.component';

describe('WhosMissingComponent', () => {
  let fixture: ComponentFixture<WhosMissingComponent>;
  let component: WhosMissingComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhosMissingComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(WhosMissingComponent);
    fixture.componentRef.setInput('league', 'nfl');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts a ten-question NFL roster round', () => {
    expect(component.question()).not.toBeNull();
    expect(component.question()?.visibleTeams.length).toBe(3);
    expect(component.question()?.choices.length).toBe(4);
    expect(component.questionNumber()).toBe(1);
  });

  it('scores the missing team and advances to a new group', () => {
    const first = component.question()!;
    component.answer(first.missing);
    expect(component.score()).toBe(1);
    expect(component.streak()).toBe(1);
    component.next();
    expect(component.questionNumber()).toBe(2);
    expect(component.question()?.group.key).not.toBe(first.group.key);
  });

  it('reveals the correct team after a miss without awarding a point', () => {
    const question = component.question()!;
    const wrong = question.choices.find((team) => team.key !== question.missing.key)!;
    component.answer(wrong);
    fixture.detectChanges();
    expect(component.score()).toBe(0);
    expect(fixture.nativeElement.querySelector('.quiz-choices .correct')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.quiz-choices .wrong')).not.toBeNull();
  });
});
