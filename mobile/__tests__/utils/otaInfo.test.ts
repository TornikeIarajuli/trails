import { describeRunningUpdate } from '../../utils/otaInfo';

describe('describeRunningUpdate', () => {
  it('names the update bundled with the build "built-in"', () => {
    expect(describeRunningUpdate(null, true)).toBe('built-in');
    expect(describeRunningUpdate('0f3c1d9a-1111-2222-3333-444455556666', true)).toBe('built-in');
  });

  it('shows the start of the id for a downloaded update', () => {
    expect(describeRunningUpdate('0f3c1d9a-1111-2222-3333-444455556666', false)).toBe('0f3c1d9a');
  });
});
