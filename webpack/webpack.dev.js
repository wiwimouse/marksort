const path = require('path');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');

const srcDir = path.join(__dirname, '..', 'src');

module.exports = merge(common, {
  entry: {
    background: [path.join(srcDir, 'shared/hot-reload.js'), path.join(srcDir, 'background.ts')],
  },
  devtool: 'inline-source-map',
  mode: 'development',
});
