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

import {
  CancellationToken,
  CancellationTokenSource
} from '../common/cancellation_token.js';
import { getFirestore } from '../common/firestore_helper.js';
import { log, resetStartTime } from '../common/logging.js';
import { setPlatform } from '../common/platform.js';
import { Settings, SettingsStorage, SettingValue } from '../common/settings.js';
import { TestEnvironment } from '../common/test_environment.js';
import {
  displayLabelFromHost,
  FirestoreHost,
  formatElapsedTime,
  hostNameFromHost,
  isPlaceholderValue
} from '../common/util.js';
import { runTheTest } from '../run_the_test.js';
import { BrowserPlatformImpl } from './platform.js';
import {
  initializeDynamicReplaceSpanTexts,
  load as loadUi,
  LoggingUi,
  LoggingUiCallbacks,
  MainUi,
  MainUiCallbacks,
  SettingsUi,
  SettingsUiCallbacks,
  SettingsUiValues
} from './ui.js';

class SessionStorageSettingsStorage implements SettingsStorage {
  clear(key: string): void {
    window?.sessionStorage?.removeItem(key);
  }

  load(key: string): string | null {
    return window?.sessionStorage?.getItem(key) ?? null;
  }

  save(key: string, value: string): void {
    window?.sessionStorage?.setItem(key, value);
  }
}

const sessionStorageSettingsStorage = new SessionStorageSettingsStorage();

function loadSettings(): Settings {
  return Settings.load(sessionStorageSettingsStorage);
}

/**
 * Callback invoked whenever the "Enable Debug Logging" checkbox's checked state
 * changes.
 *
 * Sets up the `Firestore` instance and invoke the `runTheTest()` function from
 * `run_the_test.ts`.
 */
async function go(
  ui: MainUi,
  cancellationToken: CancellationToken
): Promise<void> {
  const startTime: DOMHighResTimeStamp = performance.now();

  log(`Test Starting at ${new Date()}`);
  try {
    ui.setRunTestButtonEnabled(false);
    ui.setCancelTestButtonEnabled(true);

    const settings = loadSettings();
    const dbInfo = getFirestore(settings);
    const env: TestEnvironment = {
      ...dbInfo,
      cancellationToken,
      runtime: 'browser',
      getFirestore(instanceId: number): Firestore {
        return getFirestore(settings, instanceId).db;
      }
    };

    await runTheTest(env.db, env);
  } catch (e) {
    if (e instanceof Error) {
      log(`ERROR: ${e.message}`, { alsoLogToConsole: false });
      console.log(e.stack);
    } else {
      log(`ERROR: ${e}`);
    }
  } finally {
    ui.setRunTestButtonEnabled(true);
  }
  const endTime: DOMHighResTimeStamp = performance.now();
  const elapsedTimeStr = formatElapsedTime(startTime, endTime);
  log(`Test completed in ${elapsedTimeStr} at ${new Date()}`);
}

class MainUiCallbacksImpl implements MainUiCallbacks {
  private cancellationTokenSource: CancellationTokenSource | null = null;

  constructor(private readonly ui: MainUi) {}

  cancelTest(): void {
    log('Test cancellation requested');
    this.cancellationTokenSource?.cancel();
  }

  runTest(): void {
    if (this.cancellationTokenSource) {
      this.cancellationTokenSource.cancel();
    }
    this.cancellationTokenSource = new CancellationTokenSource();

    go(this.ui, this.cancellationTokenSource.cancellationToken);
  }

  showSettings(): void {
    window.location.hash = '#settings';
  }
}

class LoggingUiCallbacksImpl implements LoggingUiCallbacks {
  constructor(private readonly ui: LoggingUi) {}

  clearLogs(): void {
    this.ui.clearLogOutput();
    this.ui.setClearLogsButtonVisible(false);
    this.ui.setCopyLogsButtonVisible(false);
    resetStartTime();
  }

  async copyLogs(): Promise<void> {
    const logOutputText = this.ui.getLogOutputText();
    await navigator.clipboard.writeText(logOutputText);
    log(`Copied logs (${logOutputText.length} characters)`);
  }
}

class SettingsUiCallbacksImpl implements SettingsUiCallbacks {
  private readonly settings = loadSettings();

  onDebugLoggingChange(newChecked: boolean): void {
    this.settings.debugLogEnabled.setValue(newChecked);
  }

