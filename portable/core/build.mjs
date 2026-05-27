import esbuild from 'esbuild';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  rm,
  mkdir,
  readFile,
  writeFile,
  readdir,
  copyFile,
  cp,
  stat,
  watch,
} from 'node:fs/promises';

import {
  buildStyles,
  matchComponentsCssFiles,
} from './resolvers/classes.mjs';

import { startServer } from './server.mjs';
import { buildAssets } from './resolvers/assets.mjs';

const mode = process.argv[2] ?? 'build';
const port = Number(process.env.PORT ?? 3000);

const coreDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(coreDir, '..');
const distDir = join(rootDir, 'dist');
const publicDir = join(rootDir, 'public');
const stylesDir = join(rootDir, 'styles');
const assetsDir = join(rootDir, 'assets');
const stylesSrcDir = join(rootDir, 'src/styles');
const assetsSrcDir = join(rootDir, 'src/assets');
const distStylesDir = join(distDir, 'styles');
const distAssetsDir = join(distDir, 'assets');
const componentsDir = join(rootDir, 'src/components');

const metaPath = join(rootDir, 'meta.json');
const meta = JSON.parse(await readFile(metaPath, 'utf-8'));

async function createContext(isDev) {
  return esbuild.context({
    absWorkingDir: rootDir,
    bundle: true,
    entryPoints: ['src/main.tsx'],
    format: 'esm',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    minify: !isDev,
    outfile: join(distDir, 'app.js'),
    platform: 'browser',
    sourcemap: true,
    target: ['es2020'],
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        isDev ? 'development' : 'production'
      ),
      'process.env.API_BASE_URL': JSON.stringify(
        process.env.API_BASE_URL ?? 'http://localhost:8000'
      ),
      'process.env.API_TIMEOUT_MS': JSON.stringify(
        process.env.API_TIMEOUT_MS ?? '10000'
      ),
      'process.env.API_AUTH_HEADER': JSON.stringify(
        process.env.API_AUTH_HEADER ?? 'token'
      ),
      'process.env.ENABLE_MOCK_DATA': JSON.stringify(
        process.env.ENABLE_MOCK_DATA ?? 'false'
      )
    },
    alias: {
      '@': join(rootDir, 'src'),
      '@api': join(rootDir, 'src/api'),
      '@assets': join(rootDir, 'src/assets/assets.ts'),
      '@components': join(rootDir, 'src/components'),
      '@contexts': join(rootDir, 'src/contexts'),
      '@data': join(rootDir, 'src/data'),
      '@interfaces': join(rootDir, 'src/interfaces'),
      '@main': join(rootDir, 'src/main'),
      '@registry': join(rootDir, 'src/registry'),
      '@routes': join(rootDir, 'src/routes'),
      '@styles': join(rootDir, 'src/styles/styles.ts'),
      '@transformers': join(rootDir, 'src/transformers'),
      '@utils': join(rootDir, 'src/utils')
    }
  });
}

async function setupDist() {
  const cssDir = join(rootDir, 'styles/app');
  await matchComponentsCssFiles(componentsDir, cssDir);
  
  await buildStyles(stylesDir, stylesSrcDir, 'ts');
  await buildAssets(assetsDir, assetsSrcDir, meta.url, 'ts');

  await rm(distDir, { force: true, recursive: true });
  await mkdir(distDir, { recursive: true });
}

async function metaCopyDir(src, dst, meta) {
  const files = await readdir(src);

  for (const file of files) {
    const fstat = await stat(join(src, file));

    if (fstat.isDirectory()) {
      const dirSrc = join(src, file);
      const dirDst = join(dst, file);
      
      await mkdir(dirDst, { recursive: true });
      await metaCopyDir(dirSrc, dirDst, meta);
      continue;
    }

    const extensions = ['.html', '.css', '.js'];
    if (!extensions.some(ext => file.endsWith(ext))) {
      await copyFile(join(src, file), join(dst, file));
      continue;
    }

    let file_content = await readFile(join(src, file), 'utf-8');
    let repeats = 2;
    
    for (let i = 0; i < repeats; i++) {
      for (const key in meta) {
        file_content = file_content.replaceAll(
          `[[${key}]]`, meta[key]
        );
      }
    }

    await writeFile(join(dst, file), file_content, 'utf-8');
  }
}

async function copyPublic() {
  await mkdir(distStylesDir, { recursive: true });
  await mkdir(distAssetsDir, { recursive: true });

  await metaCopyDir(publicDir, distDir, meta);
  await metaCopyDir(stylesDir, distStylesDir, meta);
  await metaCopyDir(assetsDir, distAssetsDir, meta);
}

async function watchDir(srcDir, dstDir, codeDir, buildFn) {
  const watcher = watch(srcDir, { recursive: true });
  
  for await (const event of watcher) {
    await rm(dstDir, { force: true, recursive: true });
    await mkdir(dstDir, { recursive: true });
    
    await metaCopyDir(srcDir, dstDir, meta);
    await buildFn();
  }
}

function watchDirs() {
  watchDir(
    stylesDir,
    distStylesDir,
    stylesSrcDir,
    () => buildStyles(
      stylesDir,
      stylesSrcDir,
      'ts'
    ),
  );

  watchDir(
    assetsDir,
    distAssetsDir,
    assetsSrcDir,
    () => buildAssets(
      assetsDir,
      assetsSrcDir,
      meta.url,
      'ts'
    ),
  );
}

async function runBuild() {
  await setupDist();
  const ctx = await createContext(false);
  await ctx.rebuild();
  await ctx.dispose();
  await copyPublic();
  console.log('Build complete: dist/app.js');
}

async function runDev() {
  await setupDist();
  const ctx = await createContext(true);
  await ctx.rebuild();
  await copyPublic();
  await ctx.watch();
  watchDirs();

  const server = await startServer(distDir, port, true);

  console.log(`Dev server at http://localhost:${port}`);
  console.log('Watching for changes...');

  const shutdown = () => {
    server.close();
    ctx.dispose();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function runStart() {
  await runBuild();
  await startServer(distDir, port, false);
  console.log(`Server running at http://localhost:${port}`);
}

switch (mode) {
  case 'build':
    await runBuild();
    break;
  case 'dev':
    await runDev();
    break;
  case 'start':
    await runStart();
    break;
  default:
    console.error(`Unknown mode: ${mode}. Use: build, dev, or start`);
    process.exit(1);
}
