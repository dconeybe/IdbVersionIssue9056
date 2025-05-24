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

import death from 'death';
import { Firestore, terminate } from 'firebase/firestore';

import { CancellationTokenSource } from '../common/cancellation_token.js';
import { getFirestore } from '../common/firestore_helper.js';
import { log } from '../common/logging.js';
import { setPlatform } from '../common/platform.js';
import { Settings, SettingsStorage } from '../common/settings.js';
import { TestEnvironment } from '../common/test_environment.js';
import { formatElapsedTime } from '../common/util.js';
import { runTheTest } from '../run_the_test.js';
import { parseArgs, updateSettingsFromParsedArgs } from './arg_parser.js';
import { NodePlatformImpl } from './platform.js';

type DeathUnsubscribeFunction = () => void;

class MemorySettingsStorage implements SettingsStorage {
  readonly map = new Map<string, string>();

  clear(key: string): void {
    this.map.delete(key);
  }

  load(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  save(key: string, value: string): void {
    this.map.set(key, value);
  }
}

/**
 * Callback invoked whenever the "Enable Debug Logging" checkbox's checked state
 * changes.
 *
 * Sets up the `Firestore` instance and invoke the `runTheTest()` function from
 * `run_the_test.ts`.
 */
async function go() {
  setPlatform(new NodePlatformImpl());

  const parsedArgs = parseArgs();
  const settings = Settings.load(new MemorySettingsStorage());
  updateSettingsFromParsedArgs(parsedArgs, settings);

  let deathUnsubscribe: DeathUnsubscribeFunction | null = null;
  const startTime: number = performance.now();
  log(`Test Started`);
  try {
    const dbInfo = getFirestore(settings);
    const cancellationTokenSource = new CancellationTokenSource();
    deathUnsubscribe = death(() => cancellationTokenSource.cancel());
    const env: TestEnvironment = {
      ...dbInfo,
      cancellationToken: cancellationTokenSource.cancellationToken,
      runtime: 'node',
      getFirestore(instanceId: number): Firestore {
        return getFirestore(settings, instanceId).db;
      }
    };

    try {
      await runTheTest(env.db, env);
    } finally {
      log('Terminating Firestore');
      await terminate(env.db);
    }
  } catch (e) {
    if (e instanceof Error) {
      log(`ERROR: ${e.message}`, { alsoLogToConsole: false });
      console.log(e.stack);
    } else {
      log(`ERROR: ${e}`);
    }
  } finally {
    deathUnsubscribe?.();
  }
  const endTime: number = performance.now();
  const elapsedTimeStr = formatElapsedTime(startTime, endTime);
  log(`Test completed in ${elapsedTimeStr}`);
}

// Run the program!
go();
