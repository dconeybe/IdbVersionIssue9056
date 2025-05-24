/**
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { log } from './common/logging.js';
import { generateValue } from './common/util.js';

// The version to specify to indexedDB.open().
const IDB_VERSION = 66;

export async function runTheTest(abortPromise: Promise<void>): Promise<void> {
  const idb = await openDb(IDB_VERSION);
  await abortPromise;
  await idb.close();
}

function openDb(version: number): Promise<IndexedDbWrapper> {
  const id = `idbw${generateValue()}`;

  return new Promise((resolve, reject) => {
    log(`sxhy49e7qb openDbRequest[${id}] started with version=${version}`);
    const openDbRequest = window.indexedDB.open('f6b48yt8wc', version);

    openDbRequest.addEventListener('error', event => {
      const openDbRequest = idbOpenDBRequestFromEvent(event);
      const error = openDbRequest.error!;
      log(
        `k74vkcrnnr openDbRequest[${id}] error: ${error.name}: ${error.message}`
      );
      reject(error);
    });

    openDbRequest.addEventListener('success', event => {
      const openDbRequest = idbOpenDBRequestFromEvent(event);
      const db = openDbRequest.result;
      log(`ynpdpnrz6y openDbRequest[${id}] success: db.name=${db.name}`);
      resolve(new IndexedDbWrapper(id, db));
    });

    openDbRequest.addEventListener('blocked', event => {
      const data = blockedDataFromIDBVersionChangeEvent(event);
      log(`kyr8jcsk7q openDbRequest[${id}] blocked: ${JSON.stringify(data)}`);
    });

    openDbRequest.addEventListener('upgradeneeded', event => {
      const data = upgradeNeededDataFromIDBVersionChangeEvent(event);
      log(
        `qj3shx3hth openDbRequest[${id}] upgradeneeded: ${JSON.stringify(data)}`
      );
      const openDbRequest = idbOpenDBRequestFromEvent(event);
      const db = openDbRequest.result;
      db.createObjectStore(`ost6hhg47t_${db.version}`);
    });
  });
}

function upgradeNeededDataFromIDBVersionChangeEvent(
  event: IDBVersionChangeEvent
) {
  const baseData = blockedDataFromIDBVersionChangeEvent(event);
  const openDbRequest = idbOpenDBRequestFromEvent(event);
  const db = openDbRequest.result;
  return { ...baseData, 'db.version': db.version };
}

function blockedDataFromIDBVersionChangeEvent(event: IDBVersionChangeEvent) {
  const { oldVersion, newVersion } = event;
  return { oldVersion, newVersion };
}

class IndexedDbWrapper {
  #id: string;
  #state: IndexedDbWrapperState;

  constructor(id: string, db: IDBDatabase) {
    this.#id = id;
    this.#state = new IndexedDbWrapperOpenedState(db);

    db.addEventListener('error', event => {
      log(`dyqggzenem IDBDatabase[${id}] error: ${JSON.stringify(event)}`);
    });
    db.addEventListener('close', event => {
      log(`acagpcy87g IDBDatabase[${id}] close: ${JSON.stringify(event)}`);
    });
    db.addEventListener('abort', event => {
      log(`kf999sz8h7 IDBDatabase[${id}] abort: ${JSON.stringify(event)}`);
    });
    db.addEventListener('versionchange', event => {
      const { oldVersion, newVersion } = event;
      const data = { oldVersion, newVersion };
      log(
        `nwdzxfa2n3 IDBDatabase[${id}] versionchange: ${JSON.stringify(data)}`
      );
    });
  }

  async close(): Promise<void> {
    if (this.#state.name === 'closed') {
      return;
    }
    const id = this.#id;
    const db = this.#state.db;
    const initialDbVersion = this.#state.initialDbVersion;

    log(`wesbcqqzre IDBDatabase[${id}] close() starting`);

    await new Promise<void>(resolve => {
      const transaction = db.transaction(`ost6hhg47t_${initialDbVersion}`);
      transaction.addEventListener('abort', () => {
        log(`x6n2sjwrx3 IDBDatabase[${id}] close transaction abort`);
        resolve();
      });
      transaction.addEventListener('complete', () => {
        resolve();
      });
      transaction.addEventListener('error', () => {
        resolve();
      });
      db.close();
    });

    this.#state = new IndexedDbWrapperClosedState();

    log(`kz39y88qdq IDBDatabase[${id}] close() finished`);
  }
}

class IndexedDbWrapperOpenedState {
  readonly name = 'opened' as const;
  readonly initialDbVersion: number;
  constructor(readonly db: IDBDatabase) {
    this.initialDbVersion = db.version;
  }
}

class IndexedDbWrapperClosedState {
  readonly name = 'closed' as const;
}

type IndexedDbWrapperState =
  | IndexedDbWrapperOpenedState
  | IndexedDbWrapperClosedState;

function idbOpenDBRequestFromEvent(event: Event): IDBOpenDBRequest {
  return event.target as IDBOpenDBRequest;
}
