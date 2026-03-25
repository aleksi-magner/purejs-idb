let dbName: string = '';
let storeCurrentName: string = '';
let storeDeletableName: string = '';
let dbVersion: number | undefined;
let DB: IDBDatabase | null = null;

const errorPrefix = '[IndexedDB]';

/** Закрытие базы данных. После закрытия обращение к базе будет недоступно */
const closeBD = (): void => {
  if (!DB) {
    return;
  }

  DB.close();

  DB = null;
};

/**
 * Открытие базы данных и текущего хранилища
 * @param {string} storeName - Имя хранилища
 */
const openBD = async (storeName: string = storeCurrentName): Promise<void> => {
  // Закрываем предыдущую БД, если такая была
  closeBD();

  // Проверяем наличие имени БД
  if (!dbName) {
    throw new Error(`Database name not set. Run ${setDBName.name}(DBName)`);
  }

  try {
    // Если версия не известна, устанавливаем её
    if (!dbVersion) {
      const databases: IDBDatabaseInfo[] = await globalThis.indexedDB.databases();

      // Проверяем наличие ранее созданной БД с переданным именем
      const existDB: IDBDatabaseInfo | undefined = databases.find(db => db.name === dbName);

      // Если есть ранее созданная БД, берём её версию или начинаем с 1
      setDBVersion(existDB?.version ?? 1);
    }

    await new Promise((resolve, reject): void => {
      const DBOpenRequest: IDBOpenDBRequest = globalThis.indexedDB.open(dbName, dbVersion);

      // Ошибка при открытии БД
      DBOpenRequest.onerror = (): void => {
        reject(new Error(DBOpenRequest.error?.message));
      };

      // БД открыта
      DBOpenRequest.onsuccess = async (): Promise<void> => {
        DB = DBOpenRequest.result;

        // Если в текущей БД нет нужного хранилища, повышаем версию
        if (
          storeName &&
          storeName !== storeDeletableName &&
          !DB.objectStoreNames.contains(storeName)
        ) {
          setDBVersion(DB.version + 1);

          // Переоткрываем БД с новой версией
          await openBD(storeName);
        }

        storeDeletableName = '';

        resolve(undefined);
      };

      // Создание нового хранилища и изменении версии существующей БД
      DBOpenRequest.onupgradeneeded = (): void => {
        DB = DBOpenRequest.result;

        // Создаём хранилище объектов
        if (
          storeName &&
          storeName !== storeDeletableName &&
          !DB.objectStoreNames.contains(storeName)
        ) {
          DB.createObjectStore(storeName);
        }

        // Удаляем хранилище объектов
        if (storeDeletableName && DB.objectStoreNames.contains(storeDeletableName)) {
          DB.deleteObjectStore(storeDeletableName);
        }
      };
    });
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

  closeBD();

  globalThis.indexedDB.deleteDatabase(name);
};

/**
 * Установка имени базы данных
 * @param {string} name - Имя БД
 */
export const setDBName = (name: string): void => {
  // База с таким именем уже открыта
  if (DB?.name === name) {
    return;
  }

  // Если есть открытая база с другим именем, закрываем её
  closeBD();

  // Сбрасываем номер версии, чтобы не открыть с ним новую базу
  setDBVersion(undefined);

  // Устанавливаем имя текущей базы данных
  dbName = name;
};

/**
 * Установка имени хранилища по умолчанию
 * @param {string} name - Имя хранилища
 */
export const setDBStoreName = (name: string): void => {
  storeCurrentName = name;
};

/**
 * Установка текущей версии базы данных
 * @param {number} [version] - Номер версии
 */
const setDBVersion = (version: number | undefined): void => {
  dbVersion = version;
};

/**
 * Проверка инициализации базы данных
 * @param {string} storeName - Имя хранилища
 */
const checkDB = async (storeName: string = storeCurrentName): Promise<void> => {
  if (DB?.objectStoreNames?.contains(storeName)) {
    return;
  }

  try {
    // Если БД нет, открываем её
    await openBD(storeName);
  } catch (error: any) {
    const message = [errorPrefix, error?.message].join('. ');

    throw new Error(message);
  }
};

/**
 * Удаление хранилища
 * @param {string} name - Имя удаляемого хранилища. Передавать явно
 */
export const removeDBStore = async (name: string): Promise<void> => {
  if (!name) {
    const message = [errorPrefix, 'The required name argument was not passed'].join('. ');

    throw new Error(message);
  }

  // Установить имя удаляемого хранилища
  storeDeletableName = name;

  // Проверяем наличие открытой базы
  await checkDB(storeDeletableName);

  // Проверяем наличие в текущей базе переданного имени
  if (!(DB as IDBDatabase).objectStoreNames.contains(storeDeletableName)) {
    storeDeletableName = '';

    return;
  }

  // Увеличить номер версии
  setDBVersion((DB as IDBDatabase).version + 1);

  // Переоткрываем БД с новой версией
  await openBD(storeDeletableName);
};

/** Рекурсивное (глубокое) копирование объекта / массива */
const deepClone = (sourceObject: any): any => {
  if (!sourceObject || typeof sourceObject !== 'object') {
    return sourceObject;
  } else if (sourceObject instanceof Date) {
    return new Date(sourceObject);
  }

  const clone: any[] | Record<string, any> = Array.isArray(sourceObject)
    ? [...(sourceObject as [])]
    : { ...(sourceObject as {}) };

  Object.keys(clone).forEach((key: string | number): void => {
    const value: any = sourceObject[key];

    // @ts-ignore
    clone[key] = typeof value === 'object' ? deepClone(value) : value;
  });

  return clone;
};

const objectStoreRequest = (request: IDBRequest): Promise<any> =>
  new Promise((resolve, reject): void => {
    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      const message = [errorPrefix, request.error?.message].join('. ');

      reject(new Error(message));
    };
  });

