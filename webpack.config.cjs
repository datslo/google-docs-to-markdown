'use strict';

const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv.toLocaleLowerCase() === 'production';

module.exports = {
  entry: './lib-ui/index.js',
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? 'source-map' : 'inline-source-map',
  output: {
    filename: 'bundle.js',
  },
  resolve: {
    fallback: {
      path: require.resolve('path-browserify'),
    },
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: path.resolve(__dirname, 'index.html') },
        { from: path.resolve(__dirname, 'img'), to: 'img' }
      ],
    }),
  ],
  devServer: {
    port: 9001,
    static: {
      directory: path.join(__dirname, 'dist'),
    },
  },
};
