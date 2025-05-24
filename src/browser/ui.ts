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

import { FirestoreHost } from '../common/util.js';

/** The HTML elements in the UI with which this application interacts. */
interface HtmlElements {
  main: MainHtmlElements;
  logging: LoggingHtmlElements;
  settings: SettingsHtmlElements;
}

interface MainHtmlElements {
  div: HTMLDivElement;

  buttons: {
    runTest: HTMLButtonElement;
    cancelTest: HTMLButtonElement;
    settings: HTMLButtonElement;
  };
}

interface LoggingHtmlElements {
  buttons: {
    clearLogs: HTMLButtonElement;
    copyLogs: HTMLButtonElement;
  };

  lines: HTMLElement;

  lineTemplate: {
    element: HTMLElement;
    timestamp: HTMLElement;
    message: HTMLElement;
  };
}

interface SettingsHtmlElements {
  div: HTMLDivElement;

  buttons: {
    save: HTMLButtonElement;
    cancel: HTMLButtonElement;
  };
  checkboxes: {
    debugLogging: HTMLInputElement;
  };
  firestoreHostOptions: {
    prod: HTMLInputElement;
    emulator: HTMLInputElement;
    nightly: HTMLInputElement;
    qa: HTMLInputElement;
  };
  textBoxes: {
    projectId: HTMLInputElement;
    apiKey: HTMLInputElement;
  };
}

class HtmlElementNotFoundError extends Error {
  override readonly name = 'HtmlElementNotFoundError';
}

function loadElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new HtmlElementNotFoundError(`HTML element with ID not found: ${id}`);
  }
  return element as T;
}

function loadHtmlElements(): HtmlElements {
  return {
    main: {
      div: loadElement<HTMLDivElement>('divMain'),
      buttons: {
        runTest: loadElement<HTMLButtonElement>('btnRunTest'),
        cancelTest: loadElement<HTMLButtonElement>('btnCancelTest'),
        settings: loadElement<HTMLButtonElement>('btnSettings')
      }
    },

    logging: {
      buttons: {
        clearLogs: loadElement<HTMLButtonElement>('btnClearLogs'),
        copyLogs: loadElement<HTMLButtonElement>('btnCopyLogs')
      },
      lines: loadElement<HTMLButtonElement>('logLines'),
      lineTemplate: {
        element: loadElement<HTMLDivElement>('logLineTemplate'),
        timestamp: loadElement('logLineTimestamp'),
        message: loadElement('logLineMessage')
      }
    },

    settings: {
      div: loadElement<HTMLDivElement>('divSettings'),
      buttons: {
        save: loadElement<HTMLButtonElement>('btnSettingsSave'),
        cancel: loadElement<HTMLButtonElement>('btnSettingsCancel')
      },
      checkboxes: {
        debugLogging: loadElement<HTMLInputElement>('chkDebugLogging')
      },
      firestoreHostOptions: {
        prod: loadElement<HTMLInputElement>('radFirestoreHostProd'),
        emulator: loadElement<HTMLInputElement>('radFirestoreHostEmulator'),
        nightly: loadElement<HTMLInputElement>('radFirestoreHostNightly'),
        qa: loadElement<HTMLInputElement>('radFirestoreHostQA')
      },
      textBoxes: {
        projectId: loadElement<HTMLInputElement>('txtProjectId'),
        apiKey: loadElement<HTMLInputElement>('txtApiKey')
      }
    }
  };
}

export interface Ui {
  main: MainUi;
  logging: LoggingUi;
  settings: SettingsUi;
}

/** Loads the user interface elements. */
export function load(): Ui {
  const htmlElements = loadHtmlElements();
  return {
    main: MainUi[CREATE](htmlElements.main),
    logging: LoggingUi[CREATE](htmlElements.logging),
    settings: SettingsUi[CREATE](htmlElements.settings)
  };
}

/**
 * Replaces static text in the HTML DOM with the dynamic text calculated at
 * runtime.
 *
 * This function searches through the DOM for all "span" nodes with the
 * "data-dynamic-replace" attribute. The text of the nodes is used as the "key"
 * and will be replaced with the corresponding value.
 */
export function initializeDynamicReplaceSpanTexts(
  replacements: Map<string, string>
): void {
  const spanNodes = document.getElementsByTagName('span');
  for (const spanNode of spanNodes) {
    if (spanNode.hasAttribute('data-dynamic-replace')) {
      const key = spanNode.getAttribute('data-dynamic-replace');
      if (key === null) {
        console.warn(
          `'data-dynamic-replace' attribute of 'span' node requires a value`
        );
        continue;
      }

      const replacementText = replacements.get(key);
      if (replacementText === undefined) {
        console.warn(
          `'data-dynamic-replace' attribute of 'span' is not known: ${key}`
        );
        continue;
      }

      spanNode.textContent = replacementText;
    }
  }
}

// A private Symbol for "create" factory methods on classes.
// Since this symbol is not exported, only code in this file can use it to
// create instances of classes that define it.
const CREATE = Symbol('create factory function');

export interface SettingsUiCallbacks {
  onDebugLoggingChange(newChecked: boolean): void;
  onFirestoreHostChange(newValue: FirestoreHost): void;
  onProjectIdChange(newValue: string): void;
  onApiKeyChange(newValue: string): void;
  save(): void;
  close(): void;
}

export interface SettingsUiValues {
  readonly debugLoggingEnabled: boolean;
  readonly firestoreHost: FirestoreHost | null;
  readonly projectId: string | null;
  readonly apiKey: string | null;
}

export class SettingsUi {
  private constructor(private readonly ui: SettingsHtmlElements) {}

  static [CREATE](ui: SettingsHtmlElements): SettingsUi {
    return new SettingsUi(ui);
  }

