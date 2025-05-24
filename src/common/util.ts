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

import {
  collection,
  CollectionReference,
  doc,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  FirestoreError,
  QuerySnapshot,
  WriteBatch,
  writeBatch
} from 'firebase/firestore';

import { CancellationToken } from './cancellation_token.js';
import { log } from './logging.js';
import { Random } from './random.js';

/**
 * Generates and returns a random-ish number.
 *
 * The returned number will be 3 digits and will increase by roughly 10 each
 * second. This makes it a useful value for a document whose field is set
 * repeatedly because the value will increase monotonically, and it is easy for
 * a human to order the values.
 */
export function generateValue(): string {
  const value = `${Math.round(Date.now() / 250)}`;
  return value.substring(value.length - 3);
}

/**
 * Formats an elapsed time into a human-friendly string.
 *
 * @param startTime the start time.
 * @param endTime the end time.
 * @returns A human-friendly string that indicates the amount of time that has
 * elapsed between the given `startTime` and `endTime`.
 */
export function formatElapsedTime(startTime: number, endTime: number): string {
  const milliseconds = endTime - startTime;
  const minutes = Math.floor(milliseconds / (1000 * 60));
  const seconds = (milliseconds - minutes * 1000 * 60) / 1000;

  const formattedSeconds = seconds.toFixed(3) + 's';
  if (minutes == 0) {
    return formattedSeconds;
  } else {
    return `${minutes}m ${formattedSeconds}`;
  }
}

/**
 * Creates and returns a new, empty collection in the given Firestore database.
 *
 * @param db the Firestore database in which to create the collection.
 * @param namePrefix a string to prepend to the name of the collection.
 * @return a newly-created, empty collection in the given Firestore database.
 */
export function createEmptyCollection(
  db: Firestore,
  namePrefix?: string
): CollectionReference {
  const collectionId = (namePrefix ?? '') + new Random().randomId();
  return collection(db, collectionId);
}

export interface DocumentSpecs {
  [docId: string]: DocumentData;
}

export type CreatedDocuments<T extends DocumentSpecs> = {
  [P in keyof T]: DocumentReference;
};

/**
 * Creates a document in the given Firestore collection.
 *
 * @param collectionRef The collection in which to create the documents.
 * @param documentId the ID (name) of the document to create.
 * @param documentData the data to populate the document with.
 * @return the `DocumentReference` of the created document.
 */
export async function createDocument(
  collectionRef: CollectionReference,
  documentId: string,
  documentData: DocumentData
): Promise<DocumentReference> {
  const createdDocuments = await createDocuments(collectionRef, {
    [documentId]: documentData
  });
  return createdDocuments[documentId]!;
}

/**
 * Creates documents in the given Firestore collection.
 *
 * @param collectionRef The collection in which to create the documents.
 * @param documentCreateCount the number of documents to create.
 * @param documentData the data with which to populate the documents; if omitted
 * or undefined, then choose some random data that will be the same in every
 * document.
 * @return the created documents, sorted by their name.
 */
export async function createDocuments(
  collectionRef: CollectionReference,
  documentCreateCount: number,
  documentData?: DocumentData
): Promise<Array<DocumentReference>>;

/**
 * Creates documents in the given Firestore collection.
 *
 * @param collectionRef The collection in which to create the documents.
 * @param documentSpecs the documents to create.
 * @return the created documents; this object will have the same keys as the
 * given `documentSpecs` object, but with the corresponding `DocumentReference`
 * of the document that was created.
 */
export async function createDocuments<T extends DocumentSpecs>(
  collectionRef: CollectionReference,
  documentSpecs: T
): Promise<CreatedDocuments<T>>;

export function createDocuments<T extends DocumentSpecs>(
  collectionRef: CollectionReference,
  documentSpecsOrDocumentCreateCount: T | number,
  documentData?: DocumentData
): Promise<CreatedDocuments<T>> | Promise<Array<DocumentReference>> {
  if (typeof documentSpecsOrDocumentCreateCount === 'number') {
    return createDocumentsFromDocumentCreateCount(
      collectionRef,
      documentSpecsOrDocumentCreateCount,
      documentData
    );
  } else {
    return createDocumentsFromDocumentSpecs(
      collectionRef,
      documentSpecsOrDocumentCreateCount
    );
  }
}

