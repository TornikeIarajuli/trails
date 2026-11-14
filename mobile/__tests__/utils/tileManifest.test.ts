import {
  SavedTopoTrail,
  emptyManifest,
  parseManifest,
  tilesInUse,
  tilesNotSaved,
  tilesToDeleteOnRemove,
  withTrail,
  withoutTrail,
} from '../../utils/tileManifest';

const entry = (tiles: string[], overrides: Partial<SavedTopoTrail> = {}): SavedTopoTrail => ({
  name: 'Trail',
  tiles,
  bytes: tiles.length * 30_000,
  savedAt: '2026-11-14T10:00:00.000Z',
  minZoom: 10,
  maxZoom: 15,
  ...overrides,
});

// Two neighbouring trails sharing their low-zoom tiles and one close-up
const gergeti = entry(['10/638/377', '11/1277/754', '15/20447/12082', '15/20447/12083']);
const juta = entry(['10/638/377', '11/1277/754', '15/20447/12083', '15/20460/12100']);
const both = withTrail(withTrail(emptyManifest(), 'gergeti', gergeti), 'juta', juta);

describe('manifest-based removal', () => {
  it('deletes only the tiles no other saved trail uses', () => {
    expect(tilesToDeleteOnRemove(both, 'gergeti')).toEqual(['15/20447/12082']);
    expect(tilesToDeleteOnRemove(both, 'juta')).toEqual(['15/20460/12100']);
  });

  it('deletes every tile of the last trail using them', () => {
    const onlyJuta = withoutTrail(both, 'gergeti');
    expect(tilesToDeleteOnRemove(onlyJuta, 'juta').sort()).toEqual([...juta.tiles].sort());
  });

  it('deletes nothing for a trail that is not saved', () => {
    expect(tilesToDeleteOnRemove(both, 'chaukhi')).toEqual([]);
  });

  it('lists a tile once even if the plan repeated it', () => {
    const m = withTrail(emptyManifest(), 't', entry(['12/1/1', '12/1/1']));
    expect(tilesToDeleteOnRemove(m, 't')).toEqual(['12/1/1']);
  });

  it('removes the trail from the manifest without touching the others', () => {
    const next = withoutTrail(both, 'gergeti');
    expect(Object.keys(next.trails)).toEqual(['juta']);
    expect(Object.keys(both.trails)).toEqual(['gergeti', 'juta']);
  });
});

describe('tiles in use', () => {
  it('collects the tiles of all saved trails, or all but one', () => {
    expect(tilesInUse(both).size).toBe(5);
    expect([...tilesInUse(both, 'juta')].sort()).toEqual([...gergeti.tiles].sort());
  });

  it('keeps the tiles of a cancelled download that a saved trail still needs', () => {
    expect(tilesNotSaved(both, ['10/638/377', '15/20500/12000'])).toEqual(['15/20500/12000']);
  });
});

describe('parseManifest', () => {
  it('reads back what was written', () => {
    expect(parseManifest(JSON.stringify(both))).toEqual(both);
  });

  it('starts empty from nothing or from a damaged file', () => {
    expect(parseManifest(null)).toEqual(emptyManifest());
    expect(parseManifest('{not json')).toEqual(emptyManifest());
    expect(parseManifest('[]')).toEqual(emptyManifest());
    expect(parseManifest('{"trails": 3}')).toEqual(emptyManifest());
  });

  it('drops malformed entries and fields', () => {
    const parsed = parseManifest(
      JSON.stringify({
        version: 1,
        trails: {
          good: { tiles: ['12/1/1', 7], bytes: -5 },
          bad: { tiles: 'nope' },
          empty: null,
        },
      }),
    );
    expect(parsed.trails).toEqual({
      good: { tiles: ['12/1/1'], bytes: 0, savedAt: '', minZoom: 0, maxZoom: 0 },
    });
  });
});
