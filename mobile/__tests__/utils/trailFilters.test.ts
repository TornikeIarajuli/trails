import { activeFilterCount, difficultyLabel, DIFFICULTY_OPTIONS, showResultsLabel } from '../../utils/trailFilters';

describe('activeFilterCount', () => {
  it('is zero with nothing set', () => {
    expect(activeFilterCount({ difficulty: null, region: null })).toBe(0);
  });

  it('counts difficulty and region once each', () => {
    expect(activeFilterCount({ difficulty: 'hard', region: null })).toBe(1);
    expect(activeFilterCount({ difficulty: null, region: 'Svaneti' })).toBe(1);
    expect(activeFilterCount({ difficulty: 'easy', region: 'Tusheti' })).toBe(2);
  });

  it('ignores an empty region', () => {
    expect(activeFilterCount({ difficulty: null, region: '' })).toBe(0);
  });
});

describe('showResultsLabel', () => {
  it('names the count, singular and plural', () => {
    expect(showResultsLabel(24)).toBe('Show 24 trails');
    expect(showResultsLabel(1)).toBe('Show 1 trail');
  });

  it('says when nothing matches', () => {
    expect(showResultsLabel(0)).toBe('No trails match');
  });

  it('leaves the number out while it is not known', () => {
    expect(showResultsLabel(null)).toBe('Show trails');
  });
});

describe('difficulty options', () => {
  it('lists the four difficulties, easiest first, with readable labels', () => {
    expect(DIFFICULTY_OPTIONS).toEqual(['easy', 'medium', 'hard', 'ultra']);
    expect(DIFFICULTY_OPTIONS.map(difficultyLabel)).toEqual(['Easy', 'Medium', 'Hard', 'Ultra']);
  });
});
