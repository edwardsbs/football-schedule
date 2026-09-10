import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'live' },
      {
        path: 'live',
        title: 'Live · Kickoff',
        loadComponent: () =>
          import('./routes/live-dashboard/live-dashboard.component').then((m) => m.LiveDashboardComponent),
      },
      {
        path: 'week',
        title: 'Week · Kickoff',
        loadComponent: () => import('./routes/week-view/week-view.component').then((m) => m.WeekViewComponent),
      },
      {
        path: 'day',
        title: 'Day · Kickoff',
        loadComponent: () => import('./routes/day-view/day-view.component').then((m) => m.DayViewComponent),
      },
      {
        path: 'game-day',
        title: 'Game Day Central · Kickoff',
        loadComponent: () =>
          import('./routes/game-day-central/game-day-central.component').then((m) => m.GameDayCentralComponent),
      },
      {
        path: 'season/:league',
        title: 'Season · Kickoff',
        loadComponent: () =>
          import('./routes/season-schedule/season-schedule.component').then((m) => m.SeasonScheduleComponent),
      },
      {
        path: 'conferences/:league',
        title: 'Conferences · Kickoff',
        loadComponent: () =>
          import('./routes/conference-alignment/conference-alignment.component').then(
            (m) => m.ConferenceAlignmentComponent,
          ),
      },
      {
        path: 'upcoming',
        pathMatch: 'full',
        redirectTo: 'my-teams',
      },
      {
        path: 'my-teams',
        title: 'My Teams · Kickoff',
        loadComponent: () => import('./routes/my-teams/my-teams.component').then((m) => m.MyTeamsComponent),
      },
      {
        path: 'game/:id',
        title: 'Game · Kickoff',
        loadComponent: () => import('./routes/game-detail/game-detail.component').then((m) => m.GameDetailComponent),
      },
      {
        path: 'games',
        title: 'Mini-Games · Kickoff',
        loadComponent: () => import('./routes/mini-games/mini-games.component').then((m) => m.MiniGamesComponent),
      },
      {
        path: 'formations/:side',
        title: 'Formations · Kickoff',
        loadComponent: () => import('./routes/formations/formations.component').then((m) => m.FormationsComponent),
      },
      {
        path: 'routes',
        title: 'Receiver Route Tree · Kickoff',
        loadComponent: () => import('./routes/route-map/route-map.component').then((m) => m.RouteMapComponent),
      },
      {
        path: 'games/division-match/:league',
        title: 'Division Match · Kickoff',
        loadComponent: () =>
          import('./routes/division-match/division-match.component').then((m) => m.DivisionMatchComponent),
      },
      {
        path: 'games/match-location/:league',
        title: 'Match Location · Kickoff',
        loadComponent: () =>
          import('./routes/match-location/match-location.component').then((m) => m.MatchLocationComponent),
      },
      {
        path: 'games/whos-missing/:league',
        title: 'Who’s Missing? · Kickoff',
        loadComponent: () =>
          import('./routes/whos-missing/whos-missing.component').then((m) => m.WhosMissingComponent),
      },
      {
        path: 'games/logo-blitz/:league',
        title: 'Logo Blitz · Kickoff',
        loadComponent: () =>
          import('./routes/logo-blitz/logo-blitz.component').then((m) => m.LogoBlitzComponent),
      },
      {
        path: 'games/route-recognition',
        title: 'Route Recognition · Kickoff',
        loadComponent: () =>
          import('./routes/route-recognition/route-recognition.component').then((m) => m.RouteRecognitionComponent),
      },
      {
        path: 'games/stadium-recognition/:league',
        title: 'Stadium Recognition · Kickoff',
        loadComponent: () =>
          import('./routes/stadium-recognition/stadium-recognition.component').then(
            (m) => m.StadiumRecognitionComponent,
          ),
      },
      {
        path: 'games/kickoff-drive',
        title: 'Kickoff Drive · Kickoff',
        loadComponent: () =>
          import('./routes/kickoff-drive/kickoff-drive.component').then((m) => m.KickoffDriveComponent),
      },
      {
        path: 'playoffs/:league',
        title: 'Playoff Bracket · Kickoff',
        loadComponent: () =>
          import('./routes/playoff-bracket/playoff-bracket.component').then((m) => m.PlayoffBracketComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
