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

import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  Firestore,
  getFirestore,
  initializeFirestore
} from 'firebase/firestore';

import { log } from './logging.js';
import { base64Encode, calculateHash, utf8Encode } from './platform.js';
import { Settings } from './settings.js';
import {
  FirestoreHost,
  hostNameFromHost,
  isPlaceholderValue,
  PlaceholderProjectIdNotAllowedError
} from './util.js';

class FirebaseObjectCacheKey {
  constructor(
    readonly host: FirestoreHost,
    readonly projectId: string,
    readonly apiKey: string,
    readonly instanceId: number | null
  ) {}

  get hostName(): string {
    return hostNameFromHost(this.host);
  }

  get displayString(): string {
    return (
      `host=${this.hostName} (${this.host}), ` +
      `projectId=${this.projectId}, apiKey=${this.apiKey}, ` +
      `appName=${this.appName}`
    );
  }

  get appName(): string {
    const encodedValue = utf8Encode(this.canonicalStringWithoutInstanceId);
    const encodedValueHash = calculateHash(encodedValue);
    const encodedValueHashBinaryString = encodedValueHash
      .map(n => String.fromCharCode(n))
      .join('');
    const encodedValueHashBase64 = base64Encode(encodedValueHashBinaryString);

    // Remove the trailing `=` characters from the base64 string, since they are
    // just noise and not valid as a Firebase "app name".
    const encodedValueHashBase64Clean = Array.from(encodedValueHashBase64)
      .filter(c => c !== '=')
      .join('');

    return (
      encodedValueHashBase64Clean +
      (this.instanceId === null ? '' : `-${this.instanceId}`)
    );
  }

  get canonicalString(): string {
    return (
      this.canonicalStringWithoutInstanceId +
      (this.instanceId === null ? '' : `%${this.instanceId}`)
    );
  }

  get canonicalStringWithoutInstanceId(): string {
    return `${this.host}%${this.projectId}%${this.apiKey}`;
  }
}

class FirebaseAppCacheEntry extends FirebaseObjectCacheKey {
  constructor(
    readonly app: FirebaseApp,
    key: FirebaseObjectCacheKey
  ) {
    super(key.host, key.projectId, key.apiKey, key.instanceId);
  }
}

class FirestoreCacheEntry extends FirebaseObjectCacheKey {
  constructor(
    readonly db: Firestore,
    key: FirebaseObjectCacheKey,
    readonly ssl: boolean
  ) {
    super(key.host, key.projectId, key.apiKey, key.instanceId);
  }

  toFirestoreInfo(): FirestoreInfo {
    return {
      db: this.db,
      appName: this.appName,
      projectId: this.projectId,
      apiKey: this.apiKey,
      host: this.host,
      hostName: this.hostName,
      ssl: this.ssl
    };
  }
}

class FirebaseObjectCache<T> {
  private readonly cachedObjectsByKey = new Map<string, T>();

  get(key: FirebaseObjectCacheKey): T | null {
    return this.cachedObjectsByKey.get(key.canonicalString) ?? null;
  }

  set(key: FirebaseObjectCacheKey, value: T): void {
    const keyString = key.canonicalString;
    if (this.cachedObjectsByKey.has(keyString)) {
      throw new Error(`Entry for ${keyString} already exists`);
    }
    this.cachedObjectsByKey.set(keyString, value);
  }
}

const firebaseAppCache = new FirebaseObjectCache<FirebaseAppCacheEntry>();
const firestoreInstanceCache = new FirebaseObjectCache<FirestoreCacheEntry>();

export interface FirestoreInfo {
  readonly db: Firestore;
  readonly appName: string;
  readonly projectId: string;
  readonly apiKey: string;
  readonly host: FirestoreHost;
  readonly hostName: string;
  readonly ssl: boolean;
}

/**
 * Create the `Firestore` object and return it.
 */
function getOrCreateFirestore(
  settings: Settings,
  instanceId?: number
): FirestoreInfo {
  const host = settings.host.value;
  const hostName = settings.host.hostName;
  const projectId = settings.projectId.value;
  const apiKey = settings.apiKey.value;
  const cacheKey = new FirebaseObjectCacheKey(
    host,
    projectId,
    apiKey,
    instanceId ?? null
  );

  // Verify that the Project ID is set to something other than the default if
  // the Firestore emulator is not being used. The default Project ID works with
  // the emulator, but will cause strange errors if used against prod.
  if (host !== 'emulator' && isPlaceholderValue(projectId)) {
    throw new PlaceholderProjectIdNotAllowedError(
      'The Project ID needs to be set in firebase_config.ts, or in the ' +
        'Settings, unless using the Firestore emulator.'
    );
  }

  // Set the requested debug log level, if it has never been set before.
  if (!settings.debugLogEnabled.isApplied) {
    settings.debugLogEnabled.apply();
  }

  // Use a previously-cached Firestore instance, if available.
  const cachedDb = firestoreInstanceCache.get(cacheKey);
  if (cachedDb !== null) {
    log(`Using existing Firestore instance with ${cachedDb.displayString}`);
    return cachedDb.toFirestoreInfo();
  }

  const cachedApp = firebaseAppCache.get(cacheKey);
  const appName = cacheKey.appName;
  let app: FirebaseApp;
  if (cachedApp !== null) {
    log(`Using existing FirebaseApp instance for ${cachedApp.displayString}`);
    app = cachedApp.app;
  } else {
    log(
      `initializeApp() with projectId=${projectId}, apiKey=${apiKey}, ` +
        `appName=${appName}`
    );
    app = initializeApp({ projectId, apiKey }, appName);
    firebaseAppCache.set(cacheKey, new FirebaseAppCacheEntry(app, cacheKey));
  }

  let db: Firestore;
  if (host === 'prod' || host === 'emulator') {
    log(`getFirestore() for ${cacheKey.displayString}`);
    db = getFirestore(app);
  } else {
    log(`initializeFirestore() with host=${hostName} (${host})`);
    db = initializeFirestore(app, { host: hostName });
  }

  let ssl: boolean;
  if (host !== 'emulator') {
    ssl = true;
  } else {
    ssl = false;
    log(`connectFirestoreEmulator(db, ${hostName}, 8080)`);
    connectFirestoreEmulator(db, hostName, 8080);
  }

  const firestoreCacheEntry = new FirestoreCacheEntry(db, cacheKey, ssl);
  firestoreInstanceCache.set(cacheKey, firestoreCacheEntry);
  return firestoreCacheEntry.toFirestoreInfo();
}

export { getOrCreateFirestore as getFirestore };
