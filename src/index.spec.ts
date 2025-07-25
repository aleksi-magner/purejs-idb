import { afterEach, describe, test, expect } from 'vitest';

import { initDatabase, idb, deleteDatabase } from './index';

type SourceObject = {
  foo: string;
  obj: { a: number; b: number };
  array: [{ id: number; text: number }, string];
  any: undefined;
  Null: null;
  number: number;
  date: Date;
};

describe('idb', () => {
  afterEach(() => {
    deleteDatabase();
  });

  test('initDatabase. Don`t init', async () => {
    expect(() => idb.get('key')).toThrowError(
      new Error(
        '[IndexedDB]. The service has not been initialized. Run initDatabase(<DBName>, <StoreName>)',
      ),
    );
  });

  test('initDatabase. Don`t db name', async () => {
    const errorMessage = '[IndexedDB]. The service has not been initialized. Set name';

    await expect(() => initDatabase('', '')).rejects.toThrowError(errorMessage);
    await expect(() => initDatabase('any-db', '')).rejects.toThrowError(errorMessage);
  });

  test('initDatabase. Version error', async () => {
    await expect(initDatabase('any-db', 'any-store', 2)).resolves.toBeUndefined();

    await expect(idb.get('key')).resolves.toBeUndefined();

    await expect(initDatabase('any-db', 'any-store', 1)).rejects.toThrowError(
      '[IndexedDB]. An attempt was made to open a database using a lower version than the existing version.',
    );
  });

  test('get', async () => {
    await initDatabase('any-db', 'any-store', 2);

    await idb.set({
      key1: 'string',
      key2: [1, 2, 3],
      key3: {
        a: 'any',
      },
    });

    const key1 = await idb.get('key1');

    expect(key1).toBe('string');

    const manyKeys = await idb.get(['key3', 'key1']);

    expect(manyKeys).toEqual([{ a: 'any' }, 'string']);
  });

  test('set', async () => {
    await initDatabase('any-db', 'any-store', 2);

    try {
      await idb.set({});
    } catch (err) {
      expect(err).toEqual(new Error('[IndexedDB]. SET. Wrong params type'));
    }

    const empty = await idb.get('key');

    expect(empty).toBeUndefined();

    await idb.set({ key: 'any' });

    const value = await idb.get('key');

    expect(value).toBe('any');

    const string: string = 'string value';
    const number: number = 42;
    const bool: boolean = true;

    const sourceObject: SourceObject = {
      foo: 'bar',
      obj: {
        a: 1,
        b: 2,
      },
      array: [
        {
          id: 1,
          text: 42,
        },
        'string',
      ],
      any: undefined,
      Null: null,
      number: 0,
      date: new Date('2023-03-20'),
    };

    const arr: [{ id: number; text: number }, string] = [
      {
        id: 1,
        text: 42,
      },
      'string',
    ];

    await idb.set({
      string,
      number,
      bool,
      sourceObject,
      arr,
    });

    sourceObject.obj.a = 4;
    sourceObject.array[0].id = 4;
    sourceObject.date.setFullYear(3000);

    arr[0].id = 7;

    expect(sourceObject).toEqual({
      foo: 'bar',
      obj: {
        a: 4,
        b: 2,
      },
      array: [
        {
          id: 4,
          text: 42,
        },
        'string',
      ],
      any: undefined,
      Null: null,
      number: 0,
      date: new Date('3000-03-20'),
    });

    const storeValues = await idb.get([
      'invalid key',
      'string',
      'number',
      'bool',
      'sourceObject',
      'arr',
    ]);

    expect(storeValues).toEqual([
      undefined,
      'string value',
      42,
      true,
      {
        foo: 'bar',
        obj: {
          a: 1,
          b: 2,
        },
        array: [
          {
            id: 1,
            text: 42,
          },
          'string',
        ],
        any: undefined,
        Null: null,
        number: 0,
        date: new Date('2023-03-20'),
      },
      [
        {
          id: 1,
          text: 42,
        },
        'string',
      ],
    ]);
  });

  test('update', async () => {
    await initDatabase('any-db', 'any-store', 2);

    const empty = await idb.get('number');

    expect(empty).toBeUndefined();

    await idb.update('number', value => (value || 0) + 1);
    await idb.update('number', value => (value || 0) + 1);
    await idb.update('number', value => (value || 0) + 40);

    const number = await idb.get('number');

    expect(number).toBe(42);

    await idb.update('number', value => ({ key: value }));

    const object = await idb.get('number');

    expect(object).toEqual({ key: 42 });

    await idb.update('number', value => ({
      ...value,
      key2: 1,
    }));

    const newObject = await idb.get('number');

    expect(newObject).toEqual({
      key: 42,
      key2: 1,
    });
  });

  test('delete', async () => {
    await initDatabase('any-db', 'any-store');

    await idb.set({
      1: 1,
      2: 2,
      3: 3,
    });

    const allKeys = await idb.get(['1', '2', '3']);

    expect(allKeys).toEqual([1, 2, 3]);

    await idb.delete('3');

    const someKeys = await idb.get(['1', '2', '3']);

    expect(someKeys).toEqual([1, 2, undefined]);

    await idb.delete(['1', '2', '3']);

    const empty = await idb.get(['1', '2', '3']);

    expect(empty).toEqual([undefined, undefined, undefined]);
  });

  test('clear', async () => {
    await initDatabase('any-db', 'any-store', 2);

    await idb.set({
      1: 1,
      2: 2,
      3: 3,
    });

    const allKeys = await idb.get(['1', '2', '3']);

    expect(allKeys).toEqual([1, 2, 3]);

    await idb.clear();

    const empty = await idb.get(['1', '2', '3']);

    expect(empty).toEqual([undefined, undefined, undefined]);
  });

  test('keys', async () => {
    await initDatabase('any-db', 'any-store', 2);

    await idb.set({
      1: 1,
      2: 2,
      3: 3,
    });

    const allKeys = await idb.keys();

    expect(allKeys).toEqual(['1', '2', '3']);
  });

  test('values', async () => {
    await initDatabase('any-db', 'any-store');

    await idb.set({
      1: 4,
      2: 5,
      3: 6,
    });

    const allValues = await idb.values();

    expect(allValues).toEqual([4, 5, 6]);
  });

  test('entries', async () => {
    await initDatabase('any-db', 'any-store');

    await idb.set({
      1: 4,
      2: 5,
      3: 6,
    });

    const entries = await idb.entries();

    expect(entries).toEqual({
      1: 4,
      2: 5,
      3: 6,
    });
  });
});
