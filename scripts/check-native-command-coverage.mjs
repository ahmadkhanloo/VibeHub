import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';

const ipcPath = new URL('../apps/desktop/src/services/ipc.ts', import.meta.url);
const rustPath = new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url);

export function findUnregisteredCommands(ipcSource, rustSource) {
  const sourceFile = ts.createSourceFile('ipc.ts', ipcSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declared = new Set();
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'invoke' &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      declared.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  const handler = rustSource.match(/generate_handler!\s*\[([^\]]*)\]/s)?.[1] ?? '';
  const registered = new Set([...handler.matchAll(/\b([a-z][a-z0-9_]*)\b/g)].map((match) => match[1]));
  return [...declared].filter((command) => !registered.has(command)).sort();
}

async function main() {
  const [ipcSource, rustSource] = await Promise.all([
    readFile(ipcPath, 'utf8'),
    readFile(rustPath, 'utf8'),
  ]);
  const missing = findUnregisteredCommands(ipcSource, rustSource);
  if (missing.length) {
    process.stderr.write(`Native command coverage incomplete (${missing.length} missing): ${missing.join(', ')}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write('Every declared UI IPC command is registered by the Tauri backend.\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
