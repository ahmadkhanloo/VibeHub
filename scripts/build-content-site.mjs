import { cp, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function buildContentSite(destination = join(projectRoot, 'dist-pages')) {
  const outputRoot = resolve(destination);
  const feedRoot = join(outputRoot, 'feed');
  const contentRoot = join(projectRoot, 'content');
  await mkdir(feedRoot, { recursive: true });

  for (const name of ['apps', 'providers', 'guides', 'learning', 'schemas', 'snapshots']) {
    const source = join(contentRoot, name);
    try {
      await cp(source, join(feedRoot, name), { recursive: true, force: true });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  const offersSource = join(contentRoot, 'offers');
  const offersTarget = join(feedRoot, 'offers');
  await mkdir(offersTarget, { recursive: true });
  await cp(offersSource, offersTarget, {
    recursive: true,
    force: true,
    filter: (source) => source !== join(offersSource, 'index.json'),
  });
  await copyFile(join(offersSource, 'index.json'), join(feedRoot, 'index.json'));

  const index = JSON.parse(await readFile(join(feedRoot, 'index.json'), 'utf8'));
  if (!Array.isArray(index.apps) || !Array.isArray(index.providers) || !Array.isArray(index.offers)) {
    throw new Error('content feed index is missing required arrays');
  }

  await writeFile(
    join(outputRoot, 'index.html'),
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VibeHub content feed</title><body><h1>VibeHub content feed</h1><p>This site serves validated catalog, guide, and offer data.</p><p><a href="./feed/index.json">Open feed index</a></p></body></html>\n',
    'utf8'
  );
  await writeFile(join(outputRoot, '.nojekyll'), '', 'utf8');
  return { outputRoot, appCount: index.apps.length, providerCount: index.providers.length, offerCount: index.offers.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const destination = process.argv[2] ? resolve(process.argv[2]) : undefined;
  buildContentSite(destination)
    .then((result) => {
      process.stdout.write(`Prepared VibeHub content site: ${result.appCount} apps, ${result.providerCount} providers, ${result.offerCount} offers.\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
