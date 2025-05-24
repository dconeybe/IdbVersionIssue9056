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

import { setLogLevel } from 'firebase/firestore';

import { API_KEY, HOST, PROJECT_ID } from '../firebase_config.js';
import { log } from './logging.js';
import {
  displayValueFromHost,
  FirestoreHost,
  hostNameFromHost
} from './util.js';

/**
 * The type-erased base class of `SettingValue`.
 */
export interface SettingValueBase {
  /** A human-friendly name for this setting to display in a UI. */
  readonly name: string;

  /** The key by which this setting's value is saved in persistent storage. */
  readonly key: string;

  /** The value of this setting, with any defaults applied. */
  readonly value: unknown;

  /** A human-friendly version of this setting's value to display in a UI. */
  readonly displayValue: string;

  /**
   * Whether the value of this setting has been changed and not yet saved to
   * persistent storage.
   */
  readonly isDirty: boolean;

  /**
   * Whether the value of this setting has not yet been set, and its value is
   * simply the default.
   */
  readonly isDefault: boolean;

  /**
   * Whether this setting has even been "applied" by calling `apply()`.
   *
   * If this setting does not define `apply()` then this attribute value is
   * always `false`.
   */
  readonly isApplied: boolean;

  /**
   * Loads the value of this setting from persistent storage.
   */
  load(): void;

  /**
   * Saves the value of this setting to persistent storage.
   *
   * The value of this setting will be written even if it has not changed or is
   * using the default value. To avoid a write operation in this scenario, only
   * call this method if `dirty` is `true`.
   *
   * This method does _not_ call `apply()`. In general, the caller of `save()`
   * should also call `apply()`.
   */
  save(): void;

  /**
   * Apply this setting's value so that it takes effect.
   *
   * For example, if this setting controls debug logging, then this method
   * should toggle debug logging based on this setting's current value.
   *
   * This is an optional method, and only needs to be implemented for settings
   * that need to take some action to have effect.
   */
  apply?(): void;
}

export interface SettingsStorage {
  load(key: string): string | null;
  save(key: string, value: string): void;
  clear(key: string): void;
}

const RESET_TOKEN = Symbol('RESET_TOKEN');

export class SettingValue<T extends string | boolean>
  implements SettingValueBase
{
  private _setValue: T | typeof RESET_TOKEN | null = null;
  private _loadedValue: T | null = null;

  constructor(
    readonly storage: SettingsStorage,
    readonly name: string,
    readonly key: string,
    readonly defaultValue: T
  ) {}

  get value(): T {
    if (this._setValue === RESET_TOKEN) {
      return this.defaultValue;
    }
    if (this._setValue !== null) {
      return this._setValue;
    }
    if (this._loadedValue !== null) {
      return this._loadedValue;
    }
    return this.defaultValue;
  }

  get displayValue(): string {
    return `${this.value}`;
  }

  get isDirty(): boolean {
    return this._setValue !== null;
  }

  get isDefault(): boolean {
    return this._setValue === null && this._loadedValue === null;
  }

  get isApplied(): boolean {
    // Subclasses that provide an `apply()` function must override this property
    // to return the correct value.
    return false;
  }

  setValue(newValue: T): void {
    this._setValue = newValue;
  }

  resetValue(): void {
    this._setValue = RESET_TOKEN;
  }

  load(): void {
    const loadedValue = this._loadValue();
    if (loadedValue !== null) {
      this._loadedValue = loadedValue;
    }
  }

  private _loadValue(): T | null {
    const stringValue = this.storage.load(this.key);
    if (stringValue === null) {
      return null;
    }

    if (typeof this.defaultValue === 'string') {
      return stringValue as T;
    }

    if (typeof this.defaultValue === 'boolean') {
      if (stringValue === 'true') {
        return true as T;
      } else if (stringValue === 'false') {
        return false as T;
      } else {
        return null;
      }
    }

    throw new Error(
      `internal error: unexpected typeof this.defaultValue: ` +
        `${typeof this.defaultValue}`
    );
  }

  save(): void {
    const newValue = this._setValue;
    if (newValue === null) {
      return;
    }
    this._setValue = null;

    if (newValue === RESET_TOKEN) {
      this._loadedValue = null;
    } else {
      this._loadedValue = newValue;
    }

    this._saveValue(newValue);
  }

  private _saveValue(value: T | typeof RESET_TOKEN): void {
    if (value === RESET_TOKEN) {
      this.storage.clear(this.key);
      return;
    }

    let valueString: string;
    if (typeof value === 'string') {
      valueString = value;
    } else if (typeof value === 'boolean') {
      valueString = value ? 'true' : 'false';
    } else {
      throw new Error(
        `internal error: unexpected typeof value: ` + `${typeof value}`
      );
    }

    this.storage.save(this.key, valueString);
  }
}

/**
 * A specialization of `SettingValue` where the value is a "host ID" of the
 * Firestore backend to which to connect.
 */
export class FirestoreHostSettingValue extends SettingValue<FirestoreHost> {
  override get displayValue(): string {
    return displayValueFromHost(this.value);
  }

  get hostName(): string {
    return hostNameFromHost(this.value);
  }
}

let debugLogEnabledSettingApplied = false;

/**
 * A specialization of `SettingValue` where the value is whether Firestore's
 * debug logging is enabled.
 */
export class FirestoreDebugLogEnabledSettingValue extends SettingValue<boolean> {
  override get isApplied(): boolean {
    return debugLogEnabledSettingApplied;
  }

  apply(): void {
    debugLogEnabledSettingApplied = true;

    if (this.isDefault) {
      return;
    }

    const newLogLevel = this.value ? 'debug' : 'info';
    log(`setLogLevel(${newLogLevel})`);
    setLogLevel(newLogLevel);
  }
}

/**
 * This application's settings.
 */
export class Settings {
  readonly debugLogEnabled: FirestoreDebugLogEnabledSettingValue;
  readonly host: FirestoreHostSettingValue;
  readonly projectId: SettingValue<string>;
  readonly apiKey: SettingValue<string>;

  private constructor(storage: SettingsStorage) {
    this.debugLogEnabled = new FirestoreDebugLogEnabledSettingValue(
      storage,
      'Firestore debug logging',
      'debugLogEnabled',
      false
    );
    this.host = new FirestoreHostSettingValue(
      storage,
      'Firestore host',
      'host',
      HOST
    );
    this.projectId = new SettingValue<string>(
      storage,
      'Firebase Project ID',
      'projectId',
      PROJECT_ID
    );
    this.apiKey = new SettingValue<string>(
      storage,
      'Firebase API key',
      'apiKey',
      API_KEY
    );
  }

  get all(): Array<SettingValueBase> {
    return [this.debugLogEnabled, this.host, this.projectId, this.apiKey];
  }

  saveAll(): Array<SettingValueBase> {
    const savedSettings: Array<SettingValueBase> = [];
    for (const setting of this.all) {
      if (setting.isDirty) {
        setting.save();
        setting.apply?.();
        savedSettings.push(setting);
      }
    }
    return savedSettings;
  }

  loadAll(): void {
    for (const setting of this.all) {
      setting.load();
    }
  }

  static load(storage: SettingsStorage): Settings {
    const appSettings = new Settings(storage);
    appSettings.loadAll();
    return appSettings;
  }
}
