import { vi, afterEach, describe, test, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { setDBName, setDBStoreName, idb, removeDBStore, deleteDatabase } from './index';

const errorPrefix = '[IndexedDB]';

describe('idb', () => {
  afterEach(() => {
    indexedDB = new IDBFactory();

    deleteDatabase();
    setDBName('');
    setDBStoreName('');
  });

  describe('Проверка инициализации', () => {
    test('Отсутствует имя БД', async () => {
      const errorMessage = `${errorPrefix}. Database name not set. Run setDBName(DBName)`;

      await expect(idb.get('key')).rejects.toThrow(errorMessage);
    });

    test('При получении списка баз ошибка', async () => {
      const errorMessage = 'Ошибка получении БД произошла ошибка';

      vi.stubGlobal('indexedDB', {
        databases: () => Promise.reject(new Error(errorMessage)),
      });

      setDBName('some-db');
      setDBStoreName('some-store');

      await expect(idb.get('key')).rejects.toThrow(`${errorPrefix}. ${errorMessage}`);

      vi.unstubAllGlobals();
    });

    test('При открытии базы ошибка', async () => {
      const spyOpen = vi.spyOn(indexedDB, 'databases');

      spyOpen
        .mockImplementationOnce(() =>
          Promise.resolve([
            {
              name: 'some-db',
              version: 4,
            },
          ]),
        )
        // Меняем имя базы для сброса версии
        .mockImplementationOnce(() => Promise.resolve([]))
        // Занижаем версию базы для вывода ошибки
        .mockImplementationOnce(() =>
          Promise.resolve([
            {
              name: 'some-db',
              version: 2,
            },
          ]),
        );

      setDBName('some-db');
      setDBStoreName('some-store');

      await expect(idb.get('key')).resolves.toBeUndefined();

      setDBName('some-db2');

      await expect(idb.get('key')).resolves.toBeUndefined();

      setDBName('some-db');

      const errorMessage =
        'An attempt was made to open a database using a lower version than the existing version';

      await expect(idb.get('key')).rejects.toThrow(`${errorPrefix}. ${errorMessage}`);

      vi.restoreAllMocks();
    });

    test('Сброс имени базы', async () => {
      setDBName('some-db');

      await expect(idb.get('key', 'any-store')).resolves.toBeUndefined();

      setDBName('');

      const errorMessage = `${errorPrefix}. Database name not set. Run setDBName(DBName)`;

      await expect(idb.get('key', 'any-store')).rejects.toThrow(errorMessage);
    });

    test('Инициализация успешна', async () => {
      setDBName('some-db');

      await expect(idb.get('key', 'any-store')).resolves.toBeUndefined();

      setDBStoreName('some-store');

      await expect(idb.get('key')).resolves.toBeUndefined();
    });

    test('Повторная установка имени базы', async () => {
      setDBName('some-db');

      // Для открытия базы
      await expect(idb.get('key', 'any-store')).resolves.toBeUndefined();

      setDBName('some-db');
    });
  });

  describe('Запись в хранилище', () => {
    const errorMessage = `${errorPrefix}. SET. Wrong params type`;

    test('Нет аргументов функции', async () => {
      setDBName('some-db');

      await expect(idb.set(undefined)).rejects.toThrow(errorMessage);
    });

    test('Аргумент функции не объект', async () => {
      setDBName('some-db');

      await expect(idb.set('Key')).rejects.toThrow(errorMessage);
    });

    test('Аргумент функции пустой объект', async () => {
      setDBName('some-db');

      await expect(idb.set(null)).rejects.toThrow(errorMessage);
      await expect(idb.set({})).rejects.toThrow(errorMessage);
    });

    test('Корректная установка значения', async () => {
      setDBName('some-db');

      await expect(idb.get('key', 'any-store')).resolves.toBeUndefined();

      await idb.set(
        {
          key: 'value',
        },
        'any-store',
      );

      await expect(idb.get('key', 'any-store')).resolves.toBe('value');

      setDBStoreName('some-store');

      await expect(idb.get('key')).resolves.toBeUndefined();

      await idb.set({
        key: 'value 2',
      });

      await expect(idb.get('key')).resolves.toBe('value 2');
    });

    type SourceObject = {
      foo: string;
      obj: { a: number; b: number };
      array: [{ id: number; text: number }, string];
      any: undefined;
      Null: null;
      number: number;
      date: Date;
    };

    test('Проверка на иммутабельность (неизменяемость)', async () => {
      setDBName('some-db');
      setDBStoreName('some-store');

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

      // Проверяем что изменился исходник
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

      // Проверяем что в хранилище изначальное значение
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
  });

  describe('Чтение из хранилища', () => {
    test('Нет значений в хранилище', async () => {
      setDBName('some-db');

      await expect(idb.get('', 'any-store')).resolves.toBeUndefined();
    });

    test('Получение одного значения', async () => {
      setDBName('some-db');

      await idb.set(
        {
          key: 'value',
        },
        'any-store',
      );

      const value = await idb.get('key', 'any-store');

      expect(value).toBe('value');

      setDBStoreName('some-store');

      await idb.set({
        key: 'value 2',
      });

      const value2 = await idb.get('key');

      expect(value2).toBe('value 2');

      const value3 = await idb.get('key', 'some-store');

      expect(value3).toBe('value 2');
    });

    test('Получение нескольких значений', async () => {
      setDBName('some-db');

      await idb.set(
        {
          key: 'value',
          key2: [1, 2, 3],
          key3: {
            a: 'any',
          },
        },
        'any-store',
      );

      const [value1, value2, value3] = await idb.get(['key', 'key2', 'key3'], 'any-store');

      expect(value1).toBe('value');
      expect(value2).toEqual([1, 2, 3]);
      expect(value3).toEqual({ a: 'any' });

      setDBStoreName('some-store');

      await idb.set({
        key: 'value 3',
        key2: [4, 5, 6],
        key3: {
          b: 'some',
        },
      });

      const [value4, value5, value6] = await idb.get(['key', 'key2', 'key3']);

      expect(value4).toBe('value 3');
      expect(value5).toEqual([4, 5, 6]);
      expect(value6).toEqual({ b: 'some' });

      const [value7, value8, value9] = await idb.get(['key', 'key2', 'key3'], 'some-store');

      expect(value7).toBe('value 3');
      expect(value8).toEqual([4, 5, 6]);
      expect(value9).toEqual({ b: 'some' });
    });
  });

  describe('Обновление значений в хранилище', () => {
    test('Не передана функция обратного вызова', async () => {
      setDBName('some-db');

      await idb.set(
        {
          key: 'value',
        },
        'any-store',
      );

      await expect(idb.get('key', 'any-store')).resolves.toBe('value');

      await idb.update('key', null, 'any-store');

      await expect(idb.get('key', 'any-store')).resolves.toBe('value');

      setDBStoreName('some-store');

      await idb.set({
        key: 'value',
      });

      await expect(idb.get('key')).resolves.toBe('value');

      await idb.update('key', null);

      await expect(idb.get('key')).resolves.toBe('value');
    });

    test('Обновление числа', async () => {
      setDBName('some-db');

      await expect(idb.get('number', 'any-store')).resolves.toBeUndefined();

      await idb.update('number', (value = 0) => value + 1, 'any-store');
      await idb.update('number', (value = 0) => value + 1, 'any-store');
      await idb.update('number', (value = 0) => value + 40, 'any-store');

      setDBStoreName('some-store');

      await idb.update('number', (value = 0) => value + 1);
      await idb.update('number', (value = 0) => value + 1);
      await idb.update('number', (value = 0) => value + 40);
      await idb.update('number', value => value / 6);

      await expect(idb.get('number', 'any-store')).resolves.toBe(42);
      await expect(idb.get('number')).resolves.toBe(7);
    });

    test('Обновление строки', async () => {
      setDBName('some-db');

      await expect(idb.get('string', 'any-store')).resolves.toBeUndefined();

      await idb.update('string', (value = '') => value + 'a', 'any-store');
      await idb.update('string', (value = '') => value + 'b', 'any-store');
      await idb.update('string', (value = '') => value + 'c', 'any-store');

      setDBStoreName('some-store');

      await idb.update('string', (value = '') => value + 'c');
      await idb.update('string', (value = '') => value + 'b');
      await idb.update('string', (value = '') => value + 'a');

      await expect(idb.get('string', 'any-store')).resolves.toBe('abc');
      await expect(idb.get('string')).resolves.toBe('cba');
    });

    test('Обновление логического значения', async () => {
      setDBName('some-db');

      await expect(idb.get('bool', 'any-store')).resolves.toBeUndefined();

      await idb.update('bool', value => !!value, 'any-store');
      await idb.update('bool', value => !value, 'any-store');

      setDBStoreName('some-store');

      await idb.update('bool', value => !value);
      await idb.update('bool', value => !!value);

      await expect(idb.get('bool', 'any-store')).resolves.toBe(true);
      await expect(idb.get('bool')).resolves.toBe(true);
    });

    test('Обновление объекта', async () => {
      setDBName('some-db');

      await expect(idb.get('arr', 'any-store')).resolves.toBeUndefined();
      await expect(idb.get('obj', 'any-store')).resolves.toBeUndefined();

      await idb.set(
        {
          arr: [1],
          obj: { key: 42 },
        },
        'any-store',
      );

      await expect(idb.get('arr', 'any-store')).resolves.toEqual([1]);
      await expect(idb.get('obj', 'any-store')).resolves.toEqual({ key: 42 });

      const callbackArr = (value: any[]): any[] => {
        const arr = value || [];

        arr.push(arr.length + 1);

        return arr;
      };

      const callbackObj = (value: Record<string, unknown>): Record<string, unknown> => ({
        ...(value || {}),
        count: ((value?.['count'] as number) || 0) + 1,
      });

      await idb.update('arr', callbackArr, 'any-store');
      await idb.update('arr', callbackArr, 'any-store');

      await idb.update('obj', callbackObj, 'any-store');
      await idb.update('obj', callbackObj, 'any-store');

      setDBStoreName('some-store');

      await expect(idb.get('arr')).resolves.toBeUndefined();
      await expect(idb.get('obj')).resolves.toBeUndefined();

      await idb.update('arr', callbackArr);
      await idb.update('arr', callbackArr);

      await idb.update('obj', callbackObj);
      await idb.update('obj', callbackObj);

      await expect(idb.get('arr', 'any-store')).resolves.toEqual([1, 2, 3]);
      await expect(idb.get('arr')).resolves.toEqual([1, 2]);

      await expect(idb.get('obj', 'any-store')).resolves.toEqual({
        key: 42,
        count: 2,
      });

      await expect(idb.get('obj')).resolves.toEqual({
        count: 2,
      });
    });
  });

  describe('Удаление из хранилища', () => {
    test('Нет значений в хранилище', async () => {
      setDBName('some-db');

      await expect(idb.get('key', 'any-store')).resolves.toBeUndefined();

      await idb.delete('key', 'any-store');

      await expect(idb.get('key', 'any-store')).resolves.toBeUndefined();
    });

    test('Удаление одного значения', async () => {
      setDBName('some-db');

      await idb.set(
        {
          key: 'value',
          key2: 'value 2',
        },
        'any-store',
      );

      const [value, value2] = await idb.get(['key', 'key2'], 'any-store');

      expect(value).toBe('value');
      expect(value2).toBe('value 2');

      await idb.delete('key2', 'any-store');

      const [value3, value4] = await idb.get(['key', 'key2'], 'any-store');

      expect(value3).toBe('value');
      expect(value4).toBeUndefined();

      setDBStoreName('some-store');

      await idb.set({
        key: 'value 3',
        key2: 'value 4',
      });

      const [value5, value6] = await idb.get(['key', 'key2']);

      expect(value5).toBe('value 3');
      expect(value6).toBe('value 4');

      await idb.delete('key2');

      const [value7, value8] = await idb.get(['key', 'key2']);

      expect(value7).toBe('value 3');
      expect(value8).toBeUndefined();
    });

    test('Удаление нескольких значений', async () => {
      setDBName('some-db');

      await idb.set(
        {
          key: 'value',
          key2: 'value 2',
          key3: [1, 2, 3],
        },
        'any-store',
      );

      const [value, value2, value3] = await idb.get(['key', 'key2', 'key3'], 'any-store');

      expect(value).toBe('value');
      expect(value2).toBe('value 2');
      expect(value3).toEqual([1, 2, 3]);

      await idb.delete(['key2', 'key'], 'any-store');

      const [value4, value5, value6] = await idb.get(['key', 'key2', 'key3'], 'any-store');

      expect(value4).toBeUndefined();
      expect(value5).toBeUndefined();
      expect(value6).toEqual([1, 2, 3]);

      setDBStoreName('some-store');

      await idb.set({
        key: 'value',
        key2: 'value 2',
        key3: [1, 2, 3],
      });

      const [value7, value8, value9] = await idb.get(['key', 'key2', 'key3']);

      expect(value7).toBe('value');
      expect(value8).toBe('value 2');
      expect(value9).toEqual([1, 2, 3]);

      await idb.delete(['key2', 'key']);

      const [value10, value11, value12] = await idb.get(['key', 'key2', 'key3']);

      expect(value10).toBeUndefined();
      expect(value11).toBeUndefined();
      expect(value12).toEqual([1, 2, 3]);
    });
  });

  describe('Получение из хранилища всех ключей и значений', () => {
    test('Получение из пустого хранилища', async () => {
      setDBName('some-db');

      await expect(idb.entries('any-store')).resolves.toEqual({});

      setDBStoreName('some-store');

      await expect(idb.entries()).resolves.toEqual({});
    });

    test('Получение из хранилища с данными', async () => {
      setDBName('some-db');

      let entriesAnyStore = await idb.entries('any-store');

      expect(Object.keys(entriesAnyStore)).toHaveLength(0);

      await idb.set(
        {
          key: 'value',
          key2: 'value 2',
        },
        'any-store',
      );

      entriesAnyStore = await idb.entries('any-store');

      expect(Object.keys(entriesAnyStore)).toHaveLength(2);

      expect(entriesAnyStore).toEqual({
        key: 'value',
        key2: 'value 2',
      });

      await idb.set(
        {
          key3: 'value 3',
        },
        'any-store',
      );

      entriesAnyStore = await idb.entries('any-store');

      expect(Object.keys(entriesAnyStore)).toHaveLength(3);

      expect(entriesAnyStore).toEqual({
        key: 'value',
        key2: 'value 2',
        key3: 'value 3',
      });

      setDBStoreName('some-store');

      let entriesSomeStore = await idb.entries();

      expect(Object.keys(entriesSomeStore)).toHaveLength(0);

      await idb.set({
        key: 42,
        key2: [1, 2, 3],
      });

      entriesSomeStore = await idb.entries();

      expect(Object.keys(entriesSomeStore)).toHaveLength(2);

      expect(entriesSomeStore).toEqual({
        key: 42,
        key2: [1, 2, 3],
      });

      await idb.set({
        key3: { a: 'value' },
      });

      entriesSomeStore = await idb.entries();

      expect(Object.keys(entriesSomeStore)).toHaveLength(3);

      expect(entriesSomeStore).toEqual({
        key: 42,
        key2: [1, 2, 3],
        key3: { a: 'value' },
      });
    });

    test('Удаление нескольких значений', async () => {
      setDBName('some-db');

      await idb.set(
        {
          key: 'value',
          key2: 'value 2',
          key3: [1, 2, 3],
        },
        'any-store',
      );

      const [value, value2, value3] = await idb.get(['key', 'key2', 'key3'], 'any-store');

      expect(value).toBe('value');
      expect(value2).toBe('value 2');
      expect(value3).toEqual([1, 2, 3]);

      await idb.delete(['key2', 'key'], 'any-store');

      const [value4, value5, value6] = await idb.get(['key', 'key2', 'key3'], 'any-store');

      expect(value4).toBeUndefined();
      expect(value5).toBeUndefined();
      expect(value6).toEqual([1, 2, 3]);

      setDBStoreName('some-store');

      await idb.set({
        key: 'value',
        key2: 'value 2',
        key3: [1, 2, 3],
      });

      const [value7, value8, value9] = await idb.get(['key', 'key2', 'key3']);

      expect(value7).toBe('value');
      expect(value8).toBe('value 2');
      expect(value9).toEqual([1, 2, 3]);

      await idb.delete(['key2', 'key']);

      const [value10, value11, value12] = await idb.get(['key', 'key2', 'key3']);

      expect(value10).toBeUndefined();
      expect(value11).toBeUndefined();
      expect(value12).toEqual([1, 2, 3]);
    });
  });

  describe('Очистка хранилища', () => {
    test('Очистка пустого хранилища', async () => {
      setDBName('some-db');

      const entriesAnyStoreBefore = await idb.entries('any-store');

      expect(Object.keys(entriesAnyStoreBefore)).toHaveLength(0);

      await expect(idb.clear('any-store')).resolves.toBeUndefined();

      const entriesAnyStoreAfter = await idb.entries('any-store');

      expect(Object.keys(entriesAnyStoreAfter)).toHaveLength(0);

      setDBStoreName('some-store');

      const entriesSomeStoreBefore = await idb.entries();

      expect(Object.keys(entriesSomeStoreBefore)).toHaveLength(0);

      await expect(idb.clear()).resolves.toBeUndefined();

      const entriesSomeStoreAfter = await idb.entries();

      expect(Object.keys(entriesSomeStoreAfter)).toHaveLength(0);
    });

    test('Очистка хранилища с данными', async () => {
      setDBName('some-db');

      await idb.set(
        {
          key: 'value',
          key2: 'value 2',
        },
        'any-store',
      );

      const entriesAnyStoreBefore = await idb.entries('any-store');

      expect(Object.keys(entriesAnyStoreBefore)).toHaveLength(2);

      await expect(idb.clear('any-store')).resolves.toBeUndefined();

      const entriesAnyStoreAfter = await idb.entries('any-store');

      expect(Object.keys(entriesAnyStoreAfter)).toHaveLength(0);

      setDBStoreName('some-store');

      await idb.set({
        key: 'value 3',
        key2: 'value 4',
      });

      const entriesSomeStoreBefore = await idb.entries();

      expect(Object.keys(entriesSomeStoreBefore)).toHaveLength(2);

      await expect(idb.clear()).resolves.toBeUndefined();

      const entriesSomeStoreAfter = await idb.entries();

      expect(Object.keys(entriesSomeStoreAfter)).toHaveLength(0);
    });
  });

  describe('Удаление хранилища', () => {
    test('Отсутствует имя хранилища', async () => {
      const errorMessage = `${errorPrefix}. The required name argument was not passed`;

      await expect(removeDBStore('')).rejects.toThrow(errorMessage);
    });

    test('Отсутствие нужного хранилища. Без объявления', async () => {
      setDBName('some-db');

      await removeDBStore('any-store');

      await expect(idb.get('key', 'any-store')).resolves.toBeUndefined();
    });

    test('Отсутствие нужного хранилища. С объявлением удаляемого', async () => {
      setDBName('some-db');
      setDBStoreName('some-store');

      await removeDBStore('some-store');

      await expect(idb.get('key')).resolves.toBeUndefined();
    });

    test('Отсутствие нужного хранилища. С объявлением иного', async () => {
      setDBName('some-db');
      setDBStoreName('some-store');

      await removeDBStore('any-store');

      await expect(idb.get('key', 'any-store')).resolves.toBeUndefined();
      await expect(idb.get('key')).resolves.toBeUndefined();
    });

    test('Наличие нужного хранилища. Без объявления', async () => {
      setDBName('some-db');

      await idb.set(
        {
          key: 'value',
          key2: 'value 2',
        },
        'any-store',
      );

      await removeDBStore('any-store');

      await expect(idb.get('key', 'any-store')).resolves.toBeUndefined();
    });

    test('Наличие нужного хранилища. С объявлением удаляемого', async () => {
      setDBName('some-db');
      setDBStoreName('some-store');

      await idb.set({
        key: 'value',
        key2: 'value 2',
      });

      await removeDBStore('some-store');

      await expect(idb.get('key')).resolves.toBeUndefined();
    });

    test('Наличие нужного хранилища. С объявлением иного', async () => {
      setDBName('some-db');
      setDBStoreName('some-store');

      await idb.set(
        {
          key: 'value',
          key2: 'value 2',
        },
        'any-store',
      );

      await removeDBStore('any-store');

      await expect(idb.get('key')).resolves.toBeUndefined();
      await expect(idb.get('key', 'any-store')).resolves.toBeUndefined();
    });
  });

  describe('Удаление базы', () => {
    test('Отсутствие открытой базы', () => {
      vi.spyOn(indexedDB, 'deleteDatabase');

      expect(global.indexedDB.deleteDatabase).toHaveBeenCalledTimes(0);

      deleteDatabase();

      expect(global.indexedDB.deleteDatabase).toHaveBeenCalledTimes(0);

      vi.restoreAllMocks();
    });

    test('Удаление существующей базы', async () => {
      vi.spyOn(indexedDB, 'deleteDatabase');

      setDBName('some-db');

      // Для открытия базы
      await idb.set(
        {
          key: 'value',
        },
        'any-store',
      );

      deleteDatabase();

      expect(global.indexedDB.deleteDatabase).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });
  });
});
