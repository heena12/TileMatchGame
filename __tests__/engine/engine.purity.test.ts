import * as fs from 'fs';
import * as path from 'path';

const ENGINE_DIR = path.resolve(__dirname, '../../src/engine');
const FORBIDDEN =
  /^(react|react-native|react-native-.*|@react-native.*|@react-navigation.*|zustand.*)$/;
const FORBIDDEN_ALIASES = /^@(ui|state|services|app|navigation|config)(\/|$)/;

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(full) : [full];
  });
}

function importsOf(file: string): string[] {
  const src = fs.readFileSync(file, 'utf8');
  const re = /(?:from|import|require\()\s*['"]([^'"]+)['"]/g;
  return Array.from(src.matchAll(re), m => m[1] as string);
}

describe('engine purity', () => {
  const files = listFiles(ENGINE_DIR).filter(f => /\.tsx?$/.test(f));

  it('has no UI, RN, state or service imports', () => {
    const violations: string[] = [];
    for (const file of files) {
      for (const spec of importsOf(file)) {
        if (FORBIDDEN.test(spec) || FORBIDDEN_ALIASES.test(spec)) {
          violations.push(`${path.relative(ENGINE_DIR, file)} -> ${spec}`);
        } else if (spec.startsWith('.')) {
          const resolved = path.resolve(path.dirname(file), spec);
          if (!resolved.startsWith(ENGINE_DIR)) {
            violations.push(`${path.relative(ENGINE_DIR, file)} -> ${spec}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('has no .tsx files', () => {
    expect(files.filter(f => f.endsWith('.tsx'))).toEqual([]);
  });
});