async function createDocumentsFromDocumentSpecs<T extends DocumentSpecs>(
  collectionRef: CollectionReference,
  documentSpecs: T
): Promise<CreatedDocuments<T>> {
  const createdDocuments = Object.fromEntries(
    Object.entries(documentSpecs).map(([documentId, _]) => [
      documentId,
      doc(collectionRef, documentId)
    ])
  ) as CreatedDocuments<T>;

  await performWritesInBatches(
    collectionRef.firestore,
    Object.entries(documentSpecs),
    (writeBatch_, [documentId, documentData]) => {
      const documentRef = createdDocuments[documentId]!;
      log(
        `Creating document ${documentRef.path} with contents: ${JSON.stringify(
          documentData
        )}`
      );
      writeBatch_.set(documentRef, documentData);
    }
  );

  return createdDocuments;
}

async function createDocumentsFromDocumentCreateCount(
  collectionRef: CollectionReference,
  documentCreateCount: number,
  documentData?: DocumentData
): Promise<Array<DocumentReference>> {
  const documentRefs: Array<DocumentReference> = [];
  for (let i = 0; i < documentCreateCount; i++) {
    documentRefs.push(doc(collectionRef));
  }
  documentRefs.sort((docRef1, docRef2) => docRef1.id.localeCompare(docRef2.id));

  let nextDocumentNumber = 1;

  await performWritesInBatches(
    collectionRef.firestore,
    documentRefs,
    (writeBatch_, documentRef) => {
      const documentDataForCurrentDocument = documentData ?? {
        sampleKey: 42,
        docNumber: nextDocumentNumber
      };
      nextDocumentNumber++;
      log(
        `Creating document ${documentRef.path} with contents: ${JSON.stringify(
          documentDataForCurrentDocument
        )}`
      );
      writeBatch_.set(documentRef, documentDataForCurrentDocument);
    }
  );

  return documentRefs;
}

function performWritesInBatches<T>(
  db: Firestore,
  items: Array<T>,
  callback: (writeBatch_: WriteBatch, item: T) => void
): Promise<unknown> {
  const writeBatches: Array<WriteBatch> = [];
  let writeBatch_: WriteBatch | null = null;
  let currentWriteBatchWriteCount = 0;

  for (const item of items) {
    if (writeBatch_ === null) {
      writeBatch_ = writeBatch(db);
      currentWriteBatchWriteCount = 0;
    }

    callback(writeBatch_, item);
    currentWriteBatchWriteCount++;

    if (currentWriteBatchWriteCount === 500) {
      writeBatches.push(writeBatch_);
      writeBatch_ = null;
    }
  }

  if (writeBatch_ !== null) {
    writeBatches.push(writeBatch_);
  }

  return Promise.all(writeBatches.map(batch => batch.commit()));
}

/**
 * The IDs of known Firestore hosts.
 */
export type FirestoreHost = 'prod' | 'emulator' | 'nightly' | 'qa';

/** Returns the host name for the given Firestore host. */
export function hostNameFromHost(host: FirestoreHost): string {
  switch (host) {
    case 'prod':
      return 'firestore.googleapis.com';
    case 'emulator':
      return '127.0.0.1';
    case 'nightly':
      return 'test-firestore.sandbox.googleapis.com';
    case 'qa':
      return 'staging-firestore.sandbox.googleapis.com';
  }
  throw new UnknownFirestoreHostError(host);
}

export function displayValueFromHost(hostId: FirestoreHost): string {
  const label = displayLabelFromHost(hostId);
  const hostName = hostNameFromHost(hostId);
  return `${label} (${hostName})`;
}

export function displayLabelFromHost(hostId: FirestoreHost): string {
  switch (hostId) {
    case 'prod':
      return 'Production';
    case 'emulator':
      return 'Emulator';
    case 'nightly':
      return 'Nightly';
    case 'qa':
      return 'QA';
  }
  throw new UnknownFirestoreHostError(hostId);
}

/**
 * Returns whether the given value is a "placeholder" value for `PROJECT_ID` or
 * `API_KEY` that is committed into the GitHub repository.
 *
 * This function is used to test whether these constants were modified, as
 * documented, to contain valid data.
 */
export function isPlaceholderValue(value: string): boolean {
  return value.startsWith('REPLACE_WITH_YOUR_');
}

/**
 * Exception thrown if a method is given a string that is not equal to one of
 * strings in the `FirestoreHost` union type.
 */
export class UnknownFirestoreHostError extends Error {
  override readonly name = 'UnknownFirestoreHostError';

  constructor(host: string) {
    super(`unknown host: ${host}`);
  }
}

/**
 * The exception thrown when the PROJECT_ID is not set to a valid value, but is
 * instead left with the placeholder, and a valid value is required.
 */
export class PlaceholderProjectIdNotAllowedError extends Error {
  override readonly name = 'PlaceholderProjectIdNotAllowedError';
}

