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

import yargs from 'yargs/yargs';

import { Settings } from '../common/settings.js';

/**
 * Parses the command-line arguments.
 *
 * @return the parsed command-line arguments.
 */
export function parseArgs(): ParsedArgs {
  // @ts-expect-error The compiler doesn't know that the return type satisfies
  // the type of the ParsedArgs.
  return yargs(process.argv.slice(2))
    .strict()
    .options({
      projectId: {
        alias: 'p',
        type: 'string',
        describe: `The Firebase Project ID to use.`
      },
      apiKey: {
        type: 'string',
        describe: `The Firebase API key to use.`
      },
      prod: {
        type: 'boolean',
        describe: `Connect to the Firestore production.`
      },
      emulator: {
        alias: 'e',
        type: 'boolean',
        describe: `Connect to the Firestore emulator.`
      },
      nightly: {
        type: 'boolean',
        describe: `Connect to the Firestore nightly instance.`
      },
      qa: {
        type: 'boolean',
        describe: `Connect to the Firestore QA instance.`
      },
      quiet: {
        alias: 'q',
        type: 'boolean',
        describe: `Disable Firestore debug logging.`
      },
      debug: {
        alias: 'd',
        type: 'boolean',
        describe: `Enable Firestore debug logging.`
      }
    })
    .check(
      // @ts-expect-error The compiler doesn't know that argv satisfies the
      // type of the ParsedArgs.
      checkMutuallyExclusive('prod', 'emulator', 'nightly', 'qa')
    )
    .check(
      // @ts-expect-error The compiler doesn't know that argv satisfies the
      // type of the ParsedArgs.
      checkMutuallyExclusive('debug', 'quiet')
    )
    .help()
    .parseSync();
}

export function updateSettingsFromParsedArgs(
  parsedArgs: ParsedArgs,
  settings: Settings
): void {
  if (parsedArgs.debug !== undefined) {
    settings.debugLogEnabled.setValue(true);
  }
  if (parsedArgs.quiet !== undefined) {
    settings.debugLogEnabled.setValue(false);
  }

  if (parsedArgs.prod !== undefined) {
    settings.host.setValue('prod');
  }
  if (parsedArgs.emulator !== undefined) {
    settings.host.setValue('emulator');
  }
  if (parsedArgs.nightly !== undefined) {
    settings.host.setValue('nightly');
  }
  if (parsedArgs.qa !== undefined) {
    settings.host.setValue('qa');
  }

  if (parsedArgs.projectId) {
    settings.projectId.setValue(parsedArgs.projectId);
  }
  if (parsedArgs.apiKey) {
    settings.apiKey.setValue(parsedArgs.apiKey);
  }
}

/**
 * The type of object returned from yargs.parseSync().
 */
export interface ParsedArgs {
  projectId?: string;
  apiKey?: string;
  prod?: boolean;
  emulator?: boolean;
  nightly?: boolean;
  qa?: boolean;
  quiet?: boolean;
  debug?: boolean;
}

/**
 * Verifies that at most one of the given arguments are set in the given object.
 *
 * @param argNames the names of the arguments to check.
 * @return a function suitable for specifying to yargs.check() to verify the
 * mutual exclusivity of the given arguments.
 */
function checkMutuallyExclusive(
  ...argNames: Array<keyof ParsedArgs>
): (argv: ParsedArgs) => true {
  return (argv: ParsedArgs): true => {
    const setArgNames = argNames.filter(argName => argv[argName] !== undefined);
    if (setArgNames.length > 1) {
      throw new Error(
        `at most one of ${argNames.join(', ')} may be set, ` +
          `but got: ${setArgNames.join(', ')}`
      );
    }
    return true;
  };
}
