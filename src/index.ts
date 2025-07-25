let objectStoreName: string;
let DB: IDBDatabase;

const objectStoreRequest = (request: IDBRequest | IDBOpenDBRequest): Promise<any> =>
  new Promise((resolve, reject): void => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`[IndexedDB]. ${request.error?.message}`));
  });

const transactionRequest = (request: IDBTransaction): Promise<undefined> =>
  new Promise(resolve => {
    request.oncomplete = () => resolve(undefined);
  });

/**
 * Инициализация сервиса. Открытие базы данных
 * @example
 * initDatabase('any@database.name', 'any-store-name', 42).then(() => {
 *   app.mount('#app');
 * });
 */
export type Init = (dbName: string, storeName: string, version?: number) => Promise<void>;

export const initDatabase: Init = async (
  dbName: string,
  storeName: string,
  version: number = 1,
): Promise<void> => {
  if (!dbName || !storeName) {
    throw new Error('[IndexedDB]. The service has not been initialized. Set name');
  }

  objectStoreName = storeName;

  const DBOpenRequest: IDBOpenDBRequest = window.indexedDB.open(dbName, version);

  DBOpenRequest.onupgradeneeded = (): void => {
    DBOpenRequest.result.createObjectStore(objectStoreName);
  };

  try {
    DB = await objectStoreRequest(DBOpenRequest);
  } catch (error: any) {
    throw new Error(error?.message);
  }
};

/** Закрытие и удаление базы данных */
export const deleteDatabase = (): void => {
  if (!DB) {
    return;
  }

  const { name } = DB;

  DB.close();

  window.indexedDB.deleteDatabase(name);
};

/** Проверка инициализации базы данных */
const checkDB = (): void => {
  if (!DB) {
    throw new Error(
      '[IndexedDB]. The service has not been initialized. Run initDatabase(<DBName>, <StoreName>)',
    );
  }
};

/** Рекурсивное (глубокое) копирование объекта (массива) */
const deepClone = (sourceObject: any): any => {
  if (!sourceObject || typeof sourceObject !== 'object') {
    return sourceObject;
  } else if (sourceObject instanceof Date) {
    return new Date(sourceObject);
  }

  const clone: any[] | Record<string, any> = Array.isArray(sourceObject)
    ? [].concat(<[]>sourceObject)
    : { ...(<{}>sourceObject) };

  Object.keys(clone).forEach((key: string | number): void => {
    const value: any = sourceObject[key];

    // @ts-ignore
    clone[key] = typeof value === 'object' ? deepClone(value) : value;
  });

  return clone;
};

/** Служба для управления локальным хранилищем IndexedDB */
export type IDBMethods = {
  /**
   * Получение одного или нескольких значений по ключам из хранилища IndexedDB.
   * @example
   * const token = await idb.get('token'); // value
   * const anyValues = await idb.get(['token', 'user', 'phone']); // [value1, value2, value3]
   */
  readonly get: (keys: string | string[]) => Promise<any>;
  /**
   * Добавление одного или нескольких значений по ключам в хранилище IndexedDB
   * @example
   * await idb.set({
   *   token: '<new Token>',
   *   user: { id: 42 },
   *   phone: 79991234567,
   * });
   */
  readonly set: (pairs: Record<string, unknown>) => Promise<undefined>;
  /**
   * Обновление значения по ключу в хранилище IndexedDB
   * @example
   * const callback = value => (value || 0) + 1;
   *
   * await idb.update('number', callback);
   */
  readonly update: (key: string, callback: (value: any) => any) => Promise<undefined>;
  /**
   * Удаление одного или нескольких ключей в хранилище IndexedDB
   * @example
   * await idb.delete('token');
   * await idb.delete(['token', 'user', 'phone']);
   */
  readonly delete: (keys: string | string[]) => Promise<undefined>;
  /** Очистка всех значений в хранилище IndexedDB */
  readonly clear: () => Promise<undefined>;
  /**
   * Получение списка всех ключей из хранилища IndexedDB
   * @example
   * const allKeys = await idb.keys(); // [key1, key2, key3]
   */
  readonly keys: () => Promise<IDBValidKey[]>;
  /**
   * Получение списка всех значений из хранилища IndexedDB
   * @example
   * const allValues = await idb.values(); // [value1, value2, value3]
   */
  readonly values: () => Promise<any[]>;
  /**
   * Получение объекта со всеми ключами и значениями из хранилища IndexedDB
   * @example
   * const entries = await idb.entries();
   *
   * // {
   * //   key1: 'value1',
   * //   key2: 'value2',
   * //   key3: 'value3',
   * // }
   */
  readonly entries: () => Promise<Record<string, any>>;
};

