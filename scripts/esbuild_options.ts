import path from 'node:path';

import esbuild from 'esbuild';

export type BaseEsbuildOptions = esbuild.BuildOptions & {
  bundle: true;
  entryPoints: string[];
  format: 'esm';
  target: 'es2022';
  platform: 'browser';
  charset: 'utf8';
  lineLimit: 100;
  tsconfig: string;
};

export function baseEsbuildOptions(): BaseEsbuildOptions {
  const baseDirectory = path.normalize(path.join(import.meta.dirname, '..'));
  const inputFile = path.normalize(
    path.join(baseDirectory, 'src', 'browser', 'index.ts')
  );
  const tsConfigFile = path.normalize(
    path.join(baseDirectory, 'tsconfig.esbuild.json')
  );
  return {
    bundle: true,
    entryPoints: [inputFile],
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    charset: 'utf8',
    lineLimit: 100,
    tsconfig: tsConfigFile
  };
}
