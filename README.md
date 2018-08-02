# cubx-webpackage-downloader

[![Build Status](https://travis-ci.org/cubbles/cubx-webpackage-downloader.svg?branch=master)](https://travis-ci.org/cubbles/cubx-webpackage-downloader)

Module for downloading a list of webpackages.

## Usage: 
### Command line: 

```
cubx-webpackage-downloader -o <outputDirectory> -w <webpackagesIds> -b <baseUrl>
```

#### Parameters

* `-o` or `--outputDirectory`: local target directory for downloaded webpackage
* `-w` or `webpackagesIds`: list of webpackages to be requested. Can be:
  * Comma-separated list of webpackages 
  * a reference to a .json file with a list of webpackages
  * inline JSON list of webpackages
* `-b` or `--baseUrl`: base URL to use 

### Other npm modules

```javascript
let baseUrl = 'http://base.example';
let outputDirectory = 'path/to/my/local/directory';
let listOfWebpackages = [
                          "package1@1.0.0",
                          "package2@1.0.0"
                       ];

let WebpackageDownloader = require('cubx-webpackage-downloader');
let webpackageDownloader = new WebpackageDownloader();
webpackageDownloader.downloadWebpackages(listOfWebpackages, outputDirectory, baseUrl)
  .then(function () {
    console.log('Webpackages were downloaded successfully at', options.outputDirectory);
  })
  .catch(function (error) {
    console.error('The webpackages could not be downloaded.', error);
  });
```