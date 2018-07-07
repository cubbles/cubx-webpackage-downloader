# cubx-webpackage-downloader

[![Build Status](https://travis-ci.org/cubbles/cubx-webpackage-downloader.svg?branch=master)](https://travis-ci.org/cubbles/cubx-webpackage-downloader)

Module for downloading a list of webpackages.

## Usage: 
### Command line: 

```
cubx-webpackage-downloader -o <targetDirectory> -w <webpackagesIds> -b <baseUrl>
```

### Other npm modules

```javascript
let baseUrl = 'http://base.example';
let targetDirectory = 'path/to/my/local/directory'
let listOfWebpackages = [
                          "package1@1.0.0",
                          "package2@1.0.0"
                       ];

let WebpackageDownloader = require('cubx-webpackage-downloader');
let webpackageDownloader = new WebpackageDownloader();
webpackageDownloader.downloadWebpackages(listOfWebpackages, targetDirectory, baseUrl)
  .then(function () {
    console.log('Webpackages were downloaded successfully at', options.targetDirectory);
  })
  .catch(function (error) {
    console.error('The webpackages could not be downloaded.', error);
  });
```