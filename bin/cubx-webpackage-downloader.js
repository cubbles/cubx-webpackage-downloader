#! /usr/bin/env node
const WebpackageDownloader = require('../lib/cubx-webpackage-downloader.js');
const commandLineArgs = require('command-line-args');
const fs = require('fs-extra');

let args = [
  {name: 'targetDirectory', type: String, alias: 'o'},
  {name: 'webpackagesIds', type: String, alias: 'w'},
  {name: 'baseUrl', type: String, alias: 'b'}
];

function parseWebpackagesIds (rootDeps) {
  try {
    rootDeps = JSON.parse(rootDeps);
    if (!Array.isArray(rootDeps)) {
      throw new TypeError('\'webpackagesIds\' is not a valid JSON list');
    }
  } catch (e) {
    rootDeps = rootDeps.split(',');
  }
  return rootDeps;
}

let options = commandLineArgs(args);

if (!options.webpackagesIds) {
  console.error('Missed necessary parameter "baseUrl". Usage: cubx-webpackage-downloader -u <webpackagesIds>');
  process.exit(0);
} else {
  try {
    if (fs.pathExists(options.webpackagesIds)) {
      options.webpackagesIds = fs.readFileSync(options.webpackagesIds, 'utf8');
      options.webpackagesIds = parseWebpackagesIds(options.webpackagesIds);
    }
  } catch (e) {
    options.webpackagesIds = parseWebpackagesIds(options.webpackagesIds);
  }
}

if (!options.targetDirectory) {
  console.error('Missed necessary parameter "baseUrl". Usage: cubx-webpackage-downloader -u <targetDirectory>');
  process.exit(0);
}

if (!options.baseUrl) {
  console.error('Missed necessary parameter "baseUrl". Usage: cubx-webpackage-downloader -u <baseUrl>');
  process.exit(0);
}

let webpackageDownloader = new WebpackageDownloader();
webpackageDownloader.downloadWebpackages(options.webpackagesIds, options.targetDirectory, options.baseUrl)
  .then(function () {
    console.log('\x1b[32m', 'Webpackages were downloaded successfully at %s.', options.targetDirectory);
  })
  .catch(function (error) {
    console.error('\x1b[31m', 'The webpackages could not be downloaded.', error);
    process.exit(0);
  });
