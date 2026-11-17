// Guards against mojibake: UTF-8 text that was read as Windows-1252 and saved
// again (for example by PowerShell 5.1 Get-Content/Set-Content). That turns a
// check mark or an em dash into two or three unrelated Latin characters inside
// user-facing strings.
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
// Built from char codes so this file never contains the sequences it hunts for.
const seq = (...codes: number[]) => String.fromCharCode(...codes);
const MOJIBAKE_SEQUENCES = [
  seq(0xe2, 0x20ac), // start of an em dash, curly quote or bullet
  seq(0xe2, 0x153), // start of a check mark or cross
  seq(0xe2, 0x161), // start of a warning sign
  seq(0xf0, 0x178), // start of an emoji
];
const ACCENT_MOJIBAKE = new RegExp(`${seq(0xc3)}[${seq(0x80)}-${seq(0xbf)}]`);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    return /\.(ts|tsx|json)$/.test(entry.name) ? [full] : [];
  });
}

test('no source file contains mojibake or a byte-order mark', () => {
  const files = [path.join(ROOT, 'App.tsx'), ...sourceFiles(path.join(ROOT, 'src')), ...sourceFiles(path.join(ROOT, 'modules'))];
  const bad = files.filter((file) => {
    const text = fs.readFileSync(file, 'utf8');
    return (
      text.charCodeAt(0) === 0xfeff ||
      MOJIBAKE_SEQUENCES.some((s) => text.includes(s)) ||
      ACCENT_MOJIBAKE.test(text)
    );
  });
  expect(bad.map((f) => path.relative(ROOT, f))).toEqual([]);
});
