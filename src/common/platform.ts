/**
 * Copyright 2023 Google LLC
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

/**
 * Implementations provide platform-specific implementations of the given
 * functions.
 *
 * For documentation about each function, see the free function in this module
 * with the same name.
 */
export interface Platform {
  base64Encode(data: string): string;
  calculateHash(data: Array<number> | Uint8Array | string): Array<number>;
  log(message: LogMessage): void;
  getCurrentMonotonicTimeMilliseconds(): number;
  utf8Encode(data: string): Uint8Array;
}

/**
 * The information about a message to be logged.
 */
export interface LogMessage {
  /** The text of the message to log. */
  text: string;

  /** The timestamp of the message to log, as a human-readable string. */
  timestamp: string;

  /** Optional options for the specific log function. */
  options?: unknown;
}

let gPlatform: Platform | null = null;

/**
 * Sets the platform instance for the current platform.
 *
 * This method must be called exactly once before any other function defined in
 * this module. Invoking this method more than once will throw an exception.
 * Invoking any other function in this module _before_ invoking this function
 * will also throw an exception.
 */
export function setPlatform(platform: Platform): void {
  if (gPlatform !== null) {
    throw new Error('setPlatform() has already been invoked');
  }
  gPlatform = platform;
}

/**
 * Gets the "platform" object set by `setPlatform()`, or throws an exception if
 * `setPlatform()` has never been invoked.
 */
function getPlatform(): Platform {
  if (gPlatform === null) {
    throw new Error('setPlatform() has not yet been invoked');
  }
  return gPlatform;
}

/**
 * Encodes data in base64.
 *
 * This function has the exact same semantics as the built-in `btoa()` function
 * in a web browser (https://developer.mozilla.org/en-US/docs/Web/API/btoa).
 *
 * @param data The _binary_ string to encode.
 * @return An ASCII string containing the Base64 representation of the given
 * data.
 */
export function base64Encode(data: string): string {
  return getPlatform().base64Encode(data);
}

/**
 * Calculates and returns a "hash" for the given data.
 *
 * The hashing algorithm used is undefined; however, something like MD5 would
 * suffice. The main use case for this function is to generate a stable "ID"
 * for the given data. Do *not* rely on MD5 being the hashing algorithm used.
 *
 * @param data The data to hash; if a `string`, it must be a "binary string",
 * containing only characters in the closed range [0, 255].
 * @return The hash of the given data.
 */
export function calculateHash(
  data: Array<number> | Uint8Array | string
): Array<number> {
  return getPlatform().calculateHash(data);
}

/**
 * Logs a message to the user.
 * @param message the message to log.
 */
export function log(message: LogMessage): void {
  return getPlatform().log(message);
}

/**
 * Returns the current time of a monotonic clock.
 * @return the current time of a monotonic clock, in milliseconds.
 */
export function getCurrentMonotonicTimeMilliseconds(): number {
  return getPlatform().getCurrentMonotonicTimeMilliseconds();
}

/**
 * Calculates the UTF-8 encoding of the given string, and returns it.
 * @param data the string to encode.
 * @return the UTF-8 encoding of the given string.
 */
export function utf8Encode(data: string): Uint8Array {
  return getPlatform().utf8Encode(data);
}
