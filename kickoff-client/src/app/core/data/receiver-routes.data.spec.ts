import { RECEIVER_ROUTES } from './receiver-routes.data';

describe('Receiver route diagram alignments', () => {
  it('starts every path at its displayed position marker', () => {
    for (const route of RECEIVER_ROUTES) {
      if (route.diagramPaths) {
        for (const path of route.diagramPaths) {
          expect(pathStart(path.pathData)).withContext(`${route.name} ${path.label}`)
            .toEqual([path.startX, path.startY ?? 310]);
        }
      } else {
        expect(pathStart(route.pathData)).withContext(route.name)
          .toEqual([route.startX ?? 84, route.startY ?? 310]);
      }
    }
  });

  it('keeps receivers outside the tackle box unless they are in the backfield', () => {
    for (const route of RECEIVER_ROUTES) {
      const alignments = route.diagramPaths ?? [{
        label: route.positionLabel ?? 'X',
        startX: route.startX ?? 84,
        startY: route.startY,
        pathData: route.pathData,
      }];

      for (const alignment of alignments) {
        const inBackfield = (alignment.startY ?? 310) > 316;
        const outsideTackleBox = alignment.startX < 166 || alignment.startX > 274;
        expect(inBackfield || outsideTackleBox).withContext(`${route.name} ${alignment.label}`).toBeTrue();
      }
    }
  });

  it('draws the Wheel and Texas routes from a running back alignment', () => {
    for (const name of ['Wheel', 'Texas']) {
      const route = RECEIVER_ROUTES.find((candidate) => candidate.name === name)!;
      expect(route.positionLabel).withContext(name).toBe('RB');
      expect(route.startX).withContext(name).toBe(220);
      expect(route.startY).withContext(name).toBeGreaterThan(316);
    }
  });
});

function pathStart(pathData: string): [number, number] {
  const match = /^M(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/.exec(pathData);
  if (!match) throw new Error(`Route path does not begin with an absolute move: ${pathData}`);
  return [Number(match[1]), Number(match[2])];
}
