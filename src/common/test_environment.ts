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

import { Firestore } from 'firebase/firestore';

import { CancellationToken } from './cancellation_token.js';
import { FirestoreHost } from './util.js';

export interface TestEnvironment {
  /** The main Firestore instance. */
  readonly db: Firestore;

  /** A token to respond to the test being cancelled, if available. */
  readonly cancellationToken: CancellationToken;

  /** The name of the Firebase app, as specified to initializeApp(). */
  readonly appName: string;

  /** The Firebase project, as specified to initializeApp(). */
  readonly projectId: string;

  /** The API key, as specified to initializeApp(). */
  readonly apiKey: string;

  /** The Firestore host. */
  readonly host: FirestoreHost;

  /** The Firestore host name (e.g. "localhost"). */
  readonly hostName: string;

  /** Whether ssl is used when communicating with the Firestore host. */
  readonly ssl: boolean;

  /** Whether the test is running in a browser or node runtime. */
  readonly runtime: 'node' | 'browser';

  /**
   * Gets or creates a supplementary Firestore instance.
   *
   * This "supplementary" instance uses all the same properties as the main
   * Firestore instance, but is completely separate, including its persistence.
   *
   * A "supplementary" Firestore instance may be useful if you want to do
   * something to the Firestore database, such as delete a document, while the
   * main Firestore instance is offline.
   *
   * @param instanceId The ID to use for the instance; each distinct instanceId
   * will result in a distinct Firestore instance, and invoking with the same
   * instance ID as a previous invocation will return the exact same Firestore
   * instance.
   */
  getFirestore(instanceId: number): Firestore;
}
