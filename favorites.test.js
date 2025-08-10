// Simple localStorage mock
function createLocalStorage() {
  let store = {};
  return {
    getItem: jest.fn(key => (key in store ? store[key] : null)),
    setItem: jest.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
}

let Favorites;

beforeEach(() => {
  jest.resetModules();
  global.window = global;
  global.localStorage = createLocalStorage();
  require('./favorites.js');
  Favorites = global.Favorites;
});

afterEach(() => {
  delete global.Favorites;
  delete global.localStorage;
  delete global.window;
});

describe('Favorites manager', () => {
  test('addFavorite avoids duplicates', () => {
    const item = { id: '1', kind: 'meal', name: 'Pizza' };
    Favorites.addFavorite(item);
    Favorites.addFavorite(item); // duplicate
    const list = Favorites.getFavorites();
    expect(list).toHaveLength(1);
  });

  test('removeFavorite deletes entries', () => {
    const first = { id: '1', kind: 'meal' };
    const second = { id: '2', kind: 'meal' };
    Favorites.addFavorite(first);
    Favorites.addFavorite(second);
    Favorites.removeFavorite(first);
    const list = Favorites.getFavorites();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('2');
  });

  test('isFavorite returns correct boolean', () => {
    const item = { id: '99', kind: 'meal' };
    expect(Favorites.isFavorite(item)).toBe(false);
    Favorites.addFavorite(item);
    expect(Favorites.isFavorite(item)).toBe(true);
    Favorites.removeFavorite(item);
    expect(Favorites.isFavorite(item)).toBe(false);
  });

  test('handles invalid coordinates without generating bad keys', () => {
    const bad = { name: 'Mystery Spot', kind: 'spot', lat: 'oops', lon: Infinity };
    expect(Favorites.isFavorite(bad)).toBe(false);
    Favorites.addFavorite(bad);
    const list = Favorites.getFavorites();
    expect(list).toHaveLength(1);
    expect(list[0].key).toBe('spot:Mystery Spot|,');
    expect(list[0].key).not.toMatch(/NaN|Infinity/);
    expect(Favorites.isFavorite(bad)).toBe(true);
    Favorites.removeFavorite(bad);
    expect(Favorites.isFavorite(bad)).toBe(false);
    expect(Favorites.getFavorites()).toHaveLength(0);
  });
});

