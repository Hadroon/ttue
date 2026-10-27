import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthGuardService } from '../../shared/services/auth-guard.service';
import { ActionsStore, Protest } from './actions.store';

/** A protest with no end time is treated as lasting this long when deciding whether it is over */
const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;

const COORDINATES = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/;

@Component({
  selector: 'app-protests',
  imports: [DatePipe],
  styleUrl: './actions-shared.css',
  styles: [`
    .when { font-weight: 600; color: var(--text); }
    .map { width: 100%; height: 260px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); }
    .error { color: #ef4444; font-size: 13px; }
  `],
  template: `
    <section class="feature" aria-labelledby="pr-announce">
      <header>
        <h4 id="pr-announce">Announce a protest or public gathering</h4>
        <p class="muted">Share where and when people are meeting, and link to the organisers so others can join them. Only post public events, and never a private home address.</p>
      </header>
      <form class="form-grid" (submit)="addProtest($event)">
        <label class="field wide">Title <input name="title" required maxlength="200" placeholder="e.g. March for clean rivers"></label>
        <label class="field">Starts <input name="startsAt" type="datetime-local" required></label>
        <label class="field">Ends (optional) <input name="endsAt" type="datetime-local"></label>
        <label class="field">Meeting point <input name="place" required maxlength="200" placeholder="e.g. Town Hall Square"></label>
        <label class="field">City <input name="city" required maxlength="100"></label>
        <label class="field">Country (optional) <input name="country" maxlength="100"></label>
        <label class="field">Map coordinates (optional) <input name="coordinates" placeholder="52.5200, 13.4050" inputmode="decimal"></label>
        <label class="field">Organiser <input name="organizerName" required maxlength="200" placeholder="Group or person organising"></label>
        <label class="field">Organiser link (optional) <input name="organizerUrl" type="url" placeholder="https://…"></label>
        <label class="field wide">Details (optional) <textarea name="description" rows="3" maxlength="2000" placeholder="What is it about, what to bring, accessibility, how to stay safe"></textarea></label>
        <p class="muted wide">Coordinates let others open the exact spot on a map: right-click the place on OpenStreetMap or Google Maps and copy the two numbers. Without them, people get a map search for the address.</p>
        @if (formError()) { <p class="error wide" role="alert">{{ formError() }}</p> }
        <div class="btn-row wide"><button class="abtn primary" type="submit">Publish event</button></div>
      </form>
    </section>

    <section class="feature" aria-labelledby="pr-upcoming">
      <header>
        <h4 id="pr-upcoming">Upcoming events</h4>
        <p class="muted">Times are shown in your device's time zone. We don't verify events or organisers; check with the organisers and the rules for public assemblies where you live before you go.</p>
      </header>
      @if (upcoming().length === 0) {
        <div class="empty">No upcoming events yet. Announce the first one above.</div>
      } @else {
        <ul class="list">
          @for (p of upcoming(); track p.id) {
            <li class="item">
              <div class="item-head">
                <span class="item-title">{{ p.title }}</span>
                <span class="tag">{{ p.city }}</span>
              </div>
              <span class="when">{{ p.startsAt | date:'EEEE, d MMMM y, HH:mm' }}@if (p.endsAt) { – {{ p.endsAt | date:(sameDay(p) ? 'HH:mm' : 'EEEE, d MMMM, HH:mm') }} }</span>
              <span>📍 {{ p.place }}, {{ p.city }}{{ p.country ? ', ' + p.country : '' }}</span>
              @if (p.description) { <span class="muted">{{ p.description }}</span> }
              <span class="muted">
                Organised by
                @if (p.organizerUrl) {
                  <a [href]="p.organizerUrl" target="_blank" rel="noopener noreferrer nofollow">{{ p.organizerName }}</a>
                } @else {
                  {{ p.organizerName }}
                }
                @if (p.postedBy) { · posted by {{ p.postedBy }} }
              </span>
              <div class="btn-row">
                @if (p.lat !== null && p.lng !== null) {
                  <button class="abtn sm" type="button" [attr.aria-expanded]="isOpen(p)" (click)="toggleMap(p)">{{ isOpen(p) ? 'Hide map' : 'Show map' }}</button>
                }
                <a class="abtn sm" [href]="mapLink(p)" target="_blank" rel="noopener noreferrer">{{ p.lat !== null ? 'Open in OpenStreetMap' : 'Find on a map' }}</a>
                @if (canRemove(p.ownerId)) { <button class="abtn sm quiet" type="button" (click)="remove(p)">Remove</button> }
              </div>
              @if (isOpen(p)) {
                <iframe class="map" [src]="embedUrl(p)" [attr.title]="'Map of ' + p.place + ', ' + p.city" loading="lazy" referrerpolicy="no-referrer"></iframe>
              }
            </li>
          }
        </ul>
      }
    </section>

    @if (past().length > 0) {
      <section class="feature" aria-labelledby="pr-past">
        <details>
          <summary id="pr-past">Past events ({{ past().length }})</summary>
          <ul class="list" style="margin-top:10px">
            @for (p of past(); track p.id) {
              <li class="item">
                <div class="item-head">
                  <span class="item-title">{{ p.title }}</span>
                  <span class="tag">{{ p.city }}</span>
                </div>
                <span class="muted">{{ p.startsAt | date:'d MMMM y' }} · {{ p.place }} · {{ p.organizerName }}</span>
                @if (canRemove(p.ownerId)) {
                  <div class="btn-row"><button class="abtn sm quiet" type="button" (click)="remove(p)">Remove</button></div>
                }
              </li>
            }
          </ul>
        </details>
      </section>
    }
  `
})
export class Protests {
  private readonly store = inject(ActionsStore);
  private readonly guard = inject(AuthGuardService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly formError = signal<string | null>(null);
  private readonly openMaps = signal<ReadonlySet<number>>(new Set());

  private readonly sorted = computed(() =>
    [...this.store.data().protests].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  readonly upcoming = computed(() => this.sorted().filter(p => !this.isOver(p)));
  readonly past = computed(() => this.sorted().filter(p => this.isOver(p)).reverse());

  private isOver(p: Protest): boolean {
    const end = p.endsAt ? Date.parse(p.endsAt) : Date.parse(p.startsAt) + DEFAULT_DURATION_MS;
    return end < Date.now();
  }

  sameDay(p: Protest): boolean {
    return !!p.endsAt && new Date(p.startsAt).toDateString() === new Date(p.endsAt).toDateString();
  }

  canRemove(ownerId: number | null): boolean {
    return this.store.canRemove(ownerId);
  }

  isOpen(p: Protest): boolean {
    return this.openMaps().has(p.id);
  }

  toggleMap(p: Protest): void {
    const next = new Set(this.openMaps());
    if (!next.delete(p.id)) next.add(p.id);
    this.openMaps.set(next);
  }

  /** Built only from numbers the server has validated, so the embed address is safe to trust */
  embedUrl(p: Protest): SafeResourceUrl {
    const lat = p.lat ?? 0, lng = p.lng ?? 0;
    const bbox = [lng - 0.01, lat - 0.006, lng + 0.01, lat + 0.006].join(',');
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`);
  }

  mapLink(p: Protest): string {
    if (p.lat !== null && p.lng !== null) {
      return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`;
    }
    const query = [p.place, p.city, p.country].filter(Boolean).join(', ');
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
  }

  async addProtest(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    if (!this.guard.requireAuth('announce a protest')) return;

    const text = (name: string) => String(data.get(name) ?? '').trim();
    const startsAt = new Date(text('startsAt'));
    const endsAtRaw = text('endsAt');
    const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;
    if (Number.isNaN(startsAt.getTime())) { this.formError.set('Enter when the event starts.'); return; }
    if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt < startsAt)) { this.formError.set('The end time must be after the start time.'); return; }

    let lat: number | null = null, lng: number | null = null;
    const coordinates = text('coordinates');
    if (coordinates) {
      const match = COORDINATES.exec(coordinates);
      lat = match ? Number(match[1]) : null;
      lng = match ? Number(match[2]) : null;
      if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        this.formError.set('Coordinates should look like "52.5200, 13.4050" (latitude, longitude).');
        return;
      }
    }

    this.formError.set(null);
    const created = await this.store.create('protest', {
      title: text('title'),
      description: text('description'),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt ? endsAt.toISOString() : null,
      place: text('place'),
      city: text('city'),
      country: text('country'),
      lat, lng,
      organizerName: text('organizerName'),
      organizerUrl: text('organizerUrl')
    });
    if (created) form.reset();
  }

  async remove(p: Protest): Promise<void> {
    await this.store.remove(p.id);
  }
}