/**
 * Encapsulates a `Promise` and exposes the methods to resolve and reject it.
 *
 * Example:
 *
 * ```
 * // Performs a complex mathematical calculation that takes 5 seconds
 * // to compute and returns a Promise that resolves with the result.
 * function doBigMathCalculation(): Promise<number> {
 *   const deferred = new Deferred<number>();
 *   setTimeout(() => deferred.resolve(42), 5000);
 *   return deferred.promise;
 * }
 * ```
 */
export class Deferred<T = void> {
  private readonly _promise: Promise<T>;
  private readonly _resolve: (result: T) => void;
  private readonly _reject: (error: Error) => void;

  constructor() {
    let capturedResolve: (result: T) => void;
    let capturedReject: (error: Error) => void;
    this._promise = new Promise((resolve, reject) => {
      capturedResolve = resolve;
      capturedReject = reject;
    });
    this._resolve = capturedResolve!;
    this._reject = capturedReject!;
  }

  /** The promise that is resolved or rejected by this object's methods. */
  get promise(): Promise<T> {
    return this._promise;
  }

  /** Resolves this object's Promise with the given result. */
  resolve(result: T): void {
    this._resolve(result);
  }

  /** Rejects this object's Promise with the given result. */
  reject(error: Error): void {
    this._reject(error);
  }
}

/**
 * Helper class to listen for snapshots from Firestore.
 */
export class SnapshotListener<T extends QuerySnapshot | DocumentSnapshot> {
  private readonly snapshots: T[] = [];
  private error: FirestoreError | null = null;
  private completed: boolean = false;
  private onChange: (() => void) | null = null;

  constructor(private readonly cancellationToken: CancellationToken) {}

  /**
   * Clears the internal buffer of all snapshots that have been received so far.
   */
  clear(): void {
    this.snapshots.splice(0);
  }

  /**
   * Waits for a snapshot to be received.
   */
  async waitForSnapshot(options?: WaitForSnapshotOptions): Promise<T> {
    if (this.onChange !== null) {
      throw new Error('only one call to waitForSnapshotFromServer() at a time');
    }

    while (true) {
      if (this.onChange !== null) {
        throw new Error('illegal state: this.onChange !== null');
      }

      if (this.error) {
        throw this.error;
      }
      if (this.completed) {
        throw new Error('listener is completed');
      }

      while (this.snapshots.length > 0) {
        const snapshot = this.snapshots.shift()!;

        const desiredHasPendingWrites = options?.hasPendingWrites;
        if (
          desiredHasPendingWrites !== undefined &&
          snapshot.metadata.hasPendingWrites != desiredHasPendingWrites
        ) {
          continue;
        }

        const desiredFromCache = options?.fromCache;
        if (
          desiredFromCache !== undefined &&
          snapshot.metadata.fromCache != desiredFromCache
        ) {
          continue;
        }

        return snapshot;
      }

      const deferred = new Deferred();
      const unregisterDeferred =
        this.cancellationToken.registerDeferred(deferred);

      try {
        const onChange = () => deferred.resolve();
        this.onChange = onChange;

        let onChangeInFinally: (() => void) | null;
        try {
          await deferred.promise;
        } finally {
          onChangeInFinally = this.onChange;
          this.onChange = null;
        }
        if (onChangeInFinally !== onChange) {
          throw new Error('illegal state: this.onChange !== onChange');
        }
      } finally {
        unregisterDeferred();
      }
    }
  }

  /**
   * Returns an "observer" that can be registered with onSnapshot().
   */
  get observer(): {
    next: (snapshot: T) => void;
    error: (error: FirestoreError) => void;
    complete: () => void;
  } {
    return {
      next: (snapshot: T) => {
        this.snapshots.push(snapshot);
        this.onChange?.();
      },

      error: (error: FirestoreError) => {
        this.error = error;
        this.onChange?.();
      },

      complete: () => {
        this.completed = true;
        this.onChange?.();
      }
    };
  }
}

/**
 * Options that can be specified to `SnapshotListener.waitForSnapshot()`.
 */
export interface WaitForSnapshotOptions {
  /**
   * The desired value for the snapshot's `hasPendingWrites` metadata property.
   * If not undefined, snapshots whose `hasPendingWrites` value differs from
   * the value defined here will be dropped.
   */
  hasPendingWrites?: boolean;

  /**
   * The desired value for the snapshot's `fromCache` metadata property.
   * If not undefined, snapshots whose `fromCache` value differs from the value
   * defined here will be dropped.
   */
  fromCache?: boolean;
}
