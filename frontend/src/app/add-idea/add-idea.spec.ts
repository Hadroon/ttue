import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddIdea } from './add-idea';

describe('AddIdea', () => {
  let component: AddIdea;
  let fixture: ComponentFixture<AddIdea>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddIdea]
    }).compileComponents();

    fixture = TestBed.createComponent(AddIdea);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
