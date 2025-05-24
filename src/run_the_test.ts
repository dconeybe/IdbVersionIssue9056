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

import {
  collection,
  CollectionReference,
  deleteDoc,
  disableNetwork,
  doc,
  DocumentReference,
  DocumentSnapshot,
  enableIndexedDbPersistence,
  enableNetwork,
  Firestore,
  getDoc,
  getDocs,
  onSnapshot,
  Query,
  query,
  QuerySnapshot,
  runTransaction,
  setDoc,
  where,
  writeBatch
} from 'firebase/firestore';

import { log } from './common/logging.js';
import { Random } from './common/random.js';
import { TestEnvironment } from './common/test_environment.js';
import {
  createDocument,
  createDocuments,
  createEmptyCollection,
  Deferred,
  generateValue,
  SnapshotListener
} from './common/util.js';

/**
 * Runs the test.
 *
 * Replace the body of this function with the code you would like to execute
 * when the user clicks the "Run Test" button in the UI.
 *
 * @param db the `Firestore` instance to use.
 * @param env extra information about the given Firestore instance and some
 * helper methods.
 */
export async function runTheTest(
  db: Firestore,
  env: TestEnvironment
): Promise<void> {
  // Create a test document.
  const collectionRef = createEmptyCollection(db, 'web-demo-');
  const documentRef = await createDocument(collectionRef, 'TestDoc', {
    foo: generateValue()
  });
  env.cancellationToken.throwIfCancelled();

  // Register a snapshot listener for the test document.
  log(`onSnapshot(${documentRef.path})`);
  const snapshotListener = new SnapshotListener<DocumentSnapshot>(
    env.cancellationToken
  );
  const unsubscribe = onSnapshot(
    documentRef,
    { includeMetadataChanges: true },
    snapshotListener.observer
  );
  env.cancellationToken.onCancelled(unsubscribe);

  // Wait for a snapshot of the test document from the server.
  {
    const waitOptions = {
      fromCache: false,
      hasPendingWrites: false
    };
    log(`waitForSnapshot(${JSON.stringify(waitOptions)})`);
    const snapshot = await snapshotListener.waitForSnapshot(waitOptions);
    log(`Got document ${snapshot.id}: ${JSON.stringify(snapshot.data())}`);
    env.cancellationToken.throwIfCancelled();
  }

  // Modify the test document
  {
    const dataToSet = { bar: generateValue() };
    log(`setDoc(${documentRef.id}, ${JSON.stringify(dataToSet)})`);
    await setDoc(documentRef, dataToSet);
    env.cancellationToken.throwIfCancelled();
  }

  // Wait for a snapshot of the test document with the pending writes.
  {
    const waitOptions = {
      hasPendingWrites: true
    };
    log(`waitForSnapshot(${JSON.stringify(waitOptions)})`);
    const snapshot = await snapshotListener.waitForSnapshot(waitOptions);
    log(`Got document ${snapshot.id}: ${JSON.stringify(snapshot.data())}`);
    env.cancellationToken.throwIfCancelled();
  }

  // Wait for a snapshot of the test document from the server.
  {
    const waitOptions = {
      fromCache: false,
      hasPendingWrites: false
    };
    log(`waitForSnapshot(${JSON.stringify(waitOptions)})`);
    const snapshot = await snapshotListener.waitForSnapshot(waitOptions);
    log(`Got document ${snapshot.id}: ${JSON.stringify(snapshot.data())}`);
    env.cancellationToken.throwIfCancelled();
  }
}
