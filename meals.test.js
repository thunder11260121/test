let computeOpenStatus;

describe('computeOpenStatus', () => {
  beforeEach(() => {
    jest.resetModules();
    global.window = { addEventListener: () => {} };
    ({ computeOpenStatus } = require('./meals.js'));
  });
  afterEach(() => {
    delete global.window;
  });
  test('returns open for times across midnight', () => {
    const oh = 'Mo-Su 22:00-02:00';
    const beforeMidnight = new Date('2023-01-01T23:00:00Z');
    const afterMidnight = new Date('2023-01-02T01:00:00Z');
    expect(computeOpenStatus(oh, beforeMidnight).open).toBe(true);
    expect(computeOpenStatus(oh, afterMidnight).open).toBe(true);
  });
});
