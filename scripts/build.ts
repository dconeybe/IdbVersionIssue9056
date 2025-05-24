import path from 'node:path';

import esbuild from 'esbuild';
import fsExtra from 'fs-extra';
import { glob } from 'glob';
import signale from 'signale';

import { baseEsbuildOptions } from './esbuild_options.js';

async function main(): Promise<void> {
  let parsedArgs: ReturnType<typeof parseArgs>;
  try {
    parsedArgs = parseArgs(process.argv.slice(2));
  } catch (e: unknown) {
    if (e instanceof ParseArgsError) {
      console.error(
        `ERROR: ${__filename}: parsing command-line arguments failed:`
      );
      console.error(e.message);
      console.error('Run with --help for help');
      process.exit(2);
    }
    throw e;
  }

  await build(parsedArgs);
}

interface BuildConfig {
  outputDirectory: string;
}

async function build(config: BuildConfig): Promise<void> {
  const outputDirectory = path.resolve(config.outputDirectory);
  signale.info(`Deleting and re-creating output directory: ${outputDirectory}`);
  await fsExtra.emptyDir(outputDirectory);
  await compileJavaScript(outputDirectory);
  await logCompiledFiles(outputDirectory);
}

async function compileJavaScript(outputDirectory: string): Promise<void> {
  const esbuildOptions = baseEsbuildOptions();
  esbuildOptions.outdir = outputDirectory;
  esbuildOptions.sourcemap = 'linked';

  signale.info('Running esbuild with options:', esbuildOptions);

  let esbuildResult: esbuild.BuildResult;
  try {
    esbuildResult = await esbuild.build(esbuildOptions);
  } catch (e: unknown) {
    signale.error('esbuild failed:', e);
    return Promise.reject(e);
  }

  const esbuildErrors = await esbuild.formatMessages(esbuildResult.errors, {
    kind: 'error',
    color: true
  });
  if (esbuildErrors.length > 0) {
    console.error('esbuild failed with options:', esbuildOptions);
    for (const esbuildError of esbuildErrors) {
      console.error(esbuildError);
    }
    throw new Error('esbuild failed [djgezay4vn]');
  }
}

async function logCompiledFiles(outputDirectory: string): Promise<void> {
  const files = await glob('**/*', {
    nodir: true,
    cwd: outputDirectory,
    withFileTypes: true,
    stat: true
  });
  signale.note(`esbuild created ${files.length} files:`);
  for (const file of files) {
    signale.note(`${file.fullpath()} (${file.size?.toLocaleString()} bytes)`);
  }
}

interface ParsedArgs {
  outputDirectory: string;
}

function parseArgs(args: string[]): ParsedArgs {
  const parsedArgs = {} as unknown as ParsedArgs;

  for (const arg of args) {
    if (typeof parsedArgs.outputDirectory === 'undefined') {
      parsedArgs.outputDirectory = arg;
    } else {
      throw new ParseArgsError(`unexpected positional argument: ${arg}`);
    }
  }

  if (typeof parsedArgs.outputDirectory === 'undefined') {
    throw new ParseArgsError(`an output directory was not specified`);
  }

  return parsedArgs;
}

class ParseArgsError extends Error {
  override readonly name: 'ParseArgsError' = 'ParseArgsError' as const;
}

main();
