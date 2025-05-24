import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import type http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import dedent from 'dedent';
import esbuild from 'esbuild';
import express from 'express';
import mimeTypes from 'mime-types';
import nunjucks from 'nunjucks';
import signale, { type SignaleConfig } from 'signale';
import statuses from 'statuses';

import { baseEsbuildOptions } from './esbuild_options.js';

const signaleConfig: SignaleConfig = Object.freeze({
  displayScope: false,
  displayBadge: true,
  displayDate: true,
  displayTimestamp: true,
  displayFilename: false,
  displayLabel: false
});

const logger = new signale.Signale({ config: signaleConfig });

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

  if (parsedArgs === 'help') {
    showHelp();
  } else {
    await runHttpServer(parsedArgs);
  }
}

function runHttpServer(args: ParsedArgs): Promise<void> {
  if (args.port === 0) {
    logger.note(
      `Starting HTTP server at "${args.host}" on a randomly-chosen port`
    );
  } else {
    logger.note(`Starting HTTP server at http://${args.host}:${args.port}`);
  }

  const app = express();
  configureRoutes(app);

  return new Promise((resolve, reject) => {
    const httpServer = app.listen(args.port, args.host, error => {
      if (error) {
        reject(error);
      } else {
        logListenSuccessful(httpServer);
      }
    });
    httpServer.once('error', reject);
    httpServer.once('close', resolve);
  });
}

function configureRoutes(app: express.Express): void {
  const wwwDirPath = path.join(import.meta.dirname, '..', 'www');
  const nodeModulesDirPath = path.join(
    import.meta.dirname,
    '..',
    'node_modules'
  );
  const bootstrapDirPath = path.join(nodeModulesDirPath, 'bootstrap', 'dist');
  const paths: Record<string, string> = Object.freeze({
    '/': path.join(wwwDirPath, 'index.html'),
    '/firebase_favicon.png': path.join(wwwDirPath, 'firebase_favicon.png'),
    '/bootstrap.css': path.join(bootstrapDirPath, 'css', 'bootstrap.css'),
    '/bootstrap.js': path.join(bootstrapDirPath, 'js', 'bootstrap.bundle.js')
  });

  app.use((req, res, next) => {
    if (req.path === '/index.js') {
      return respondWithCompiledJavaScript(req, res);
    }

    const filePath = paths[req.path];
    if (filePath) {
      return respondWithFileContents(req, res, filePath);
    }

    logger.warn(`${req.method} ${req.path} NOT FOUND`);
    return next();
  });
}

function logListenSuccessful(httpServer: http.Server): void {
  const address = httpServer.address();
  if (!address || typeof address !== 'object') {
    throw new Error(
      `Don't know how to handle address: ${address} [gnystjq3f9]`
    );
  } else {
    logger.note(
      `HTTP server started at http://${address.address}:${address.port}/`
    );
  }
}

interface ParsedArgs {
  host: string;
  port: number;
}

function defaultParsedArgs(): ParsedArgs {
  return {
    host: '127.0.0.1',
    port: 0
  };
}

function parseArgs(args: string[]): ParsedArgs | 'help' {
  const parsedArgs = defaultParsedArgs();

  type LastArg = '--host' | '--port';
  const lastArgValues: readonly LastArg[] = Object.freeze(['--host', '--port']);
  function isLastArg(value: string): value is LastArg {
    return lastArgValues.includes(value as unknown as LastArg);
  }

  function portFromArgValue(value: string): number {
    const parsedPort = parseFloat(value);
    if (Number.isNaN(parsedPort)) {
      throw new ParseArgsError(`invalid port: ${value} (must be a number)`);
    } else if (!Number.isInteger(parsedPort)) {
      throw new ParseArgsError(`invalid port: ${value} (must be an integer)`);
    } else if (parsedPort < 0) {
      throw new ParseArgsError(
        `invalid port: ${value} (must be greater than or equal to 0)`
      );
    }
    return parsedPort;
  }

  let lastArg: LastArg | null = null;

  for (const arg of args) {
    if (lastArg === '--host') {
      parsedArgs.host = arg;
    } else if (lastArg === '--port') {
      parsedArgs.port = portFromArgValue(arg);
    } else if (lastArg !== null) {
      throw new Error(
        `internal error: unexpected lastArg: ${lastArg} [m5wx7yf5pq]`
      );
    }

    if (lastArg !== null) {
      lastArg = null;
      continue;
    }

    if (arg === '-h' || arg === '--help') {
      return 'help';
    } else if (isLastArg(arg)) {
      lastArg = arg;
    } else if (arg.startsWith('--host=')) {
      parsedArgs.host = arg.substring(7);
    } else if (arg.startsWith('--port=')) {
      parsedArgs.port = portFromArgValue(arg.substring(7));
    } else {
      throw new ParseArgsError(`unknown argument: ${arg} [wn9md9zf6v]`);
    }
  }

  if (lastArg !== null) {
    throw new ParseArgsError(`expected argument after ${lastArg} [r2g6dy48yp]`);
  }

  return parsedArgs;
}

