import fs from 'fs';
import path from 'path';
import { getBabelOutputPlugin } from '@rollup/plugin-babel';
import typescript from '@rollup/plugin-typescript';

const ROOT_DIR = path.join(__dirname, 'src');
const OUT_DIR = path.join(__dirname, 'lib');

function noPrivateFile(f) {
  return !(f + '').startsWith('.');
}

function isTsFile(f) {
  return (f + '').endsWith('ts') || (f + '').endsWith('tsx');
}

function toJsfile(f) {
  return (f + '')
    .replace(ROOT_DIR, '')
    .replace(/^\//, '')
    .replace(/\.ts[x]?$/, '.js');
}

const genConfig = (input) => ({
  input,
  output: {
    dir: OUT_DIR,
    entryFileNames: toJsfile(input),
    format: 'es',
  },
  plugins: [
    typescript({
      declaration: true,
      declarationDir: OUT_DIR,
      rootDir: ROOT_DIR,
    }),
    getBabelOutputPlugin({
      configFile: path.resolve(__dirname, 'babel.config.js'),
    }),
  ],
});

function genFileList(src, fileList = []) {
  if (!src) return [];

  fs.readdirSync(src)
    .filter(Boolean)
    .filter(noPrivateFile)
    .forEach((f) => {
      const file = path.join(src, f);
      if (fs.statSync(file).isFile()) {
        if (isTsFile(file)) fileList.push(file);
      } else {
        fileList = genFileList(file, fileList);
      }
    });
  return fileList;
}

function genConfigList() {
  return genFileList(ROOT_DIR).map(genConfig);
}

export default genConfigList;
