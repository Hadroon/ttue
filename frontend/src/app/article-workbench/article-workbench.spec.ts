import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArticleWorkbench } from './article-workbench';

describe('ArticleWorkbench', () => {
  let component: ArticleWorkbench;
  let fixture: ComponentFixture<ArticleWorkbench>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArticleWorkbench]
    }).compileComponents();

    fixture = TestBed.createComponent(ArticleWorkbench);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
