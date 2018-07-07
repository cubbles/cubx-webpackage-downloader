(function () {
  'use strict';

  const path = require('path');
  const axios = require('axios');
  const fs = require('fs-extra');
  const isValidPath = require('is-valid-path');
  const validUrl = require('valid-url');
  const url = require('url');

  let WebpackageDownloader = function () {
    this._axios = axios.create({ responseType: 'json' });
    this._messagePrefix = 'WebpackageDownloader:';
  };

  WebpackageDownloader.prototype.downloadWebpackages = async function (listOfWebpackagesId, targetDirectory, baseUrl) {
    if (isValidPath(targetDirectory)) {
      this.targetDirectory = targetDirectory;
    } else {
      console.error(this._messagePrefix, 'Invalid \'targetDirectory\' path.');
      throw new Error('Invalid \'targetDirectory\'');
    }
    if (validUrl.isWebUri(baseUrl)) {
      this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    } else {
      console.error(this._messagePrefix, 'Invalid \'baseUrl\' url.');
      throw new Error('Invalid \'baseUrl\'');
    }
    this._webpackageDownloadsQeue = [];
    if (this._isValidListOfWebpackages(listOfWebpackagesId)) {
      listOfWebpackagesId.forEach(function (webpackageId) {
        this._webpackageDownloadsQeue.push(this._downloadWebpackage(webpackageId));
      }.bind(this));
      try {
        await Promise.all(this._webpackageDownloadsQeue);
      } catch (error) {
        console.error(this._messagePrefix, 'Could not download webpackages: ', error);
        throw error;
      }
    } else {
      console.error(this._messagePrefix, 'Invalid \'listOfWebpackages\'. It should contain valid webpackage Ids, ' +
        'e.g., [ \'webpackage1@1.0.0\' ]');
      throw new Error('Invalid \'listOfWebpackages\'');
    }
  };

  WebpackageDownloader.prototype._downloadWebpackage = async function (webpackageId) {
    let artifactsQeue = [];
    try {
      let result = await this._fetchManifest(webpackageId);
      let manifest = result.data;
      await this._saveManifest(JSON.stringify(manifest, null, '  '), webpackageId);
      if (manifest.hasOwnProperty('artifacts')) {
        let artifacts = result.data.artifacts;
        let artifactTypes = ['apps', 'compoundComponents', 'elementaryComponents', 'utilities'];
        artifactTypes.forEach(function (key) {
          if (artifacts.hasOwnProperty(key) && artifacts[key].length > 0) {
            artifactsQeue.push(this._downloadArtifacts(artifacts[key], webpackageId));
          }
        }.bind(this));
      }
      await Promise.all(artifactsQeue);
    } catch (error) {
      console.error(this._messagePrefix, 'Could not download Artifacts for webpackage:', webpackageId, error);
      throw error;
    }
  };

  WebpackageDownloader.prototype._downloadArtifacts = async function (artifacts, webpackageId) {
    let artifactsDwonloadQeue = [];
    artifacts.forEach(function (artifact) {
      artifactsDwonloadQeue.push(this._downloadArtifact(artifact, webpackageId));
    }.bind(this));
    try {
      await Promise.all(artifactsDwonloadQeue);
    } catch (error) {
      console.error(this._messagePrefix, 'Could not download Artifacts for webpackage:', webpackageId, error);
      throw error;
    }
  };

  WebpackageDownloader.prototype._downloadArtifact = async function (artifact, webpackageId) {
    let artifactSourceUrl = this.baseUrl + webpackageId + '/' + artifact.artifactId;
    let artifactTargetUrl = path.join(this.targetDirectory, webpackageId, artifact.artifactId);
    let artifactFilesQeue = [];
    if (artifact.hasOwnProperty('runnables')) {
      artifact.runnables.forEach(function (runnable) {
        artifactFilesQeue.push(this._downloadRunnable(artifactSourceUrl, artifactTargetUrl, runnable));
      }.bind(this));
    }
    if (artifact.hasOwnProperty('resources')) {
      artifact.resources.forEach(function (resource) {
        artifactFilesQeue.push(this._downloadResource(artifactSourceUrl, artifactTargetUrl, resource));
      }.bind(this));
    }
    try {
      await Promise.all(artifactFilesQeue);
    } catch (error) {
      console.error(this._messagePrefix, 'Could not download Artifact:', artifact.artifactId, error);
      throw error;
    }
  };

  WebpackageDownloader.prototype._downloadResource = async function (artifactSourceUrl, artifactTargetPath, resource) {
    let filesToDownload = [];
    try {
      if (typeof resource === 'string') {
        filesToDownload.push(await this._downloadArtifactFile(artifactSourceUrl, artifactTargetPath, resource));
      } else if (typeof resource === 'object') {
        if (resource.hasOwnProperty('dev')) {
          filesToDownload.push(await this._downloadArtifactFile(artifactSourceUrl, artifactTargetPath, resource.dev));
        }
        if (resource.hasOwnProperty('prod')) {
          filesToDownload.push(await this._downloadArtifactFile(artifactSourceUrl, artifactTargetPath, resource.prod));
        }
      }
    } catch (error) {
      console.error(this._messagePrefix, 'Could not download resource:', resource, error);
      throw error;
    }
    return filesToDownload;
  };

  WebpackageDownloader.prototype._downloadRunnable = async function (artifactSourceUrl, artifactTargetPath, runnable) {
    if (runnable.hasOwnProperty('path')) {
      return this._downloadArtifactFile(artifactSourceUrl, artifactTargetPath, runnable.path);
    } else {
      console.error(this._messagePrefix, 'Runnable has no path property', runnable);
      throw new Error('Runnable Without Path');
    }
  };

  WebpackageDownloader.prototype._downloadArtifactFile = async function (artifactSourceUrl, artifactTargetPath, relativePath) {
    let sourceUrl = artifactSourceUrl + '/' + relativePath;
    let targetPath = artifactTargetPath + '/' + relativePath;
    try {
      let response = await this._axios.request({url: sourceUrl, responseType: 'text'});
      await this._saveFile(response.data, targetPath);
      if (relativePath.endsWith('.html')) {
        await this._downloadHtmlExternalFiles(response.data, artifactSourceUrl, artifactTargetPath, relativePath);
      }
    } catch (error) {
      console.error(this._messagePrefix, 'Error downloading a file from:', sourceUrl, error);
      throw error;
    }
  };

  WebpackageDownloader.prototype._downloadHtmlExternalFiles = async function (htmlFileContent, artifactSourceUrl, artifactTargetPath, relativePath) {
    let importPaths = htmlFileContent.match(new RegExp('(src|href)\\s*=\\s*"([^"]+)"', 'g'));
    let filesQueue = [];
    if (importPaths) {
      importPaths = importPaths.map(function (src) {
        let srcHrefAttributesRegExp = new RegExp('href=|src=|"', 'g');
        return src.replace(srcHrefAttributesRegExp, '');
      });
      importPaths = importPaths.filter(function (src) {
        let webpackageIdRegExp = new RegExp('([a-z0-9]+|([a-z0-9]+[a-z0-9-][a-z0-9]+)*)(\\.([a-z0-9]+|([a-z0-9]+[a-z0-9-][a-z0-9]+)*))*[@](\\d+)(\\.[\\d]+)*(-SNAPSHOT)?', 'g');
        let fileRegExp = new RegExp('[\\w,\\s-]+\\.[A-Za-z]{2,}$', 'g');
        return !src.match(webpackageIdRegExp) && src.match(fileRegExp);
      });
      importPaths.forEach(async function (path) {
        filesQueue.push(this._downloadArtifactFile(artifactSourceUrl, artifactTargetPath, url.resolve(relativePath, path)));
      }.bind(this));
      try {
        await Promise.all(filesQueue);
      } catch (error) {
        console.error(this._messagePrefix, 'Error downloading an external file for:', relativePath, error);
        throw error;
      }
    }
  };

  WebpackageDownloader.prototype._saveFile = async function (fileContent, targetPath) {
    try {
      await fs.ensureDir(path.dirname(targetPath));
      await fs.writeFile(targetPath, fileContent, 'utf8');
    } catch (error) {
      console.error(this._messagePrefix, 'Error saving a file to:', targetPath, error);
      throw error;
    }
  };

  WebpackageDownloader.prototype._isValidListOfWebpackages = function (listOfWebpackages) {
    let webpackageIdRegExp = /^([a-z0-9]+|([a-z0-9]+[a-z0-9-][a-z0-9]+)*)(\.([a-z0-9]+|([a-z0-9]+[a-z0-9-][a-z0-9]+)*))*[@](\d+)(\.[\d]+)*(-SNAPSHOT)?$/;
    return listOfWebpackages.every(function (webpackageId) {
      return webpackageIdRegExp.test(webpackageId);
    });
  };

  WebpackageDownloader.prototype._saveManifest = function (manifest, webpackageId) {
    return this._saveFile(manifest, path.join(this.targetDirectory, webpackageId, 'manifest.webpackage'));
  };

  WebpackageDownloader.prototype._fetchManifest = function (webpackageId) {
    return this._axios.request({ url: this.baseUrl + webpackageId + '/manifest.webpackage' });
  };

  module.exports = WebpackageDownloader;
}());
