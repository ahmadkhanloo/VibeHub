import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const PRERELEASE_NOTICE = [
  '> **Prerelease:** this build is for testing. It is not the current stable release.',
  '> **پیش‌انتشار:** این نسخه برای آزمایش است و نسخهٔ پایدار فعلی نیست.',
].join('\n');

export function renderReleaseBody(template, {tag, version, prerelease, generatedNotes = ''}) {
  const rendered = template
    .replaceAll('{{TAG}}', tag)
    .replaceAll('{{VERSION}}', version)
    .replaceAll('{{PRERELEASE_NOTICE}}', prerelease ? PRERELEASE_NOTICE : '')
    .replaceAll('{{GENERATED_NOTES}}', generatedNotes.trim())
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  if (/\{\{[A-Z_]+\}\}/.test(rendered)) throw Error('Release body has an unresolved placeholder');
  return rendered.endsWith('\n') ? rendered : `${rendered}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [templatePath, outputPath, tag, version, prereleaseValue, notesPath] = process.argv.slice(2);
  if (!templatePath || !outputPath || !tag || !version || !prereleaseValue || !notesPath) {
    throw Error('Usage: render-release-body.mjs <template> <output> <tag> <version> <prerelease> <notes-file>');
  }
  const template = readFileSync(templatePath, 'utf8');
  const generatedNotes = readFileSync(notesPath, 'utf8');
  writeFileSync(outputPath, renderReleaseBody(template, {tag, version, prerelease: prereleaseValue === 'true', generatedNotes}));
}
