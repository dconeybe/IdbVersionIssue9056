#!npx ts-node

import path from 'node:path';

import { execa } from 'execa';

async function main(): Promise<void> {
  if (process.argv.length > 2) {
    console.error(
      'ERROR: no command-line arguments supported, but got:',
      process.argv.slice(2)
    );
    process.exit(2);
  }

  const package_json_dir = path.normalize(path.join(import.meta.dirname, '..'));
  const git_repo_root_dir = path.normalize(
    path.join(import.meta.dirname, '..', '..')
  );
  const commands: CommandSpec[] = [
    { args: 'npm run prettier', cwd: package_json_dir },
    { args: 'npm run lint', cwd: package_json_dir },
    { args: 'npm run tsc', cwd: package_json_dir },
    { args: 'npm run build', cwd: package_json_dir },
    { args: 'actionlint', cwd: git_repo_root_dir }
  ];

  const results: Array<{ command: string; result: RunCommandResult }> = [];
  for (const command of commands) {
    const commandString = shellStringFromCommand(command);
    console.log(divider);
    console.log(`Running command: ${commandString}`);
    const result = await runCommand(command);
    results.push({ command: commandString, result });
  }

  let hasFailed = false;
  console.log(divider);
  console.log('');
  console.log('COMMAND SUMMARY');
  console.log('');
  for (const result of results) {
    if (result.result === 'fail') {
      console.log(failedPrefix, result.command);
      hasFailed = true;
    } else if (result.result === 'pass') {
      console.log(passedPrefix, result.command);
    } else {
      throw new Error(
        `internal error: invalid result.result: ${result.result} [kpfhvw8t94]`
      );
    }
  }

  process.exit(hasFailed ? 1 : 0);
}

const failedPrefix = '❌ FAILED:';
const passedPrefix = '✅ passed:';
const divider =
  '===============================================================================';

type RunCommandResult = 'pass' | 'fail';

interface CommandSpec {
  args: string;
  cwd: string;
}

async function runCommand(command: CommandSpec): Promise<RunCommandResult> {
  const splitArgs = command.args.split(/\s+/);
  const arg0 = splitArgs[0]!;
  const subsequentArgs = splitArgs.slice(1);

  const execaResult = await execa(arg0, subsequentArgs, {
    cwd: command.cwd,
    stdio: 'inherit',
    preferLocal: false,
    reject: false
  });

  if (execaResult instanceof Error) {
    console.error(failedPrefix, splitArgs, execaResult.message);
  } else {
    console.error(passedPrefix, splitArgs);
  }

  return execaResult.failed ? 'fail' : 'pass';
}

function shellStringFromCommand(command: CommandSpec): string {
  return `cd ${command.cwd} && ${command.args}`;
}

main();
