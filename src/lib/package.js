"use strict";

var fs = require("fs");
var path = require("path");
var request = require("request-promise-native");
const request_streaming = require("request");
var yauzl = require("yauzl");
var mkdirp = require("mkdirp");
const util = require("util");
const rimraf = require("rimraf");

/**
 * need source repo url
 * call https://developer.github.com/v3/repos/releases/#get-the-latest-release
 * check published_at
 * if it's after stored value, download it!
 */

module.exports = function Package(_attrs) {
  var self = this;

  this.repo = _attrs.repo;
  this.dest = _attrs.dest;
  this.updated_at = _attrs.updated_at;
  this.downloaded = false;
  this.url = "https://api.github.com/repos/" + self.repo + "/releases/latest";

  if ( typeof(this.updated_at) === "undefined" ) {
    this.updated_at = new Date(0);
  }

  if ( typeof(_attrs.log) === "undefined" ) {
    _attrs.log = function() {};
  }

  this.logger = _attrs.log;
  
  this.defaultHeaders = {
    "User-Agent": "Before Dawn"
  };
  
  this.attrs = function() {
    return {
      dest: this.dest,
      updated_at: this.updated_at,
      downloaded: this.downloaded
    };
  };

  this.getReleaseInfo = async function() {
    let self = this;
    this.data = await request.get({
      url: this.url,
      json: true,
      headers: this.defaultHeaders
    }).catch(function(err) {

      self.logger(err);

      if ( typeof(self.data) !== "undefined" ) {
        return self.data;
      }
      else {
        return {};
      }
    });

    return this.data;
  };

  this.setReleaseInfo = function(d) {
    this.data = d;
  };
  
  this.checkLatestRelease = async function(force) {
    let data = await this.getReleaseInfo();
    return new Promise((resolve, reject) => {
      if ( data && (
        force === true ||
        data.published_at && new Date(data.published_at) > new Date(self.updated_at) )
      ) {
        self.logger("download package updates!");
        this.downloadFile(data.zipball_url).
             then((dest) => {
               self.zipToSavers(dest)
             }).
             then(() => {
               self.downloaded = true;
               self.updated_at = data.published_at;
               resolve(self.attrs());
             }).catch((err) => {
               self.logger("downloadFile error: " + err);
               reject(err);
             });
      }
      else {
        self.logger("no package update available");
        resolve(self.attrs());
      }
    });
  };
  
  this.checkLocalRelease = async function(dataSrc, zipSrc) {
    let rf = util.promisify(fs.readFile);
    let data = await rf(dataSrc);
    data = JSON.parse(data);

    return new Promise((resolve, reject) => {
      if ( new Date(data.published_at) > (self.updated_at) ) {
        self.updated_at = data.published_at;
        this.zipToSavers(zipSrc).then(() => {
          resolve(self.attrs());
        }).catch((err) => {
          self.logger("checkLocalRelease error: " + err);
          reject(err);
        })
      }
      else {
        resolve(self.attrs());
      }
    });
  };

  this.downloadFile = async function(url) {
    var temp = require("temp");
    var os = require("os");
    var tempName = temp.path({dir: os.tmpdir(), suffix: ".zip"});
    
    var _resp;
    var opts = {
      url:url,
      headers:this.defaultHeaders
    };

    return new Promise((resolve, reject) => {
      request_streaming(opts).
                              on("error", reject).
                              on("end", function() {
                                resolve(tempName);
                              }).pipe(fs.createWriteStream(tempName));
    });
  };


  this.zipToSavers = (tempName) => {
    return new Promise(function (resolve, reject) {
      yauzl.open(tempName, {lazyEntries: true}, (err, zipfile) => {
        if (err) {
          return reject(err);
        }

        //
        // clean out existing files
        //
        try {
          rimraf.sync(self.dest);
        }
        catch (err) {
          self.logger(err);
        }

        
        zipfile.readEntry();
        zipfile.on("entry", function(entry) {
          var fullPath = entry.fileName;
          
          // the incoming zip filename will have on extra directory on it
          // projectName/dir/etc/file
          //
          // example: muffinista-before-dawn-screensavers-d388377/starfield/index.html
          //
          // let's get rid of the projectName
          //
          var parts = fullPath.split(/\//);
          parts.shift();
          
          fullPath = path.join(self.dest, path.join(...parts));
          
          if (/\/$/.test(entry.fileName)) {
            // directory file names end with '/' 
            mkdirp(fullPath, function(err) {
              //if (err) {throw err;}
              zipfile.readEntry();
            });
          }
          else {
            // file entry 
            zipfile.openReadStream(entry, function(err, readStream) {
              if (err) {
                return reject(err);
              }
              
              // ensure parent directory exists 
              mkdirp(path.dirname(fullPath), function(err) {
                //if (err) {throw err;}
                readStream.pipe(fs.createWriteStream(fullPath));
                readStream.on("end", function() {
                  zipfile.readEntry();
                });
              });
            });
          }
        });
        
        zipfile.on("end", function() {
          resolve(self.attrs());
        });
      });
    });
  }
};