  onFirestoreHostChange(newValue: FirestoreHost): void {
    this.settings.host.setValue(newValue);
  }

  onProjectIdChange(newValue: string): void {
    SettingsUiCallbacksImpl.onTextBoxChanged(newValue, this.settings.projectId);
  }

  onApiKeyChange(newValue: string): void {
    SettingsUiCallbacksImpl.onTextBoxChanged(newValue, this.settings.apiKey);
  }

  private static onTextBoxChanged(
    newValue: string,
    setting: SettingValue<string>
  ): void {
    if (newValue.length === 0) {
      setting.resetValue();
    } else {
      const newValueTrimmed = newValue.trim();
      if (newValueTrimmed.length > 0 && setting.value !== newValueTrimmed) {
        setting.setValue(newValueTrimmed);
      }
    }
  }

  save(): void {
    const savedSettings = this.settings.saveAll();

    if (savedSettings.length === 0) {
      log('No settings changed');
    } else {
      for (const savedSetting of savedSettings) {
        const defaultValueSuffix = savedSetting.isDefault
          ? ' (the default)'
          : '';
        log(
          `${savedSetting.name} changed to ` +
            `${savedSetting.displayValue}${defaultValueSuffix}`
        );
      }
    }
  }

  close(): void {
    window.location.hash = '';
  }
}

class SettingsUiValuesImpl implements SettingsUiValues {
  private readonly settings = loadSettings();

  get debugLoggingEnabled(): boolean {
    return this.settings.debugLogEnabled.value;
  }

  get firestoreHost(): FirestoreHost | null {
    return this.settings.host.value;
  }

  get projectId(): string | null {
    return SettingsUiValuesImpl.getValueIgnoringPlaceholder(
      this.settings.projectId.value
    );
  }

  get apiKey(): string | null {
    return SettingsUiValuesImpl.getValueIgnoringPlaceholder(
      this.settings.apiKey.value
    );
  }

  private static getValueIgnoringPlaceholder(
    settingValue: string
  ): string | null {
    return isPlaceholderValue(settingValue) ? null : settingValue;
  }
}

/**
 * Gets the replacement texts for "span" nodes with the "data-dynamic-replace"
 * attribute set.
 *
 * The keys of the returned map are the recognized values for the
 * "data-dynamic-replace" attribute and the corresponding values are the text
 * to replace the contents of the span with.
 */
function loadSpanTextByDynamicReplaceKeyMap(): Map<string, string> {
  const map = new Map<string, string>();
  map.set('HOST_NAME_PROD', hostNameFromHost('prod'));
  map.set('HOST_NAME_EMULATOR', hostNameFromHost('emulator'));
  map.set('HOST_NAME_NIGHTLY', hostNameFromHost('nightly'));
  map.set('HOST_NAME_QA', hostNameFromHost('qa'));
  map.set('HOST_LABEL_PROD', displayLabelFromHost('prod'));
  map.set('HOST_LABEL_EMULATOR', displayLabelFromHost('emulator'));
  map.set('HOST_LABEL_NIGHTLY', displayLabelFromHost('nightly'));
  map.set('HOST_LABEL_QA', displayLabelFromHost('qa'));
  return map;
}

function handleWindowHashChange(mainUi: MainUi, settingsUi: SettingsUi): void {
  const isSettingsHash = window.location.hash === '#settings';

  if (isSettingsHash) {
    mainUi.hide();
    settingsUi.show(new SettingsUiValuesImpl());
  } else {
    settingsUi.hide();
    mainUi.show();
  }
}

/** Registers callbacks and initializes state of the HTML UI. */
export function initialize(): void {
  const { main: mainUi, logging: loggingUi, settings: settingsUi } = loadUi();
  setPlatform(new BrowserPlatformImpl(loggingUi));
  initializeDynamicReplaceSpanTexts(loadSpanTextByDynamicReplaceKeyMap());
  mainUi.registerCallbacks(new MainUiCallbacksImpl(mainUi));
  loggingUi.registerCallbacks(new LoggingUiCallbacksImpl(loggingUi));
  settingsUi.registerCallbacks(new SettingsUiCallbacksImpl());

  window.onhashchange = () => handleWindowHashChange(mainUi, settingsUi);
  handleWindowHashChange(mainUi, settingsUi);
}
