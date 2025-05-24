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

import { createHash } from 'node:crypto';
import { TextEncoder } from 'node:util';

import { LogMessage, Platform } from '../common/platform.js';

/**
 * An implementation of `Platform` for Node..
 */
export class NodePlatformImpl implements Platform {
  base64Encode(data: string): string {
    return Buffer.from(data, 'binary').toString('base64');
  }

  calculateHash(data: Array<number> | Uint8Array | string): Array<number> {
    return Array.from(createHash('md5').update(toUint8Array(data)).digest());
  }

  getCurrentMonotonicTimeMilliseconds(): number {
    const currentTime: [number, number] = process.hrtime();
    return currentTime[0] * 1000 + currentTime[1] / 1_000_000;
  }

  log(message: LogMessage): void {
    console.log(`${message.timestamp} ${message.text}`);
  }

  utf8Encode(data: string): Uint8Array {
    return new TextEncoder().encode(data);
  }
}

function toUint8Array(data: Array<number> | Uint8Array | string): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }

  const uint8Array = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i++) {
    const element = data instanceof Array ? data[i]! : data.charCodeAt(i);
    if (element < 0 || element > 255) {
      throw new Error(`data[${i}] is out of range: ${element}`);
    }
    uint8Array[i] = element;
  }

  return uint8Array;
}
