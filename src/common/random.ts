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

import { Alea } from './alea.js';

const RANDOM_ID_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** A pseudo-random number generator. */
export class Random {
  private readonly alea: Alea;

  /**
   * Creates a new instance of this class.
   * @param seed any object, to use to seed the random number generator; if
   * null or undefined, use `Math.random()`.
   */
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seed?: any
  ) {
    this.alea = new Alea(seed ?? Math.random());
  }

  /**
   * Returns a string of random alphanumeric characters.
   * @param length the length of the string to return; if undefined, use 20.
   * @return a string of randomly-generated alphanumeric characters with the
   * given, or inferred, length.
   */
  randomId(length?: number): string {
    if (length !== undefined && length < 0) {
      throw new Error(`invalid length: ${length}`);
    }
    const resultLength = length ?? 20;

    let result = '';
    for (let i = 0; i < resultLength; i++) {
      const index = Math.floor(this.alea.next() * RANDOM_ID_ALPHABET.length);
      result += RANDOM_ID_ALPHABET[index];
    }
    return result;
  }

  /**
   * Returns strings of random alphanumeric characters.
   * @param count the number of strings to return.
   * @param length the length of the strings to return; if undefined, use 20.
   * @return the given number of strings of randomly-generated alphanumeric
   * characters with the given, or inferred, length.
   */
  randomIds(count: number, length?: number): Array<string> {
    if (count < 0) {
      throw new Error(`invalid count: ${count}`);
    }

    const results: Array<string> = [];
    for (let i = 0; i < count; i++) {
      results.push(this.randomId(length));
    }

    return results;
  }
}
