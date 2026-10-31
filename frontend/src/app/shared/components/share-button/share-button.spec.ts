import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ShareButton } from './share-button';

describe('ShareButton', () => {
  let fixture: ComponentFixture<ShareButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShareButton],
      providers: [provideZonelessChangeDetection(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ShareButton);
    fixture.componentRef.setInput('title', 'Clean water & air');
    fixture.componentRef.setInput('path', '/article-workbench');
    fixture.componentRef.setInput('queryParams', { challengeId: 7, section: 'ideas', empty: null });
    fixture.componentRef.setInput('fragment', 'idea-3');
    fixture.detectChanges();
  });

  const trigger = () => fixture.nativeElement.querySelector('.share-trigger') as HTMLButtonElement;

  it('stays closed until the button is clicked', () => {
    expect(fixture.nativeElement.querySelector('.share-dropdown')).toBeNull();
    trigger().click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.share-dropdown')).not.toBeNull();
  });

  it('builds an absolute deep link without empty params', () => {
    trigger().click();
    fixture.detectChanges();
    expect(fixture.componentInstance.shareUrl()).toBe(
      `${window.location.origin}/article-workbench?challengeId=7&section=ideas#idea-3`
    );
  });

  it('encodes the link and title in the network URLs', () => {
    trigger().click();
    fixture.detectChanges();
    const x = fixture.componentInstance.targets().find(t => t.id === 'x')!;
    expect(x.href).toContain(encodeURIComponent(fixture.componentInstance.shareUrl()));
    expect(x.href).toContain(encodeURIComponent('Clean water & air'));
  });

  it('copies the link to the clipboard', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText } as unknown as Clipboard);
    trigger().click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.share-item') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(writeText).toHaveBeenCalledWith(fixture.componentInstance.shareUrl());
    expect(fixture.componentInstance.copied()).toBeTrue();
  });

  it('puts a plain-text summary in the Reddit post body', () => {
    fixture.componentRef.setInput('text', '<p>Rivers are <strong>polluted</strong>.</p><p>We need a plan.</p>');
    trigger().click();
    fixture.detectChanges();
    const reddit = fixture.componentInstance.targets().find(t => t.id === 'reddit')!;
    const params = new URL(reddit.href).searchParams;
    expect(params.get('type')).toBe('TEXT');
    expect(params.get('title')).toBe('Clean water & air');
    expect(params.get('text')).toBe(`Rivers are polluted.We need a plan.\n\n${fixture.componentInstance.shareUrl()}`);
  });

  it('truncates long summaries', () => {
    fixture.componentRef.setInput('text', 'word '.repeat(200));
    expect(fixture.componentInstance.plainText().length).toBeLessThanOrEqual(300);
    expect(fixture.componentInstance.plainText().endsWith('…')).toBeTrue();
  });

  it('shares the current page with content read from the rendered page', () => {
    fixture.componentRef.setInput('currentPage', true);
    fixture.componentRef.setInput('resolveContent', () => ({ title: 'Page headline', text: 'Page intro' }));
    spyOnProperty(TestBed.inject(Router), 'url', 'get').and.returnValue('/challenges?tag=water');
    trigger().click();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.shareUrl()).toBe(`${window.location.origin}/challenges?tag=water`);
    const reddit = new URL(component.targets().find(t => t.id === 'reddit')!.href).searchParams;
    expect(reddit.get('title')).toBe('Page headline');
    expect(reddit.get('text')).toContain('Page intro');
  });

  it('closes when clicking outside', () => {
    trigger().click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.share-dropdown')).toBeNull();
  });
});
