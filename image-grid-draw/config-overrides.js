const { override, addWebpackPlugin } = require('customize-cra');
const Dotenv = require('dotenv-webpack');

module.exports = override(
  addWebpackPlugin(new Dotenv())
);
