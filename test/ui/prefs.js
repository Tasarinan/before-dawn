'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');

const helpers = require('./setup.js');
var workingDir = helpers.getTempDir();
var saversDir = helpers.getTempDir();


const app = helpers.application(workingDir);

helpers.setupConfig(workingDir);
helpers.addLocalSource(workingDir, saversDir);
helpers.addSaver(saversDir, "saver-one", "saver.json");

describe('Prefs', function() {
  helpers.setupTimeout(this);
  
	beforeEach(() => {
		return app.start().
               then(() => app.client.waitUntilWindowLoaded() ).
			         then(() => app.electron.ipcRenderer.send('open-prefs')).
			         then(() => app.client.windowByIndex(2));
	});

	afterEach(() => {
    return helpers.stopApp(app);
	});

  it('opens window', function() {
    assert(app.browserWindow.isVisible());
  });

  it('sets title', function() {
    return app.client.waitUntilWindowLoaded().getTitle().then((res) => {
      assert.equal('Before Dawn: Preferences', res);
    });
  });

  it('lists screensavers', function() {
    return app.client.waitUntilTextExists('body', 'Screensaver One').getText('body').then((text) => {
      assert(text.lastIndexOf('Screensaver One') !== -1);
    });
  });

  it('allows picking a screensaver', function() {
    return app.client.waitUntilTextExists('body', 'Screensaver One', 10000)
       .getAttribute("[type=radio]","data-name")
       .then(() => {
         app.client.click("[type=radio][data-name='Screensaver One']").
             getText('body').
             then((text) => {
               assert(text.lastIndexOf('A Screensaver') !== -1);
             });
       }).
        then(() => app.client.click("button.save")).
        then(() => {
          app.client.getWindowCount().should.eventually.equal(1)
        }).
        then(() => {
          assert(helpers.savedConfig(workingDir).saver.lastIndexOf("/saver-one/") !== -1);
        });
    
  });

  it('sets options for screensaver', function() {
    return app.client.waitUntilTextExists('body', 'Screensaver One', 10000).
       getAttribute("[type=radio]","data-name").
        then(() => app.client.click("[type=radio][data-name='Screensaver One']")).
        then(() => app.client.getText('body')).
        then((text) => {
          assert(text.lastIndexOf('Load the specified URL') !== -1);
        }).
        then(() => app.client.click("[name='sound'][value='false']")).
        then(() => app.client.setValue("[name='load_url']", 'barfoo')).
        then(() => app.client.click("button.save")).
        then(() => {
          app.client.getWindowCount().should.eventually.equal(1)
        }).
        then(() => {
          var options = helpers.savedConfig(workingDir).options;
          var k = Object.keys(options).find((i) => {
            return i.indexOf("saver-one") !== -1;
          });

          assert(options[k].load_url == 'barfoo');
          assert(options[k].sound == false);
        });
   
  });
  
  it('allows setting path', function() {
    return app.client.waitUntilWindowLoaded().click("=Preferences").
      then(() => app.client.scroll("[name='localSource']")).
      then(() => app.client.setValue("[name='localSource']", '/tmp')).
      then(() => app.client.click("button.save")).
      then(() => {
        app.client.getWindowCount().should.eventually.equal(1)
      }).
      then(() => {
        assert.equal("/tmp", helpers.savedConfig(workingDir).localSource);
      });
  });

  it('allows setting path via dialog', function() {
    app.fakeDialog.mock([ { method: 'showOpenDialog', value: ['/not/a/real/path'] } ]);
    return app.client.waitUntilWindowLoaded().click("=Preferences").
      then(() => app.client.click("button.pick")).
      then(() => app.client.click("button.save")).
      then(() => {
        app.client.getWindowCount().should.eventually.equal(1)
      }).
      then(() => {
        assert.equal("/not/a/real/path", helpers.savedConfig(workingDir).localSource);
      });
  });
});
