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

import { LogMessage } from '../common/platform.js';
import { LoggingUi } from './ui.js';

export interface LogOptions {
  alsoLogToConsole: boolean;
}

/** Logs a message to the UI and, by default, console.log(). */
export function browserLog(ui: LoggingUi, message: LogMessage): void {
  ui.setClearLogsButtonVisible(true);
  ui.setCopyLogsButtonVisible(true);
  ui.appendToLogOutput(message.text, message.timestamp);

  const options = message.options as Partial<LogOptions>;
  if (options?.alsoLogToConsole ?? true) {
    console.log(`${message.timestamp} ${message.text}`);
  }
}
