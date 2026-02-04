import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddChallenge } from './add-challenge';

describe('AddChallenge', () => {
  let component: AddChallenge;
  let fixture: ComponentFixture<AddChallenge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddChallenge]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddChallenge);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
