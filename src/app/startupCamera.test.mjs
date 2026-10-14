import test from 'node:test';
import assert from 'node:assert/strict';
import { flyToAustin, flyToChicago } from '../camera.js';

test('teardown before the initial camera delay prevents a late flight', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let flights = 0;
  let cancelled = 0;
  const stop = flyToAustin({
    isDestroyed: () => false,
    camera: {
      setView() {},
      flyTo() {
        flights++;
      },
      cancelFlight() {
        cancelled++;
      },
    },
  });
  stop();
  t.mock.timers.tick(1000);
  assert.equal(flights, 0);
  assert.equal(cancelled, 1);
});

test('the Chicago opening starts over the lake and can be cancelled', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const views = [];
  const flights = [];
  const camera = {
    setView: (view) => views.push(view),
    flyTo: (view) => flights.push(view),
    cancelFlight() {},
  };
  flyToChicago({ isDestroyed: () => false, camera });
  assert.equal(views.length, 1);
  t.mock.timers.tick(600);
  assert.equal(flights.length, 1);
  assert.equal(flights[0].duration, 4);
  const stop = flyToChicago({ isDestroyed: () => false, camera });
  stop();
  t.mock.timers.tick(1000);
  assert.equal(flights.length, 1, 'a cancelled opening never flies');
});
