(function () {
  'use strict';

  const path = require('path');
  const axios = require('axios');
  const fs = require('fs-extra');

  let WebpackageDownloader = function () {
    this._axios = axios.create({ responseType: 'json' });
    this._messagePrefix = 'WebpackageDownloader:';
  };

  WebpackageDownloader.prototype.downloadWebpackages = async function (listOfWebpackagesId, targetDirectory, baseUrl) {
    this.targetDirectory = targetDirectory;
    this._webpackageDownloadsQeue = [];
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
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
      console.error(this._messagePrefix, 'Invalid \'listOfWebpackages.json\'. It should contain valid webpackage Ids, ' +
        'e.g., webpackage1@1.0.0');
    }
  };

  WebpackageDownloader.prototype._downloadWebpackage = async function (webpackageId) {
    let artifactsQeue = [];
    try {
      let result = await this._fetchManifest(webpackageId);
      let manifest = result.data;
      this._saveManifest(manifest, webpackageId);
      if (manifest.hasOwnProperty('artifacts')) {
        let artifacts = result.data.artifacts;
        let artifactTypes = ['apps', 'compoundComponents', 'elementaryComponents', 'utilities'];
        artifactTypes.forEach(function (key) {
          if (artifacts.hasOwnProperty(key) && artifacts[key].length > 0) {
            artifactsQeue.push(this._downloadArtifacts(artifacts[key], webpackageId));
          }
        }.bind(this));
      }
      try {
        await Promise.all(artifactsQeue);
      } catch (error) {
        console.error(this._messagePrefix, 'Could not download Artifacts for webpackage:', webpackageId, error);
        throw error;
      }
    } catch (error) {
      console.error(this._messagePrefix, 'Error fetching manifest for:', webpackageId, error);
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
    if (typeof resource === 'string') {
      filesToDownload.push(await this._downloadArtifactFile(artifactSourceUrl, artifactTargetPath, resource));
    } else if (typeof resource === 'object') {
      if (resource.hasOwnProperty('dev')) {
        filesToDownload.push(await this._downloadArtifactFile(artifactSourceUrl, artifactTargetPath, resource.dev));
      }
      if (resource.hasOwnProperty('prod')) {
        filesToDownload.push(await this._downloadArtifactFile(artifactSourceUrl, artifactTargetPath, resource.prod));
      }
    } else {
      console.error(
        this._messagePrefix,
        'Invalid resource. It should be a path or an object with \'prod\' and \'dev\' paths.',
        resource
      );
      throw new Error('Invalid resource');
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
      await this._saveFile(response, targetPath);
    } catch (error) {
      console.error(this._messagePrefix, 'Error downloading a file from:', sourceUrl, error);
      throw error;
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
    let webpackageIdRegExp = /^([a-z0-9]+||([a-z0-9]+[a-z0-9-][a-z0-9]+)*)(\.([a-z0-9]+||([a-z0-9]+[a-z0-9-][a-z0-9]+)*))*[@](\d+)(\.[\d]+)*(-SNAPSHOT)?$/;
    return listOfWebpackages.every(function (webpackageId) {
      return webpackageIdRegExp.test(webpackageId);
    });
  };

  WebpackageDownloader.prototype._saveManifest = function (manifest, webpackageId) {
    this._saveFile(manifest, path.join(this.targetDirectory, webpackageId, 'manifest.webpackage'));
  };

  WebpackageDownloader.prototype._fetchManifest = function (webpackageId) {
    return this._axios.request({ url: this.baseUrl + webpackageId + '/manifest.webpackage' });
  };

  module.exports = WebpackageDownloader;
}());