export const idb: Readonly<IDBMethods> = Object.freeze({
  get(keys: string | string[]): Promise<any> {
    checkDB();

    const store: IDBObjectStore = DB.transaction(objectStoreName, 'readonly').objectStore(
      objectStoreName,
    );

    if (Array.isArray(keys)) {
      return Promise.all(keys.map((key: IDBValidKey) => objectStoreRequest(store.get(key))));
    }

    return objectStoreRequest(store.get(keys));
  },
  set(pairs: Record<string, unknown>): Promise<undefined> {
    const invalid: boolean = [
      !pairs,
      typeof pairs !== 'object',
      pairs?.constructor?.name !== 'Object',
      !Object.keys(pairs).length,
    ].some(Boolean);

    if (invalid) {
      throw new Error('[IndexedDB]. SET. Wrong params type');
    }

    checkDB();

    const store: IDBObjectStore = DB.transaction(objectStoreName, 'readwrite').objectStore(
      objectStoreName,
    );

    const entries: Array<[string, unknown]> = Object.entries(pairs);

    entries.forEach(([key, value]): void => {
      let storeValue = value;

      if (typeof value === 'object') {
        storeValue = deepClone(value);
      }

      store.put(storeValue, key);
    });

    return transactionRequest(store.transaction);
  },
  async update(key: string, callback: (value: any) => any): Promise<undefined> {
    checkDB();

    const store: IDBObjectStore = DB.transaction(objectStoreName, 'readwrite').objectStore(
      objectStoreName,
    );

    const storeValue = await objectStoreRequest(store.get(key));

    let updatedValue = callback(storeValue);

    if (typeof updatedValue === 'object') {
      updatedValue = deepClone(updatedValue);
    }

    store.put(updatedValue, key);

    return transactionRequest(store.transaction);
  },
  delete(keys: string | string[]): Promise<undefined> {
    checkDB();

    const store: IDBObjectStore = DB.transaction(objectStoreName, 'readwrite').objectStore(
      objectStoreName,
    );

    if (Array.isArray(keys)) {
      keys.forEach((key: IDBValidKey) => store.delete(key));
    } else {
      store.delete(keys);
    }

    return transactionRequest(store.transaction);
  },
  clear(): Promise<undefined> {
    checkDB();

    const store: IDBObjectStore = DB.transaction(objectStoreName, 'readwrite').objectStore(
      objectStoreName,
    );

    store.clear();

    return transactionRequest(store.transaction);
  },
  keys(): Promise<IDBValidKey[]> {
    checkDB();

    const store: IDBObjectStore = DB.transaction(objectStoreName, 'readonly').objectStore(
      objectStoreName,
    );

    return objectStoreRequest(store.getAllKeys());
  },
  values(): Promise<any[]> {
    checkDB();

    const store: IDBObjectStore = DB.transaction(objectStoreName, 'readonly').objectStore(
      objectStoreName,
    );

    return objectStoreRequest(store.getAll());
  },
  async entries(): Promise<Record<string, any>> {
    checkDB();

    const store: IDBObjectStore = DB.transaction(objectStoreName, 'readonly').objectStore(
      objectStoreName,
    );

    const entries: Record<string, any> = {};

    const keys: string[] = await objectStoreRequest(store.getAllKeys());
    const values: any[] = await objectStoreRequest(store.getAll());

    keys.forEach((key: string, index: number): void => {
      entries[key] = values.at(index);
    });

    return entries;
  },
});
