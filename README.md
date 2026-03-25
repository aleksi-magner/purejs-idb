# Служба для управления локальным хранилищем IndexedDB.

## Установка

```shell
npm i purejs-idb
```

или

```shell
yarn add purejs-idb
```

## Использование

### Инициализация. Задаём имя базы и, при необходимости, хранилища

```javascript
import { setDBName } from 'purejs-idb';

setDBName('database.name');

// ...

await idb.set({ key: 'value' }, 'any-store-name');
```

или

```javascript
import { setDBName, setDBStoreName } from 'purejs-idb';

setDBName('database.name');
setDBStoreName('any-store-name');

// ...

await idb.set({ key: 'value' });
```

### Закрытие базы и удаление базы

```javascript
import { deleteDatabase } from 'purejs-idb';

deleteDatabase();
```

### Удаление хранилища

```javascript
import { removeDBStore } from 'purejs-idb';

removeDBStore('any-store-name');
```

### Добавление одного или нескольких значений по ключам

```javascript
import { idb } from 'purejs-idb';

await idb.set({
  token: '<new Token>',
  user: { id: 42 },
  phone: 79991234567,
});

await idb.set({ key: 'value' }, 'store-name');
```

### Получение одного или нескольких значений по ключам

```javascript
import { idb } from 'purejs-idb';

const token = await idb.get('token'); // value
const token2 = await idb.get('token', 'store-name'); // value2
const anyValues = await idb.get(['token', 'user', 'phone']); // [value1, value2, value3]
```

### Обновление значения по ключу

```javascript
import { idb } from 'purejs-idb';

const callback = value => (value || 0) + 1;

await idb.update('number', callback);
await idb.update('number', callback, 'store-name');
```

### Удаление одного или нескольких ключей

```javascript
import { idb } from 'purejs-idb';

await idb.delete('token');
await idb.delete('token', 'store-name');
await idb.delete(['token', 'user', 'phone']);
```

### Очистка всех значений

```javascript
import { idb } from 'purejs-idb';

await idb.clear();
await idb.clear('store-name');
```

### Получение объекта со всеми ключами и значениями

```javascript
import { idb } from 'purejs-idb';

const entries = await idb.entries();
const entries = await idb.entries('store-name');

// {
//   key1: 'value1',
//   key2: 'value2',
//   key3: 'value3',
// }
```

### Good Boy License

We’ve released the plugin for simple work with IndexedDB either under MIT or the Good Boy License. We invented it. Please do _whatever your mom would approve of:_

* Download
* Change
* Fork
