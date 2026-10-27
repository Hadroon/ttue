import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AuthGuardService } from '../../shared/services/auth-guard.service';
import { ActionsStore, MediaAsset, ShareResolution } from './actions.store';

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-info-campaigns',
  imports: [DecimalPipe],
  styleUrl: './actions-shared.css',
  template: `
    <section class="feature" aria-labelledby="ic-media">
      <header>
        <h4 id="ic-media">Media and meme factory</h4>
        <p class="muted">A shared library of open campaign material: infographics, logos, short videos and press kits. Add a link to where the file is hosted and state its license.</p>
      </header>
      @if (media().length === 0) {
        <div class="empty">No material yet. Share the first asset below.</div>
      } @else {
        <ul class="list">
          @for (m of media(); track m.id) {
            <li class="item">
              <div class="item-head"><span class="item-title">{{ m.title }}</span><span class="tag">{{ m.type }}</span></div>
              <span class="muted">License: {{ m.license }}</span>
              <div class="btn-row">
                <a class="abtn sm primary" [href]="m.url" target="_blank" rel="noopener noreferrer">Open / download</a>
                @if (canRemove(m.ownerId)) { <button class="abtn sm quiet" type="button" (click)="removeMedia(m)">Remove</button> }
              </div>
            </li>
          }
        </ul>
      }
      <form class="form-grid" (submit)="addMedia($event)">
        <label class="field">Title <input name="title" required></label>
        <label class="field">Type
          <select name="type"><option>Infographic</option><option>Logo</option><option>Video</option><option>Press kit</option></select>
        </label>
        <label class="field">Link <input name="url" type="url" required placeholder="https://…"></label>
        <label class="field">License <input name="license" required value="CC BY 4.0"></label>
        <div class="btn-row wide"><button class="abtn primary" type="submit">Share asset</button></div>
      </form>
    </section>

    <section class="feature" aria-labelledby="ic-shares">
      <header>
        <h4 id="ic-shares">Shareholder meeting coordination</h4>
        <p class="muted">Pool shares, even fractional ones, to reach the threshold a company requires for an agenda item. Share ownership can't be verified yet, so counts are self-reported. Check the company's own rules and the law in its jurisdiction before filing anything.</p>
      </header>
      @if (resolutions().length === 0) {
        <div class="empty">No resolutions yet.</div>
      } @else {
        <ul class="list">
          @for (r of resolutions(); track r.id) {
            <li class="item">
              <div class="item-head"><span class="item-title">{{ r.ticker }}</span>
                <span class="tag" [class.good]="pooled(r) >= r.threshold">{{ pooled(r) >= r.threshold ? 'Threshold reached' : 'Collecting' }}</span></div>
              <span>{{ r.text }}</span>
              <div class="progress" role="progressbar" [attr.aria-valuenow]="pct(r)" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="pct(r)"></span></div>
              <span class="muted">{{ pooled(r) | number }} of {{ r.threshold | number }} shares pledged (self-reported)</span>
              <div class="btn-row">
                <label class="check"><input type="checkbox" [checked]="r.cosponsor" (change)="toggleCosponsor(r)"> I co-sponsor with my shares</label>
                @if (canRemove(r.ownerId)) { <button class="abtn sm quiet" type="button" (click)="removeResolution(r)">Remove</button> }
              </div>
            </li>
          }
        </ul>
      }
      <form class="form-grid" (submit)="addResolution($event)">
        <label class="field">Company ticker <input name="ticker" required placeholder="e.g. ACME" maxlength="12"></label>
        <label class="field">Shares needed to file <input name="threshold" type="number" min="1" step="1" required></label>
        <label class="field">Shares I hold <input name="mine" type="number" min="0" step="1" value="0"></label>
        <label class="field wide">Resolution text <textarea name="text" rows="3" required></textarea></label>
        <label class="field wide">Proof of ownership <input name="proof" type="file" disabled></label>
        <label class="check wide"><input type="checkbox" name="cosponsor" checked> Count the shares I hold towards this resolution</label>
        <div class="btn-row wide"><button class="abtn primary" type="submit">Start resolution</button></div>
      </form>
    </section>

    <section class="feature" aria-labelledby="ic-whistle">
      <header>
        <h4 id="ic-whistle">Whistleblower vault</h4>
        <p class="muted">Not available yet.</p>
      </header>
      <div class="notice danger" role="alert">
        <strong>Do not submit anything sensitive through this site.</strong>
        A safe drop needs encryption, metadata removal and anonymous communication that run on a hardened server, and none of that exists here yet. Leaking through an insecure channel can expose you.
        If you hold information in the public interest, use an established anonymous channel such as SecureDrop, or seek advice from a lawyer or a whistleblower-protection organisation first.
      </div>
      <form class="form-grid" (submit)="$event.preventDefault()" aria-disabled="true">
        <fieldset disabled style="border:none;padding:0;margin:0;display:contents">
          <label class="field wide">Document <input type="file"></label>
          <label class="field wide">Contact phrase (optional) <input></label>
          <div class="btn-row wide"><button class="abtn" type="submit">Submit (disabled)</button></div>
        </fieldset>
      </form>
    </section>
  `
})
export class InfoCampaigns {
  private readonly store = inject(ActionsStore);
  private readonly guard = inject(AuthGuardService);

  readonly media = computed(() => this.store.data().media);
  readonly resolutions = computed(() => this.store.data().resolutions);

  pooled(r: ShareResolution): number { return r.pooled; }
  pct(r: ShareResolution): number {
    return r.threshold > 0 ? Math.min(100, Math.round((this.pooled(r) / r.threshold) * 100)) : 0;
  }

  canRemove(ownerId: number | null): boolean {
    return this.store.canRemove(ownerId);
  }

  async addMedia(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const url = safeUrl(String(data.get('url')));
    if (!url) return;
    if (!this.guard.requireAuth('share an asset')) return;
    const created = await this.store.create('media', {
      title: String(data.get('title')).trim(),
      type: String(data.get('type')),
      url,
      license: String(data.get('license')).trim()
    });
    if (created) form.reset();
  }

  async removeMedia(m: MediaAsset): Promise<void> {
    await this.store.remove(m.id);
  }

  async addResolution(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    if (!this.guard.requireAuth('start a shareholder resolution')) return;
    const created = await this.store.create('resolution', {
      ticker: String(data.get('ticker')).trim().toUpperCase(),
      text: String(data.get('text')).trim(),
      threshold: Math.max(1, Math.round(Number(data.get('threshold')) || 1))
    });
    if (!created) return;
    const shares = Math.max(0, Math.round(Number(data.get('mine')) || 0));
    if (shares > 0) {
      await this.store.create('resolution_cosponsor', { shares, cosponsor: data.get('cosponsor') !== null }, created.id);
    }
    form.reset();
  }

  async toggleCosponsor(r: ShareResolution): Promise<void> {
    if (!this.guard.requireAuth('co-sponsor a resolution')) return;
    await this.store.create('resolution_cosponsor', { shares: r.mine, cosponsor: !r.cosponsor }, r.id);
  }

  async removeResolution(r: ShareResolution): Promise<void> {
    await this.store.remove(r.id);
  }
}
