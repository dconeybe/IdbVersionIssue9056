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

/**
 * The Firebase Project ID to use.
 * Example: "my-cool-project"
 */
export const PROJECT_ID = 'REPLACE_WITH_YOUR_PROJECT_ID';

/**
 * The Firestore API key to use.
 * Example: "BTzaRyDNXIllFmlXIE4LmCzDQAYtITefbbixR4Z"
 */
export const API_KEY = 'REPLACE_WITH_YOUR_API_KEY';

/**
 * The Firestore host to connect to.
 */
export const HOST: 'prod' | 'emulator' | 'nightly' | 'qa' = 'prod';
