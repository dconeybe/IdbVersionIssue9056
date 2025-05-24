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

import { Md5 } from 'ts-closure-library/lib/crypt/md5';

import { LogMessage, Platform } from '../common/platform.js';
import { browserLog } from './logging.js';
import { LoggingUi } from './ui.js';

/**
 * An implementation of `Platform` for the browser.
 */
export class BrowserPlatformImpl implements Platform {
  constructor(private readonly ui: LoggingUi) {}

  base64Encode(data: string): string {
    return btoa(data);
  }

  calculateHash(data: Array<number> | Uint8Array | string): Array<number> {
    const md5 = new Md5();
    md5.update(data);
    return md5.digest();
  }

  getCurrentMonotonicTimeMilliseconds(): number {
    return performance.now();
  }

  log(message: LogMessage): void {
    browserLog(this.ui, message);
  }

  utf8Encode(data: string): Uint8Array {
    return new TextEncoder().encode(data);
  }
}