  registerCallbacks(callbacks: SettingsUiCallbacks) {
    // Set up the checkbox for the "debug logging enabled" setting.
    this.ui.checkboxes.debugLogging.onchange = () => {
      callbacks.onDebugLoggingChange(this.ui.checkboxes.debugLogging.checked);
    };

    // Set up the radio options for the "Firestore host" setting.
    this.ui.firestoreHostOptions.prod.onclick = () => {
      callbacks.onFirestoreHostChange('prod');
    };
    this.ui.firestoreHostOptions.emulator.onclick = () => {
      callbacks.onFirestoreHostChange('emulator');
    };
    this.ui.firestoreHostOptions.nightly.onclick = () => {
      callbacks.onFirestoreHostChange('nightly');
    };
    this.ui.firestoreHostOptions.qa.onclick = () => {
      callbacks.onFirestoreHostChange('qa');
    };

    // Set up the Project ID and API Key text boxes.
    this.ui.textBoxes.projectId.onchange = () =>
      callbacks.onProjectIdChange(this.ui.textBoxes.projectId.value ?? '');
    this.ui.textBoxes.apiKey.onchange = () =>
      callbacks.onApiKeyChange(this.ui.textBoxes.apiKey.value ?? '');

    this.ui.buttons.save.onclick = () => {
      callbacks.save();
      callbacks.close();
    };
    this.ui.buttons.cancel.onclick = () => {
      callbacks.close();
    };
    document.body.addEventListener('keydown', event => {
      if (this.ui.div.hidden) {
        return;
      } else if (event.key === 'Escape') {
        this.ui.buttons.cancel.click();
        event.stopImmediatePropagation();
      } else if (event.key === 'Enter') {
        this.ui.buttons.save.click();
        event.stopImmediatePropagation();
      }
    });
  }

  show(initialValues: SettingsUiValues): void {
    this.ui.checkboxes.debugLogging.checked = initialValues.debugLoggingEnabled;
    this.ui.textBoxes.projectId.value = initialValues.projectId ?? '';
    this.ui.textBoxes.apiKey.value = initialValues.apiKey ?? '';

    switch (initialValues.firestoreHost) {
      case 'prod':
        this.ui.firestoreHostOptions.prod.checked = true;
        break;
      case 'emulator':
        this.ui.firestoreHostOptions.emulator.checked = true;
        break;
      case 'nightly':
        this.ui.firestoreHostOptions.nightly.checked = true;
        break;
      case 'qa':
        this.ui.firestoreHostOptions.qa.checked = true;
        break;
    }

    this.ui.div.hidden = false;
  }

  hide(): void {
    this.ui.div.hidden = true;
  }
}

export interface MainUiCallbacks {
  runTest(): void;
  cancelTest(): void;
  showSettings(): void;
}

export interface LoggingUiCallbacks {
  clearLogs(): void;
  copyLogs(): Promise<void>;
}

export class MainUi {
  private constructor(private readonly ui: MainHtmlElements) {}

  static [CREATE](ui: MainHtmlElements): MainUi {
    return new MainUi(ui);
  }

  registerCallbacks(callbacks: MainUiCallbacks): void {
    this.ui.buttons.runTest.onclick = () => callbacks.runTest();
    this.ui.buttons.cancelTest.onclick = () => callbacks.cancelTest();
    this.ui.buttons.settings.onclick = () => callbacks.showSettings();
  }

  setRunTestButtonEnabled(enabled: boolean): void {
    this.ui.buttons.runTest.disabled = !enabled;
  }

  setCancelTestButtonEnabled(enabled: boolean): void {
    this.ui.buttons.cancelTest.disabled = !enabled;
  }

  show(): void {
    this.ui.div.hidden = false;
  }

  hide(): void {
    this.ui.div.hidden = true;
  }
}

export class LoggingUi {
  private constructor(private readonly ui: LoggingHtmlElements) {}

  static [CREATE](ui: LoggingHtmlElements): LoggingUi {
    return new LoggingUi(ui);
  }

  registerCallbacks(callbacks: LoggingUiCallbacks): void {
    this.ui.buttons.clearLogs.onclick = () => callbacks.clearLogs();
    this.ui.buttons.copyLogs.onclick = () => callbacks.copyLogs();
  }

  setClearLogsButtonVisible(visible: boolean): void {
    this.ui.buttons.clearLogs.hidden = !visible;
  }

  setCopyLogsButtonVisible(visible: boolean): void {
    this.ui.buttons.copyLogs.hidden = !visible;
  }

  clearLogOutput(): void {
    this.ui.lines.innerHTML = '';
  }

  getLogOutputText(): string {
    return this.ui.lines.innerText;
  }

  appendToLogOutput(message: string, timestamp: string): void {
    this.ui.lineTemplate.timestamp.innerText = timestamp;
    this.ui.lineTemplate.message.innerText =
      htmlTextPreservingLeadingSpaces(message);
    const logLineElement = this.ui.lineTemplate.element.cloneNode(
      /*deep=*/ true
    ) as HTMLElement;
    logLineElement.hidden = false;
    this.ui.lines.appendChild(logLineElement);
  }
}

function htmlTextPreservingLeadingSpaces(text: string): string {
  const chars: Array<string> = [];
  let i = 0;
  let hasSeenNonSpaceOnLine = false;
  while (i < text.length) {
    const c = text[i]!;
    i++;

    if (c === '\n') {
      chars.push(c);
      hasSeenNonSpaceOnLine = false;
      continue;
    }

    if (c === ' ' && !hasSeenNonSpaceOnLine) {
      chars.push('\u00A0');
      continue;
    }

    hasSeenNonSpaceOnLine = true;
    chars.push(c);
  }

  return chars.join('');
}
