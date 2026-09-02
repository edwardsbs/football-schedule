import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { getAlignment } from '../../core/data/alignment-lookup';
import { AlignmentConference } from '../../core/models/alignment.model';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';

/**
 * Conference & division breakdown for a league. `league` is bound from the
 * `:league` route param via router component-input binding.
 */
@Component({
  selector: 'app-conference-alignment',
  imports: [RouterLink, TeamBadgeComponent],
  templateUrl: './conference-alignment.component.html',
  styleUrl: './conference-alignment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConferenceAlignmentComponent {
  readonly league = input.required<string>();
  readonly palette = signal<'original' | 'muted' | 'mono'>('mono');

  readonly alignment = computed(() => getAlignment(this.league()));

  /** The NFL presentation is intentionally NFC-first to match the familiar two-conference layout. */
  readonly nflConferences = computed<AlignmentConference[]>(() => {
    const alignment = this.alignment();
    if (alignment?.league !== 'nfl') return [];

    const conferences = alignment.tiers.flatMap((tier) => tier.conferences);
    return ['NFC', 'AFC'].flatMap((shortName) =>
      conferences.filter((conference) => conference.shortName === shortName),
    );
  });

  readonly teamCount = computed(() => {
    const a = this.alignment();
    if (!a) return 0;
    const inConferences = a.tiers
      .flatMap((tier) => tier.conferences)
      .flatMap((conf) => conf.divisions)
      .reduce((sum, div) => sum + div.teams.length, 0);
    return inConferences + a.independents.length;
  });

  setPalette(palette: 'original' | 'muted' | 'mono'): void {
    this.palette.set(palette);
  }
}
