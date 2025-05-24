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

import { Deferred } from './util.js';

/**
 * A symbol whose value in `CancellationToken` is the method to cancel it.
 *
 * Using a symbol, rather than a normal string, has the advantage that it is
 * "impossible" to accidentally invoke the `cancel()` method, as that should
 * only be done by the owning `CancellationTokenSource`.
 */
const CANCELLATION_TOKEN_CANCEL = Symbol('CancellationToken.cancel()');

/**
 * A symbol whose value in `CancellationToken` is a static method to create a
 * new instance.
 */
const CANCELLATION_TOKEN_CREATE = Symbol('CancellationToken.create()');

/** The exception indicating that a `CancellationToken` has been cancelled. */
export class CancellationTokenCancelledError extends Error {
  override readonly name = 'CancellationTokenCancelledError';
}

/**
 * A token that is notified when an operation is requested to be cancelled.
 *
 * Instances should not be created directly; rather,
 */
export class CancellationToken {
  private _cancelled = false;
  private readonly _onCancelledCallbacks = new Map<symbol, () => void>();
  private readonly _onCancelledDeferred = new Deferred<void>();

  private constructor() {}

  /** Whether this operation has been cancelled. */
  get cancelled(): boolean {
    return this._cancelled;
  }

  /** A promise that is resolved when this operation is cancelled. */
  get promise(): Promise<void> {
    return this._onCancelledDeferred.promise;
  }

  /** Throws `CancellationTokenCancelledError` if `this.cancelled`. */
  throwIfCancelled(): void {
    if (this._cancelled) {
      throw new CancellationTokenCancelledError('operation cancelled');
    }
  }

  /**
   * Registers a callback to be notified upon cancellation.
   *
   * If already cancelled, then the callback is invoked synchronously by this
   * method's implementation. Otherwise, it will be called back at a later time,
   * if and when cancellation occurs.
   *
   * @param callback the callback to register.
   * @return A function that can be called to unregister the callback.
   */
  onCancelled(callback: () => void): () => void {
    if (this._cancelled) {
      callback();
      return () => {};
    }

    const callbackId = Symbol();
    this._onCancelledCallbacks.set(callbackId, callback);

    return () => {
      this._onCancelledCallbacks.delete(callbackId);
    };
  }

  /**
   * Registers a `Deferred` to be rejected if and when this object is cancelled.
   *
   * This is merely a convenience method that uses `this.onCancelled()` to
   * register an invocation of the given deferred object's `reject()` method.
   *
   * @param deferred The deferred to register.
   * @param message The message for the error; if undefined, then a default
   * message will be provided.
   * @return A function that can be called to unregister the `Deferred`.
   */
  registerDeferred<T>(deferred: Deferred<T>, message?: string): () => void {
    return this.onCancelled(() =>
      deferred.reject(
        new CancellationTokenCancelledError(message ?? 'operation cancelled')
      )
    );
  }

  // private, only to be used by CancellationTokenSource.
  [CANCELLATION_TOKEN_CANCEL]() {
    this._cancelled = true;
    this._onCancelledDeferred.resolve();
    this._onCancelledCallbacks.forEach(callback => {
      callback();
    });
  }

  // private, only to be used by CancellationTokenSource.
  static [CANCELLATION_TOKEN_CREATE](): CancellationToken {
    return new CancellationToken();
  }
}

/**
 * A source that manages a `CancellationToken`.
 */
export class CancellationTokenSource {
  readonly cancellationToken: CancellationToken;

  constructor() {
    this.cancellationToken = CancellationToken[CANCELLATION_TOKEN_CREATE]();
  }

  cancel(): void {
    this.cancellationToken[CANCELLATION_TOKEN_CANCEL]();
  }
}
