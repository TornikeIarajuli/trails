jest.mock('../../services/offlineMaps', () => ({
  readManifest: jest.fn(),
  saveTrailTopo: jest.fn(),
  removeTrailTopo: jest.fn(),
  deleteAllOfflineMaps: jest.fn(),
}));

import { useOfflineMapsStore } from '../../store/offlineMapsStore';
import * as service from '../../services/offlineMaps';
import { TilePlan } from '../../utils/topoTiles';

const readManifest = service.readManifest as jest.Mock;
const saveTrailTopo = service.saveTrailTopo as jest.Mock;
const removeTrailTopo = service.removeTrailTopo as jest.Mock;
const deleteAllOfflineMaps = service.deleteAllOfflineMaps as jest.Mock;

const plan: TilePlan = { tiles: ['10/638/377', '15/20447/12082'], minZoom: 10, maxZoom: 15, droppedZooms: [] };
const entry = (tiles: string[], bytes: number) => ({ tiles, bytes, savedAt: '', minZoom: 10, maxZoom: 15 });
const state = () => useOfflineMapsStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  useOfflineMapsStore.setState({ loaded: false, saved: {}, active: null, failedTrailId: null });
  readManifest.mockReturnValue({ version: 1, trails: {} });
});

describe('offline maps store', () => {
  it('loads the saved trails from the manifest once', () => {
    readManifest.mockReturnValue({ version: 1, trails: { gergeti: entry(plan.tiles, 64_000) } });
    state().load();
    state().load();
    expect(readManifest).toHaveBeenCalledTimes(1);
    expect(state().saved).toEqual({ gergeti: { bytes: 64_000, tiles: 2 } });
  });

  it('shows progress while downloading and the trail as saved afterwards', async () => {
    let finish: (value: unknown) => void = () => {};
    saveTrailTopo.mockImplementation((_id, _name, _plan, options) => {
      options.onProgress(1, 2);
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const run = state().download('gergeti', 'Gergeti', plan);
    expect(state().active).toEqual({ trailId: 'gergeti', done: 1, total: 2 });

    finish({ outcome: { status: 'done', created: plan.tiles, failed: [] }, saved: entry(plan.tiles, 64_000) });
    expect(await run).toBe('done');
    expect(state().active).toBeNull();
    expect(state().saved.gergeti).toEqual({ bytes: 64_000, tiles: 2 });
  });

  it('runs one download at a time', async () => {
    saveTrailTopo.mockReturnValue(new Promise(() => {}));
    void state().download('gergeti', 'Gergeti', plan);
    expect(await state().download('juta', 'Juta', plan)).toBe('busy');
    expect(saveTrailTopo).toHaveBeenCalledTimes(1);
  });

  it('cancels the running download through its control', async () => {
    let control: { cancelled: boolean } | null = null;
    saveTrailTopo.mockImplementation(async (_id, _name, _plan, options) => {
      control = options.control;
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { outcome: { status: options.control.cancelled ? 'cancelled' : 'done', created: [], failed: [] }, saved: null };
    });
    const run = state().download('gergeti', 'Gergeti', plan);
    state().cancel();
    expect(control).toEqual({ cancelled: true });
    expect(await run).toBe('cancelled');
    expect(state().saved).toEqual({});
    expect(state().failedTrailId).toBeNull();
  });

  it('remembers which trail failed, until the next attempt', async () => {
    saveTrailTopo.mockResolvedValueOnce({ outcome: { status: 'failed', created: [], failed: ['x'] }, saved: null });
    expect(await state().download('gergeti', 'Gergeti', plan)).toBe('failed');
    expect(state().failedTrailId).toBe('gergeti');

    saveTrailTopo.mockReturnValueOnce(new Promise(() => {}));
    void state().download('gergeti', 'Gergeti', plan);
    expect(state().failedTrailId).toBeNull();
  });

  it('treats an unexpected error as a failed download', async () => {
    saveTrailTopo.mockRejectedValueOnce(new Error('disk full'));
    expect(await state().download('gergeti', 'Gergeti', plan)).toBe('failed');
    expect(state().active).toBeNull();
    expect(state().failedTrailId).toBe('gergeti');
  });

  it('does not start a download with nothing to fetch', async () => {
    expect(await state().download('gergeti', 'Gergeti', { ...plan, tiles: [] })).toBe('failed');
    expect(saveTrailTopo).not.toHaveBeenCalled();
  });

  it('removes one trail, keeping the others', () => {
    useOfflineMapsStore.setState({ saved: { gergeti: { bytes: 1, tiles: 1 }, juta: { bytes: 2, tiles: 2 } } });
    removeTrailTopo.mockReturnValue({ version: 1, trails: { juta: entry(['a', 'b'], 2) } });
    state().remove('gergeti');
    expect(removeTrailTopo).toHaveBeenCalledWith('gergeti');
    expect(state().saved).toEqual({ juta: { bytes: 2, tiles: 2 } });
  });

  it('deletes everything, stopping a running download first', async () => {
    let control: { cancelled: boolean } | null = null;
    saveTrailTopo.mockImplementation((_id, _name, _plan, options) => {
      control = options.control;
      return new Promise(() => {});
    });
    void state().download('gergeti', 'Gergeti', plan);
    useOfflineMapsStore.setState({ saved: { juta: { bytes: 2, tiles: 2 } } });
    state().deleteAll();
    expect(control).toEqual({ cancelled: true });
    expect(deleteAllOfflineMaps).toHaveBeenCalled();
    expect(state().saved).toEqual({});
  });
});
