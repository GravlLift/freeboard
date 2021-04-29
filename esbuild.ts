import glob from 'glob';
import esbuild from 'esbuild';
import path from 'path';
// const { sassPlugin } = require('esbuild-sass-plugin');

const argumentObj: { [key: string]: string | boolean } = {};
for (const arg of process.argv.slice(2)) {
  const parts = arg.split('=', 2);
  if (parts.length == 2) {
    argumentObj[parts[0].replace('--', '')] = parts[1];
  } else {
    argumentObj[parts[0].replace('--', '')] = true;
  }
}

esbuild.build({
  entryPoints: {
    freeboard: './js/Scripts/index.ts',
    styles: './Assets/Styles/styles.scss',
  },
  outdir: 'dist',
  target: 'ES2020',
  bundle: true,
  minify: argumentObj.mode !== 'development',
  sourcemap: argumentObj.mode === 'development',
  format: 'esm',
  plugins: [
    // sassPlugin({
    //   sourceMap: argumentObj.mode === 'development',
    // }),
  ],
  loader: {
    '.eot': 'file',
    '.woff': 'file',
    '.ttf': 'file',
    '.otf': 'file',
    '.png': 'file',
    '.svg': 'file',
  },
});
console.debug('out');