function showHelp(): void {
  const defaults = defaultParsedArgs();
  console.log(dedent`
    Syntax: ${path.basename(__filename)} [options]
   
    Runs an HTTP server that serves the website to run the application.
    Everything is compiled on-demand, so any changes made to files are
    immediately reflected with the web page is reloaded. Just make sure
    to do a "forced" reload, such as pressing CTRL+SHIFT+R instead of
    CTRL+R in Chrome.
   
    General Options:
   
    --host <host> / --host=<host>
      The interface to which the HTTP server should bind.
      Default: ${defaults.host}
   
    --port <port> / --port=<port>
      The TCP port number to which the HTTP server should listen.
      If 0 (zero) then a random TCP port will be chosen.
      Default: ${defaults.port}
   
    -h/--help
      Show this help information and exit successfully.
   
    --help-advanced
      Show advanced help for uncommon use cases and exit successfully.
`);
}

class ParseArgsError extends Error {
  override readonly name: 'ParseArgsError' = 'ParseArgsError' as const;
}

const internalServerErrorHtml = `
<!doctype html>
<html lang="en">
<head>
  <title>500 Internal Server Error</title>
</head>
<body>
  <h1>Internal Server Error</h1>
  <pre>{{ errorStack }}</pre>
</body>
</html>
`;

function internalServerErrorHtmlForError(error: unknown): string {
  const env = nunjucks.configure({
    autoescape: true,
    throwOnUndefined: false
  });
  const errorStack =
    typeof error === 'object' && error && 'stack' in error
      ? `${error.stack}`
      : `${error}`;
  return env.renderString(internalServerErrorHtml, { errorStack });
}

function sendInternalServerError(
  res: http.ServerResponse,
  error: unknown
): void {
  const text = internalServerErrorHtmlForError(error);
  const contentType = contentTypeForFileWithPath('foo.html');
  sendTextResponse({ res, text, contentType, httpStatus: 500 });
}

function sendTextResponse(config: {
  res: http.ServerResponse;
  text: string;
  contentType: string;
  httpStatus: number;
}): void {
  const { res, text, contentType, httpStatus } = config;
  const encoder = new TextEncoder();
  const utf8EncodedText = encoder.encode(text);
  res.setHeader('Content-Length', utf8EncodedText.length);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-cache');
  res.writeHead(httpStatus, statuses(httpStatus));
  res.write(utf8EncodedText);
  res.end();
}

async function respondWithFileContents(
  req: express.Request,
  res: express.Response,
  filePath: string
): Promise<void> {
  logger.info(`${req.method} ${req.path} sending ${filePath}`);

  let statResult: Stats;
  try {
    statResult = await fs.stat(filePath);
  } catch (e: unknown) {
    logger.error(`fs.stat(${filePath}) failed:`, e);
    sendInternalServerError(res, e);
    return;
  }

  if (!statResult.isFile()) {
    const error = new Error(`${filePath}) should be a file, but it is not`);
    logger.error(error);
    sendInternalServerError(res, error);
    return;
  }

  const fileSize = statResult.size;
  if (fileSize < 0) {
    const error = new Error(
      `File ${filePath}) has an invalid size: ${fileSize}`
    );
    logger.error(error);
    sendInternalServerError(res, error);
    return;
  }

  logger.info(
    `${req.method} ${req.path} sending ${filePath} ` +
      `(${fileSize.toLocaleString()} bytes)`
  );

  let fileHandle: fs.FileHandle;
  try {
    fileHandle = await fs.open(filePath, 'r');
  } catch (e: unknown) {
    logger.error(`Opening file for reading failed: ${filePath}`, e);
    sendInternalServerError(res, e);
    return;
  }

  res.writeHead(200, statuses(200), {
    'Content-Length': fileSize,
    'Content-Type': contentTypeForFileWithPath(filePath),
    'Cache-Control': 'no-cache'
  });

  fileHandle.createReadStream().pipe(res);
}

async function respondWithCompiledJavaScript(
  req: express.Request,
  res: express.Response
): Promise<void> {
  const esbuildOptions = baseEsbuildOptions();
  logger.info(
    `${req.method} ${req.path} bundling ` +
      esbuildOptions.entryPoints.join(', ')
  );

  const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'nwhfsxbn9v'));
  try {
    const outFile = path.join(tempDir, 'index.js');
    esbuildOptions.outfile = outFile;
    esbuildOptions.sourcemap = 'inline';
    esbuildOptions.sourcesContent = true;
    esbuildOptions.treeShaking = true;

    let esbuildResult: esbuild.BuildResult;
    try {
      esbuildResult = await esbuild.build(esbuildOptions);
    } catch (e: unknown) {
      logger.error('esbuild failed:', e);
      sendInternalServerError(res, e);
      return;
    }

    if (esbuildResult.errors.length > 0) {
      const esbuildColorErrors = await esbuild.formatMessages(
        esbuildResult.errors,
        {
          kind: 'error',
          color: true
        }
      );
      for (const esbuildColorError of esbuildColorErrors) {
        console.error(esbuildColorError);
      }

      const esbuildNonColorErrors = await esbuild.formatMessages(
        esbuildResult.errors,
        {
          kind: 'error',
          color: false
        }
      );
      sendInternalServerError(
        res,
        new Error(JSON.stringify(esbuildNonColorErrors, null, 2))
      );
      return;
    }

    await respondWithFileContents(req, res, outFile);
  } finally {
    fs.rm(tempDir, { recursive: true, force: true }).catch(error => {
      logger.warn(`deleting temporary directory failed: ${tempDir}`, error);
    });
  }
}

function contentTypeForFileWithPath(filePath: string): string {
  const mimeType = mimeTypes.contentType(path.basename(filePath));
  return typeof mimeType === 'string' ? mimeType : 'application/octet-stream';
}

main();
