import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RECEIVER_ROUTES, ReceiverRoute } from '../../core/data/receiver-routes.data';

/**
 * Interactive receiver route tree. A numbered route is selected on the left
 * and rendered as a field diagram on the right.
 */
@Component({
  selector: 'app-route-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-map.component.html',
  styleUrl: './route-map.component.scss',
})
export class RouteMapComponent {
  protected readonly routes = RECEIVER_ROUTES;
  protected readonly selectedRoute = signal<ReceiverRoute>(RECEIVER_ROUTES[0]);
  protected readonly yardLines = [72, 117, 162, 207, 252, 297];

  protected selectRoute(route: ReceiverRoute): void {
    this.selectedRoute.set(route);
  }
}
