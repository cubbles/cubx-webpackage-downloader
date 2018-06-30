/* globals describe, beforeEach, afterEach, it, expect, before, __dirname, sinon, after */
/* eslint no-unused-expressions: "off" */
(function () {
  'use strict';
  describe('WebpackageDownloader', function () {
    const fs = require('fs-extra');
    const path = require('path');
    const baseUrl = 'https://www.example.test/';
    const listOfWebpackages = [ 'wp@0.1.0-SNAPSHOT', 'wp-two@0.1.0' ];
    const resourcesPath = path.join(__dirname, '../resources');
    const targetDirectory = path.join(resourcesPath, 'download');
    const webpackagesPath = path.join(resourcesPath, 'webpackages');
    let WebpackageDownloader = require('../../lib/cubx-webpackage-downloader.js');
    let webpackageDownloader;
    let wpManifest;
    let wpTwoManifest;
    before(function () {
      fs.emptyDir(targetDirectory);
      wpManifest = fs.readFileSync(path.join(webpackagesPath, 'wp', 'manifest.webpackage'), 'utf8');
      wpTwoManifest = fs.readFileSync(path.join(webpackagesPath, 'wp-two', 'manifest.webpackage'), 'utf8');
    });
    describe('#_fetchManifest()', function () {
      let axiosStub;
      let webpackageId = 'my-wp@0.1.0-SNAPSHOT';
      before(function () {
        webpackageDownloader = new WebpackageDownloader();
        webpackageDownloader.baseUrl = baseUrl;
        axiosStub = sinon.stub(webpackageDownloader._axios, 'request').callsFake(function (url) {
          return new Promise(function (resolve, reject) {
            setTimeout(function () {
              resolve();
            }, 100);
          });
        });
      });
      it('should call _axios.request method with correctUrl', function (done) {
        webpackageDownloader._fetchManifest(webpackageId)
          .then(function () {
            expect(axiosStub.calledWith({url: baseUrl + webpackageId + '/manifest.webpackage'})).to.be.equal(true);
            done();
          })
          .catch(function (error) {
            console.log('Unexpected error in axios request', error);
          });
      });
      it('should return a promise', function () {
        let promise = webpackageDownloader._fetchManifest(webpackageId);
        expect(promise).to.be.an.instanceOf(Promise);
      });
      after(function () {
        axiosStub.restore();
      });
    });
    describe('#_saveManifest()', function () {
      let _saveFileStub;
      let webpackageId = 'wp@0.1.0-SNAPSHOT';
      before(function () {
        webpackageDownloader = new WebpackageDownloader();
        webpackageDownloader.targetDirectory = targetDirectory;
        _saveFileStub = sinon.stub(webpackageDownloader, '_saveFile').callsFake(function (fileContent, targetPath) {
          return new Promise(function (resolve, reject) {
            setTimeout(function () {
              resolve();
            }, 100);
          });
        });
      });
      it('should call _saveFile method with manifestContent and correctTargetPath', function () {
        webpackageDownloader._saveManifest(wpManifest, webpackageId);
        expect(_saveFileStub.calledWith(wpManifest, path.join(targetDirectory, webpackageId, 'manifest.webpackage'))).to.be.equal(true);
      });
      after(function () {
        _saveFileStub.restore();
      });
    });
    describe('#_isValidListOfWebpackages', function () {
      before(function () {
        webpackageDownloader = new WebpackageDownloader();
      });
      it('should return true since the lis of webpackages is valid', function () {
        expect(webpackageDownloader._isValidListOfWebpackages(listOfWebpackages)).to.be.equal(true);
      });
      it('should return false since the lis of webpackages is invalid', function () {
        expect(webpackageDownloader._isValidListOfWebpackages(['wp@1.0.0', 'wp@Snap', 'wp1..0.0'])).to.be.equal(false);
      });
    });
    describe('#_saveFile', function () {
      let consoleSpy;
      before(function () {
        webpackageDownloader = new WebpackageDownloader();
      });
      beforeEach(function () {
        consoleSpy = sinon.spy(console, 'error');
      });
      afterEach(function () {
        consoleSpy.restore();
      });
      it('should save the content in the given url', function (done) {
        let targetUrl = path.join(targetDirectory, 'savedFile', 'file.json');
        webpackageDownloader._saveFile(wpManifest, targetUrl)
          .then(function () {
            expect(fs.existsSync(targetUrl)).to.be.equal(true);
            done();
          });
      });
      it('should reject and log an error since url is invalid', function (done) {
        webpackageDownloader._saveFile(wpManifest, undefined)
          .catch(function () {
            expect(consoleSpy).to.be.calledOnce;
            done();
          });
      });
    });
    describe('#_downloadArtifactFile()', function () {
      let _saveFileStub;
      let axiosStub;
      let consoleSpy;
      before(function () {
        webpackageDownloader = new WebpackageDownloader();
        webpackageDownloader.targetDirectory = targetDirectory;
      });
      beforeEach(function () {
        consoleSpy = sinon.spy(console, 'error');
        axiosStub = sinon.stub(webpackageDownloader._axios, 'request').callsFake(function (requestObject) {
          return new Promise(function (resolve, reject) {
            setTimeout(function () {
              if (requestObject.url.indexOf('wrongUrl') > -1) {
                reject(new Error('Error in axios request'));
              }
              resolve(wpManifest);
            }, 100);
          });
        });
        _saveFileStub = sinon.stub(webpackageDownloader, '_saveFile').callsFake(function (fileContent, targetPath) {
          return new Promise(function (resolve, reject) {
            setTimeout(function () {
              if (targetPath.indexOf('wrongUrl') > -1) {
                reject(new Error('Error in _saveFile'));
              }
              resolve();
            }, 100);
          });
        });
      });
      afterEach(function () {
        consoleSpy.restore();
        _saveFileStub.restore();
        axiosStub.restore();
      });
      it('should call _saveFile and axios request methods', function (done) {
        let artifactSourceUrl = baseUrl + '/wp@1.0.0/my-artifact';
        let artifactTargetPath = targetDirectory + '/wp@1.0.0/my-artifact';
        let relativePath = 'myDir/myFile.js';
        webpackageDownloader._downloadArtifactFile(artifactSourceUrl, artifactTargetPath, relativePath)
          .then(function () {
            expect(axiosStub.calledWith({url: artifactSourceUrl + '/' + relativePath, responseType: 'text'})).to.be.equal(true);
            expect(_saveFileStub.calledWith(wpManifest, artifactTargetPath + '/' + relativePath)).to.be.equal(true);
            done();
          });
      });
      it('should log and throw an error since axios request rejects', function (done) {
        let artifactSourceUrl = 'wrongUrl';
        let artifactTargetPath = targetDirectory + '/wp@1.0.0/my-artifact';
        let relativePath = 'myDir/myFile.js';
        webpackageDownloader._downloadArtifactFile(artifactSourceUrl, artifactTargetPath, relativePath)
          .catch(function () {
            expect(consoleSpy).to.be.calledOnce;
            done();
          });
      });
      it('should log and throw an error since _saveFile rejects', function (done) {
        let artifactSourceUrl = baseUrl + '/wp@1.0.0/my-artifact';
        let artifactTargetPath = 'wrongUrl';
        let relativePath = 'myDir/myFile.js';
        webpackageDownloader._downloadArtifactFile(artifactSourceUrl, artifactTargetPath, relativePath)
          .catch(function () {
            expect(consoleSpy).to.be.calledOnce;
            done();
          });
      });
    });
    describe('#_downloadRunnable()', function () {
      let _downloadArtifactFileStub;
      let consoleSpy;
      before(function () {
        webpackageDownloader = new WebpackageDownloader();
        webpackageDownloader.targetDirectory = targetDirectory;
      });
      beforeEach(function () {
        consoleSpy = sinon.spy(console, 'error');
        _downloadArtifactFileStub = sinon.stub(webpackageDownloader, '_downloadArtifactFile').callsFake(
          function (artifactSourceUrl, artifactTargetPath, relativePath) {
            return new Promise(function (resolve, reject) {
              setTimeout(function () {
                resolve();
              }, 100);
            });
          });
      });
      afterEach(function () {
        _downloadArtifactFileStub.restore();
        consoleSpy.restore();
      });
      it('should call _downloadArtifactFile method', function (done) {
        let artifactSourceUrl = baseUrl + '/wp@1.0.0/my-artifact';
        let artifactTargetPath = targetDirectory + '/wp@1.0.0/my-artifact';
        let runnable = { path: 'myDir/myFile.js' };
        webpackageDownloader._downloadRunnable(artifactSourceUrl, artifactTargetPath, runnable)
          .then(function () {
            expect(_downloadArtifactFileStub.calledWith(artifactSourceUrl, artifactTargetPath, runnable.path)).to.be.equal(true);
            done();
          });
      });
      it('should throw an error since runnable path is not available', function (done) {
        let artifactSourceUrl = baseUrl + '/wp@1.0.0/my-artifact';
        let artifactTargetPath = targetDirectory + '/wp@1.0.0/my-artifact';
        let runnable = 'myDir/myFile.js';
        webpackageDownloader._downloadRunnable(artifactSourceUrl, artifactTargetPath, runnable)
          .catch(function () {
            expect(consoleSpy).to.be.calledOnce;
            done();
          });
      });
    });
    describe('#_downloadResource()', function () {
      let _downloadArtifactFileStub;
      let consoleSpy;
      before(function () {
        webpackageDownloader = new WebpackageDownloader();
      });
      beforeEach(function () {
        consoleSpy = sinon.spy(console, 'error');
        _downloadArtifactFileStub = sinon.stub(webpackageDownloader, '_downloadArtifactFile').callsFake(
          function (artifactSourceUrl, artifactTargetPath, relativePath) {
            return new Promise(function (resolve, reject) {
              setTimeout(function () {
                if (relativePath === 'invalidPath') {
                  reject(new Error('Invalid path'));
                }
                resolve();
              }, 100);
            });
          });
      });
      afterEach(function () {
        _downloadArtifactFileStub.restore();
        consoleSpy.restore();
      });
      it('should call _downloadArtifactFile method for a resource that is a string', function (done) {
        let artifactSourceUrl = baseUrl + 'wp@1.0.0/my-artifact';
        let artifactTargetPath = targetDirectory + '/wp@1.0.0/my-artifact';
        let resource = '/my/resource.js';
        webpackageDownloader._downloadResource(artifactSourceUrl, artifactTargetPath, resource).then(function () {
          expect(_downloadArtifactFileStub.calledWith(artifactSourceUrl, artifactTargetPath, resource)).to.be.equal(true);
          done();
        });
      });
      it('should call _downloadArtifactFile method for a resource that is an object', function (done) {
        let artifactSourceUrl = baseUrl + 'wp@1.0.0/my-artifact';
        let artifactTargetPath = targetDirectory + '/wp@1.0.0/my-artifact';
        let resource = { dev: '/my/resource.js', prod: '/my/resource.min.js' };
        webpackageDownloader._downloadResource(artifactSourceUrl, artifactTargetPath, resource)
          .then(function () {
            expect(_downloadArtifactFileStub.calledWith(artifactSourceUrl, artifactTargetPath, resource.dev)).to.be.equal(true);
            expect(_downloadArtifactFileStub.calledWith(artifactSourceUrl, artifactTargetPath, resource.prod)).to.be.equal(true);
            done();
          });
      });
      it('should throw and log an error since _downloadArtifactFile rejects', function (done) {
        let artifactSourceUrl = baseUrl + 'wp@1.0.0/my-artifact';
        let artifactTargetPath = targetDirectory + '/wp@1.0.0/my-artifact';
        let resource = 'invalidPath';
        webpackageDownloader._downloadResource(artifactSourceUrl, artifactTargetPath, resource)
          .catch(function (error) {
            expect(error.message).to.match(/Invalid path/);
            expect(consoleSpy).to.be.calledOnce;
            done();
          });
      });
    });
    describe('#_downloadArtifact', function () {
      let _downloadRunnableStub;
      let _downloadResourceStub;
      let consoleSpy;
      let webpackageId;
      let wpManifestJson;
      before(function () {
        wpManifestJson = JSON.parse(wpManifest);
        webpackageId = wpManifestJson.name + '@' + wpManifestJson.version;
        webpackageDownloader = new WebpackageDownloader();
        webpackageDownloader.targetDirectory = targetDirectory;
        webpackageDownloader.baseUrl = baseUrl;
      });
      beforeEach(function () {
        consoleSpy = sinon.spy(console, 'error');
        _downloadRunnableStub = sinon.stub(webpackageDownloader, '_downloadRunnable').callsFake(
          function (artifactSourceUrl, artifactTargetUrl, runnable) {
            return new Promise(function (resolve, reject) {
              setTimeout(function () {
                if (artifactSourceUrl.indexOf('invalidPath') > -1) {
                  reject(new Error('Invalid path'));
                }
                resolve();
              }, 100);
            });
          });
        _downloadResourceStub = sinon.stub(webpackageDownloader, '_downloadResource').callsFake(
          function (artifactSourceUrl, artifactTargetUrl, resource) {
            return new Promise(function (resolve, reject) {
              setTimeout(function () {
                if (artifactTargetUrl.indexOf('invalidPath') > -1) {
                  reject(new Error('Invalid path'));
                }
                resolve();
              }, 100);
            });
          });
      });
      afterEach(function () {
        _downloadRunnableStub.restore();
        _downloadResourceStub.restore();
        consoleSpy.restore();
      });
      it('should call _downloadRunnable and _downloadResource methods', function (done) {
        let artifact = wpManifestJson.artifacts.elementaryComponents[0];
        let artifactSourceUrl = baseUrl + webpackageId + '/' + artifact.artifactId;
        let artifactTargetPath = targetDirectory + '/' + webpackageId + '/' + artifact.artifactId;
        webpackageDownloader._downloadArtifact(artifact, webpackageId)
          .then(function () {
            expect(_downloadRunnableStub).to.have.callCount(2);
            expect(_downloadRunnableStub.calledWith(artifactSourceUrl, artifactTargetPath, artifact.runnables[0])).to.be.equal(true);
            expect(_downloadRunnableStub.calledWith(artifactSourceUrl, artifactTargetPath, artifact.runnables[1])).to.be.equal(true);
            expect(_downloadResourceStub).to.be.calledOnce;
            expect(_downloadResourceStub.calledWith(artifactSourceUrl, artifactTargetPath, artifact.resources[0])).to.be.equal(true);
            done();
          });
      });
      it('should call _downloadRunnable but not _downloadResource', function (done) {
        let artifact = wpManifestJson.artifacts.apps[0];
        let artifactSourceUrl = baseUrl + webpackageId + '/' + artifact.artifactId;
        let artifactTargetPath = targetDirectory + '/' + webpackageId + '/' + artifact.artifactId;
        webpackageDownloader._downloadArtifact(artifact, webpackageId)
          .then(function () {
            expect(_downloadResourceStub).to.have.callCount(0);
            expect(_downloadRunnableStub).to.be.calledOnce;
            expect(_downloadRunnableStub.calledWith(artifactSourceUrl, artifactTargetPath, artifact.runnables[0])).to.be.equal(true);
            done();
          });
      });
      it('should call _downloadResource but not _downloadRunnable', function (done) {
        let artifact = wpManifestJson.artifacts.utilities[0];
        let artifactSourceUrl = baseUrl + webpackageId + '/' + artifact.artifactId;
        let artifactTargetPath = targetDirectory + '/' + webpackageId + '/' + artifact.artifactId;
        webpackageDownloader._downloadArtifact(artifact, webpackageId)
          .then(function () {
            expect(_downloadRunnableStub).to.have.callCount(0);
            expect(_downloadResourceStub).to.be.calledOnce;
            expect(_downloadResourceStub.calledWith(artifactSourceUrl, artifactTargetPath, artifact.resources[0])).to.be.equal(true);
            done();
          });
      });
      it('should throw and log an error since _downloadRunnable rejects', function (done) {
        let artifact = wpManifestJson.artifacts.elementaryComponents[0];
        webpackageDownloader.baseUrl = 'invalidPath';
        webpackageDownloader._downloadArtifact(artifact, webpackageId)
          .catch(function (error) {
            expect(error.message).to.match(/Invalid path/);
            expect(consoleSpy).to.be.calledOnce;
            done();
          });
      });
      it('should throw and log an error since _downloadResource rejects', function (done) {
        let artifact = wpManifestJson.artifacts.elementaryComponents[0];
        webpackageDownloader.targetDirectory = 'invalidPath';
        webpackageDownloader._downloadArtifact(artifact, webpackageId)
          .catch(function (error) {
            expect(error.message).to.match(/Invalid path/);
            expect(consoleSpy).to.be.calledOnce;
            done();
          });
      });
    });
    describe('#_downloadArtifacts', function () {
      let _downloadArtifactStub;
      let consoleSpy;
      let webpackageId;
      let wpManifestJson;
      before(function () {
        wpManifestJson = JSON.parse(wpManifest);
        webpackageId = wpManifestJson.name + '@' + wpManifestJson.version;
        webpackageDownloader = new WebpackageDownloader();
      });
      beforeEach(function () {
        consoleSpy = sinon.spy(console, 'error');
        _downloadArtifactStub = sinon.stub(webpackageDownloader, '_downloadArtifact').callsFake(
          function (artifact, webpackageId) {
            return new Promise(function (resolve, reject) {
              setTimeout(function () {
                if (webpackageId.indexOf('invalidWpId') > -1) {
                  reject(new Error('Invalid WpId'));
                }
                resolve();
              }, 100);
            });
          });
      });
      afterEach(function () {
        _downloadArtifactStub.restore();
        consoleSpy.restore();
      });
      it('should call _downloadArtifact', function (done) {
        let artifacts = wpManifestJson.artifacts.apps;
        webpackageDownloader._downloadArtifacts(artifacts, webpackageId)
          .then(function () {
            expect(_downloadArtifactStub).to.have.callCount(2);
            expect(_downloadArtifactStub.calledWith(artifacts[0], webpackageId)).to.be.equal(true);
            expect(_downloadArtifactStub.calledWith(artifacts[1], webpackageId)).to.be.equal(true);
            done();
          });
      });
      it('should throw and log an error since _downloadArtifact rejects', function (done) {
        let artifacts = wpManifestJson.artifacts.elementaryComponents;
        webpackageDownloader._downloadArtifacts(artifacts, 'invalidWpId')
          .catch(function (error) {
            expect(error.message).to.match(/Invalid WpId/);
            expect(consoleSpy).to.be.calledOnce;
            done();
          });
      });
    });
    describe('#_downloadWebpackage', function () {
      let _fetchManifestStub;
      let _saveManifestStub;
      let _downloadArtifactsStub;
      let consoleSpy;
      let webpackageId;
      let webpackageIdTwo;
      let wpManifestJson;
      let wpTwoManifestJson;
      before(function () {
        wpManifestJson = JSON.parse(wpManifest);
        wpTwoManifestJson = JSON.parse(wpTwoManifest);
        webpackageId = wpManifestJson.name + '@' + wpManifestJson.version;
        webpackageIdTwo = wpTwoManifestJson.name + '@' + wpTwoManifestJson.version;
        webpackageDownloader = new WebpackageDownloader();
      });
      beforeEach(function () {
        consoleSpy = sinon.spy(console, 'error');
        _fetchManifestStub = sinon.stub(webpackageDownloader, '_fetchManifest').callsFake(
          function (wpId) {
            return new Promise(function (resolve, reject) {
              setTimeout(function () {
                let manifest;
                switch (wpId) {
                  case webpackageId:
                    manifest = wpManifestJson;
                    break;
                  case webpackageIdTwo:
                    manifest = wpTwoManifestJson;
                    break;
                  case 'propagateInvalidManifest':
                    manifest = 'invalidManifest';
                    break;
                  case 'propagateInvalidArtifacts':
                    manifest = wpTwoManifestJson;
                    break;
                  case 'invalidWpId':
                    reject(new Error('Invalid WpId'));
                    break;
                }
                resolve({ data: manifest });
              }, 100);
            });
          });
        _saveManifestStub = sinon.stub(webpackageDownloader, '_saveManifest').callsFake(
          function (manifest, webpackageId) {
            return new Promise(function (resolve, reject) {
              setTimeout(function () {
                if (typeof manifest === 'string' && manifest.indexOf('invalidManifest') > -1) {
                  reject(new Error('Invalid Manifest'));
                }
                resolve();
              }, 100);
            });
          });
        _downloadArtifactsStub = sinon.stub(webpackageDownloader, '_downloadArtifacts').callsFake(
          function (artifacts, webpackageId) {
            return new Promise(function (resolve, reject) {
              setTimeout(function () {
                if (webpackageId.indexOf('propagateInvalidArtifacts') > -1) {
                  reject(new Error('Invalid Artifacts'));
                }
                resolve();
              }, 100);
            });
          });
      });
      afterEach(function () {
        _fetchManifestStub.restore();
        _saveManifestStub.restore();
        _downloadArtifactsStub.restore();
        consoleSpy.restore();
      });
      it('should call _fetchManifest, _saveManifest and _downloadArtifacts', function (done) {
        let artifacts = wpManifestJson.artifacts;
        webpackageDownloader._downloadWebpackage(webpackageId)
          .then(function () {
            expect(_fetchManifestStub).to.be.calledOnce;
            expect(_fetchManifestStub.calledWith(webpackageId)).to.be.equal(true);
            expect(_saveManifestStub).to.be.calledOnce;
            expect(_saveManifestStub.calledWith(wpManifestJson, webpackageId)).to.be.equal(true);
            expect(_downloadArtifactsStub).to.have.callCount(4);
            expect(_downloadArtifactsStub.calledWith(artifacts.apps, webpackageId)).to.be.equal(true);
            expect(_downloadArtifactsStub.calledWith(artifacts.elementaryComponents, webpackageId)).to.be.equal(true);
            expect(_downloadArtifactsStub.calledWith(artifacts.compoundComponents, webpackageId)).to.be.equal(true);
            expect(_downloadArtifactsStub.calledWith(artifacts.utilities, webpackageId)).to.be.equal(true);
            done();
          });
      });
      it('should only download elementaryComponents since there are no more artifacts', function (done) {
        let artifacts = wpTwoManifestJson.artifacts;
        webpackageDownloader._downloadWebpackage(webpackageIdTwo)
          .then(function () {
            expect(_downloadArtifactsStub).to.be.calledOnce;
            expect(_downloadArtifactsStub.calledWith(artifacts.elementaryComponents, webpackageIdTwo)).to.be.equal(true);
            done();
          });
      });
      it('should throw and log an error since _fetchManifest rejects', function (done) {
        webpackageDownloader._downloadWebpackage('invalidWpId')
          .catch(function (error) {
            expect(error.message).to.match(/Invalid WpId/);
            expect(consoleSpy).to.be.calledOnce;
            done();
          });
      });
      it('should throw and log an error since _saveManifest rejects', function (done) {
        webpackageDownloader._downloadWebpackage('propagateInvalidManifest')
          .catch(function (error) {
            expect(error.message).to.match(/Invalid Manifest/);
            expect(consoleSpy).to.be.calledOnce;
            done();
          });
      });
      it('should throw and log an error since _downloadArtifacts rejects', function (done) {
        webpackageDownloader._downloadWebpackage('propagateInvalidArtifacts')
          .catch(function (error) {
            expect(error.message).to.match(/Invalid Artifacts/);
            expect(consoleSpy).to.be.calledOnce;
            done();
          });
      });
    });
    describe('#_downloadWebpackages', function () {
      let _downloadWebpackageStub;
      let _isValidListOfWebpackagesStub;
      let consoleSpy;
      let webpackageId;
      let webpackageIdTwo;
      let wpManifestJson;
      let wpTwoManifestJson;
      before(function () {
        wpManifestJson = JSON.parse(wpManifest);
        wpTwoManifestJson = JSON.parse(wpTwoManifest);
        webpackageId = wpManifestJson.name + '@' + wpManifestJson.version;
        webpackageIdTwo = wpTwoManifestJson.name + '@' + wpTwoManifestJson.version;
        webpackageDownloader = new WebpackageDownloader();
      });
      beforeEach(function () {
        consoleSpy = sinon.spy(console, 'error');
        _downloadWebpackageStub = sinon.stub(webpackageDownloader, '_downloadWebpackage').callsFake(
          function (wpId) {
            return new Promise(function (resolve, reject) {
              setTimeout(function () {
                if (wpId === 'invalidWpId') {
                  reject(new Error('Invalid WpId'));
                }
                resolve();
              }, 100);
            });
          });
        _isValidListOfWebpackagesStub = sinon.stub(webpackageDownloader, '_isValidListOfWebpackages').callsFake(
          function (listOfWebpackagesId) {
            return listOfWebpackagesId !== 'invalidList';
          });
      });
      afterEach(function () {
        _downloadWebpackageStub.restore();
        _isValidListOfWebpackagesStub.restore();
        consoleSpy.restore();
      });
      it('should call _isValidListOfWebpackages and _downloadWebpackage and initialisation should be right', function (done) {
        let listOfWps = [webpackageId, webpackageIdTwo];
        webpackageDownloader.downloadWebpackages(listOfWps, targetDirectory, baseUrl)
          .then(function () {
            expect(webpackageDownloader.targetDirectory).to.be.equal(targetDirectory);
            expect(webpackageDownloader.baseUrl).to.be.equal(baseUrl);
            expect(webpackageDownloader._webpackageDownloadsQeue.length).to.be.equal(2);
            expect(_isValidListOfWebpackagesStub).to.be.calledOnce;
            expect(_isValidListOfWebpackagesStub.calledWith(listOfWps)).to.be.equal(true);
            expect(_downloadWebpackageStub).to.have.callCount(2);
            expect(_downloadWebpackageStub.calledWith(webpackageId)).to.be.equal(true);
            expect(_downloadWebpackageStub.calledWith(webpackageIdTwo)).to.be.equal(true);
            done();
          });
      });
      it('should throw and log an error since _isValidListOfWebpackages returns false', function (done) {
        webpackageDownloader.downloadWebpackages('invalidList', targetDirectory, baseUrl)
          .catch(function (error) {
            expect(error.message).to.match(/Invalid 'listOfWebpackages'/);
            expect(consoleSpy).to.be.calledOnce;
            done();
          });
      });
      it('should throw and log an error since _downloadWebpackage rejects', function (done) {
        webpackageDownloader.downloadWebpackages([ 'invalidWpId' ], targetDirectory, baseUrl)
          .catch(function (error) {
            expect(error.message).to.match(/Invalid WpId/);
            expect(consoleSpy).to.be.calledOnce;
            done();
          });
      });
    });
  });
})();
