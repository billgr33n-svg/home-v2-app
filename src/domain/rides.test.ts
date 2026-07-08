import { openRideViews, toRideView, type RawRide } from './rides';

const unassigned: RawRide = {
  id: 'r1',
  destination_text: 'Eastside Soccer Complex',
  pickup_text: 'Green Home',
  state: 'needed',
  driver_id: null,
  depart_by: null,
  version: 1,
};

describe('rides domain', () => {
  it('marks an unassigned ride as needing a driver at P0', () => {
    const v = toRideView(unassigned, null);
    expect(v.needsDriver).toBe(true);
    expect(v.ownerLabel).toBe('Unassigned');
    expect(v.statusLabel).toBe('Needs a driver');
    expect(v.priority).toBe('P0');
  });

  it('shows the driver name and a calmer priority once assigned', () => {
    const v = toRideView({ ...unassigned, state: 'assigned', driver_id: 'u9' }, 'Bill');
    expect(v.needsDriver).toBe(false);
    expect(v.ownerLabel).toBe('Bill');
    expect(v.statusLabel).toBe('Driver assigned');
    expect(v.priority).toBe('P2');
  });

  it('hides completed/canceled rides and puts needs-driver first', () => {
    const views = openRideViews(
      [
        { ...unassigned, id: 'done', state: 'completed' },
        { ...unassigned, id: 'assigned', state: 'assigned', driver_id: 'u9' },
        unassigned,
      ],
      { u9: 'Bill' },
    );
    expect(views.map((v) => v.id)).toEqual(['r1', 'assigned']);
    expect(views[0].needsDriver).toBe(true);
  });
});
