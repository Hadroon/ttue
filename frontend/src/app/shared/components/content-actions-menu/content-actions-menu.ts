import { Component, Input, inject, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { FlagModalComponent, FlagModalData } from '../flag-modal/flag-modal';

@Component({
  selector: 'app-content-actions-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './content-actions-menu.html',
  styleUrl: './content-actions-menu.css'
})
export class ContentActionsMenu {
  @Input() contentType!: 'idea' | 'comment' | 'challenge';
  @Input() contentId!: string | number;
  @Input() contentLabel: string = 'this content';

  isOpen = false;

  private dialog = inject(MatDialog);
  private authService = inject(AuthService);
  private elementRef = inject(ElementRef);

  get isLoggedIn() {
    return this.authService.isLoggedIn();
  }

  toggle(event: MouseEvent) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  openFlagModal(event: MouseEvent) {
    event.stopPropagation();
    this.isOpen = false;

    if (!this.isLoggedIn) {
      return;
    }

    this.dialog.open(FlagModalComponent, {
      width: '420px',
      panelClass: 'flag-modal-panel',
      data: {
        contentType: this.contentType,
        contentId: this.contentId,
        contentLabel: this.contentLabel,
      } as FlagModalData
    });
  }
}