const transactionRequest = (request: IDBTransaction): Promise<undefined> =>
  new Promise(resolve => {
    request.oncomplete = () => {
      resolve(undefined);
    };
  });

/** Служба для управления локальным хранилищем IndexedDB */
export type IDBMethods = {
  /**
   * Добавление одного или нескольких значений по ключам в хранилище IndexedDB
   * @example
   * await idb.set({
   *   token: '<new Token>',
   *   user: { id: 42 },
   *   phone: 79991234567,
   * });
   *
   * await idb.set({ key: 'value' }, 'store-name');
   */
  readonly set: (pairs: Record<string, unknown>, storeName?: string) => Promise<undefined>;
  /**
   * Получение одного или нескольких значений по ключам из хранилища IndexedDB.
   * @example
   * const token = await idb.get('token'); // value
   * const token2 = await idb.get('token', 'store-name'); // value2
   * const anyValues = await idb.get(['token', 'user', 'phone']); // [value1, value2, value3]
   */
  readonly get: (keys: string | string[], storeName?: string) => Promise<any>;
  /**
   * Обновление значения по ключу в хранилище IndexedDB
   * @example
   * const callback = value => (value || 0) + 1;
   *
   * await idb.update('number', callback);
   * await idb.update('number', callback, 'store-name');
   */
  readonly update: (
    key: string,
    callback: (value: any) => any,
    storeName?: string,
  ) => Promise<undefined>;
  /**
   * Удаление одного или нескольких ключей в хранилище IndexedDB
   * @example
   * await idb.delete('token');
   * await idb.delete('token', 'store-name');
   * await idb.delete(['token', 'user', 'phone']);
   */
  readonly delete: (keys: string | string[], storeName?: string) => Promise<undefined>;
  /**
   * Получение объекта со всеми ключами и значениями из хранилища IndexedDB
   * @example
   * const entries = await idb.entries();
   * const entries = await idb.entries('store-name');
   *
   * // {
   * //   key1: 'value1',
   * //   key2: 'value2',
   * //   key3: 'value3',
   * // }
   */
  readonly entries: (storeName?: string) => Promise<Record<string, any>>;
  /**
   * Очистка всех значений в хранилище IndexedDB
   * @example
   * await idb.clear(); // Текущее установленное хранилище
   * await idb.clear('store-name'); // Указанное хранилище
   */
  readonly clear: (storeName?: string) => Promise<undefined>;
};

export const idb: Readonly<IDBMethods> = Object.freeze({
  async set(
    pairs: Record<string, unknown>,
    storeName: string = storeCurrentName,
  ): Promise<undefined> {
    const invalid: boolean =
      [!pairs, typeof pairs !== 'object', pairs?.constructor?.name !== 'Object'].some(Boolean) ||
      !Object.keys(pairs).length;

    if (invalid) {
      const message = [errorPrefix, 'SET. Wrong params type'].join('. ');

      throw new Error(message);
    }

    await checkDB(storeName);

    const store: IDBObjectStore = (DB as IDBDatabase)
      .transaction(storeName, 'readwrite')
      .objectStore(storeName);

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
  async get(keys: string | string[], storeName: string = storeCurrentName): Promise<any> {
    await checkDB(storeName);

    const store: IDBObjectStore = (DB as IDBDatabase)
      .transaction(storeName, 'readonly')
      .objectStore(storeName);

    if (Array.isArray(keys)) {
      return Promise.all(keys.map((key: IDBValidKey) => objectStoreRequest(store.get(key))));
    }

    return objectStoreRequest(store.get(keys));
  },
  async update(
    key: string,
    callback: (value: any) => any,
    storeName: string = storeCurrentName,
  ): Promise<undefined> {
    await checkDB(storeName);

    const store: IDBObjectStore = (DB as IDBDatabase)
      .transaction(storeName, 'readwrite')
      .objectStore(storeName);

    const storeValue = await objectStoreRequest(store.get(key));

    const callbackFunction = callback || (() => storeValue);

    let updatedValue = callbackFunction(storeValue);

    if (typeof updatedValue === 'object') {
      updatedValue = deepClone(updatedValue);
    }

    store.put(updatedValue, key);

    return transactionRequest(store.transaction);
  },
  async delete(keys: string | string[], storeName: string = storeCurrentName): Promise<undefined> {
    await checkDB(storeName);

    const store: IDBObjectStore = (DB as IDBDatabase)
      .transaction(storeName, 'readwrite')
      .objectStore(storeName);

    if (Array.isArray(keys)) {
      keys.forEach((key: IDBValidKey) => store.delete(key));
    } else {
      store.delete(keys);
    }

    return transactionRequest(store.transaction);
  },
  async entries(storeName: string = storeCurrentName): Promise<Record<string, any>> {
    await checkDB(storeName);

    const store: IDBObjectStore = (DB as IDBDatabase)
      .transaction(storeName, 'readonly')
      .objectStore(storeName);

    const entries: Record<string, any> = {};

    const keys: string[] = await objectStoreRequest(store.getAllKeys());
    const values: any[] = await objectStoreRequest(store.getAll());

    keys.forEach((key: string, index: number): void => {
      entries[key] = values.at(index);
    });

    return entries;
  },
  async clear(storeName: string = storeCurrentName): Promise<undefined> {
    await checkDB(storeName);

    const store: IDBObjectStore = (DB as IDBDatabase)
      .transaction(storeName, 'readwrite')
      .objectStore(storeName);

    store.clear();

    return transactionRequest(store.transaction);
  },
});
