<template>
  <div id="editor">
    <ul
      role="tablist"
      class="nav nav-tabs"
    >
      <li
        id="preview-tab"
        role="presentation"
        class="active nav-item"
      >
        <a
          aria-expanded="true"
          aria-controls="preview"
          role="tab"
          data-toggle="tab"
          class="nav-link active"
          href="#preview"
          @click="showPreview"
        >
          Preview
        </a>
      </li>
      <li
        id="description-tab"
        role="presentation"
        class="nav-item"
      >
        <a
          aria-expanded="false"
          aria-controls="description"
          role="tab"
          data-toggle="tab"
          class="nav-link"
          href="#description"
          @click="showDescription"
        >
          Description
        </a>
      </li>
     <li
        id="options-tab"
        role="presentation"
        class="nav-item"
      >
        <a
          aria-expanded="false"
          aria-controls="options"
          role="tab"
          data-toggle="tab"
          class="nav-link"
          href="#options"
          @click="showOptions"
        >
          Options
        </a>
      </li>      
      <b-button-group>
        <b-button
          v-b-tooltip.hover
          variant="default"
          title="Open screensaver folder"
          @click="openFolder"
        >
          <span class="icon">
            <img
              src="assets/img/folder.svg"
              width="14"
              height="14"
            >
          </span>
        </b-button>
        <b-button
          v-b-tooltip.hover
          variant="default"
          title="Save changes"
          @click="saveData"
        >
          <span class="icon">
            <img
              src="assets/img/save.svg"
              width="14"
              height="14"
            >
          </span>
        </b-button>
        <b-button
          v-b-tooltip.hover
          variant="default"
          title="Reload preview"
          @click="reloadPreview"
        >
          <span class="icon">
            <img
              src="assets/img/cycle.svg"
              width="14"
              height="14"
            >
          </span>
        </b-button>
        <b-button
          v-b-tooltip.hover
          variant="default"
          title="View Developer Console"
          @click="openConsole"
        >
          <span class="icon">
            <img
              src="assets/img/bug.svg"
              width="14"
              height="14"
            >
          </span>
        </b-button>
      </b-button-group>
    </ul>

    <div class="content">
      <div class="tab-content">
        <div
          id="preview"
          class="tab-pane active"
          aria-labelledby="preview-tab"
          role="tabpanel">
          <div class="container-fluid space-at-bottom">
            <template v-if="saver !== undefined">
              <template v-if="options.length > 0">
                <h4>Options</h4>
                <small>
                  Tweak the values here and they will be sent along
                  to your preview.
                </small>
                <saver-options
                  :saver="saver"
                  :options="options"
                  :values="optionDefaults"
                  @change="onOptionsChange"
                />
              </template>
              
              <h4>Preview</h4>
              <saver-preview
                v-if="isLoaded"
                :bus="bus"
                :saver="saver"
                :screenshot="screenshot"
              />
            </template>
          </div>
        </div>
        <div
          id="description"
          class="tab-pane"
          aria-labelledby="description-tab"
          role="tabpanel">
          <div class="container-fluid">
            <h4>Description</h4>
            <small>
              You can enter the basics about this screensaver
              here.
            </small>
            <template v-if="saver !== undefined">
              <!-- NOTE: passing the attrs here because its really all
                  we need for this form and makes saving the data later a
                  lot easier -->
              <saver-form
                v-if="isLoaded"
                :saver="saver.attrs"
              />
            </template>
          </div>
        </div>
        <div
          id="options"
          class="tab-pane"
          aria-labelledby="options-tab"
          role="tabpanel">
          <div class="container-fluid">
            <template v-if="saver !== undefined">
              <h4>Configurable Options</h4>
              <small>
                You can offer users configurable options to control
                your screensaver. Manage those here.
              </small>
              
              
              <!--
                  note: is track-by ok here?
                  https://v1.vuejs.org/guide/list.html#track-by-index 
                -->
              <div v-if="isLoaded">
                <saver-option-input
                  v-for="(option, index) in options"
                  :key="option.index"
                  :option="option"
                  :index="index"
                  @deleteOption="deleteOption(option)"
                />      
              </div>
              
              <div class="padded-top padded-bottom">
                <button
                  type="button"
                  class="btn btn-primary add-option"
                  @click="addSaverOption"
                >
                  Add Option
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
    <footer class="footer d-flex justify-content-between">
      <div>
        <button
          class="btn btn-large btn-secondary cancel"
          @click="closeWindow"
        >
          Cancel
        </button>
        <button
          class="btn btn-large btn-primary save"
          :disabled="disabled"
          @click.stop.prevent="saveData"
        >
          Save
        </button>
        <button
          class="btn btn-large btn-primary save"
          :disabled="disabled"
          @click.stop.prevent="saveDataAndClose"
        >
          Save and Close
        </button>        
      </div>
    </footer>
  </div> <!-- #editor -->
</template>

<script>
const fs = require("fs");
const path = require("path");
const url = require("url");
const exec = require("child_process").execFile;

import Vue from "vue";
import SaverPreview from "@/components/SaverPreview";
import SaverForm from "@/components/SaverForm";  
import SaverOptionInput from "@/components/SaverOptionInput";
import SaverOptions from "@/components/SaverOptions";
import Noty from "noty";

const remote = require("electron").remote;

import SaverPrefs from "@/../lib/prefs";
import SaverListManager from "@/../lib/saver-list";

export default {
  name: "Editor",
  components: {
    SaverForm, SaverPreview, SaverOptionInput, SaverOptions
  },
  data() {
    return {
      saver: undefined,
      lastIndex: 0,
      options: [],
      optionValues: {},
      disabled: false
    };
  },
  computed: {
    bus: function() {
      return new Vue();
    },
    currentWindow: function() {
      return this.$electron.remote.getCurrentWindow();
    },
    ipcRenderer: function() {
      return this.$electron.ipcRenderer;
    },
    isLoaded: function() {
      return typeof(this.saver) !== "undefined";
    },
    params: function() {
      // parse incoming URL params -- we'll get a link to the current screen images for previews here
      return new URLSearchParams(document.location.search);
    },
    src: function() {
      return this.params.get("src");
    },
    screenshot: function() {
      return this.params.get("screenshot");
    },
    folderPath: function() {
      return path.dirname(this.src);
    },
    optionDefaults: function() {
      var result = {};
      for ( var i = 0; i < this.options.length; i++ ) {
        var opt = this.options[i];
        result[opt.name] = opt.default;
      }

      return result;
    },
  },
  async mounted() {
    if ( this.src === null ) {
      return;
    }

    let dataPath = remote.getCurrentWindow().saverOpts.base;

    this._prefs = new SaverPrefs(dataPath);
    this._savers = new SaverListManager({
      prefs: this._prefs
    });

    this._savers.loadFromFile(this.src).then((result) => {
      this.saver = result;
      this.options = result.options;
      this.lastIndex = result.options.length;

      // make sure folder actually exists
      if ( fs.existsSync(this.folderPath) ) {
        fs.watch(this.folderPath, (eventType, filename) => {
          if (filename) {
            this.reloadPreview();
          }
        });
      }      
    });
  },
  methods: {
    clearTabs() {
      var els = document.querySelectorAll(".nav-tabs > li > a.nav-link, .tab-content > .tab-pane");
      for ( var i = 0; i < els.length; i++ ) {
        els[i].classList.remove("active");
      }
    },
    setActiveTab(n) {
      this.clearTabs();
      document.querySelector("#" + n).classList.add("active");
      document.querySelector("[href='#" + n + "']").classList.add("active");
      document.querySelector("#" + n + " h4").scrollIntoView();
    },
    showPreview() {
      this.setActiveTab("preview");
    },
    showDescription() {
      this.setActiveTab("description");
    },
    showOptions() {
      this.setActiveTab("options");
    },
    onOptionsChange(e) {
      var name = e.target.name;
      var value = e.target.value;
      var result = {};

      //console.log("optionsChange", name, value, e);

      // rebuild the option value hash so that if a key is
      // renamed it isn't left behind in the data
      for ( var i = 0; i < this.options.length; i++ ) {
        var opt = this.options[i];
        if ( this.optionValues[opt.name]) {
          result[opt.name] = this.optionValues[opt.name];
        }
        else {
          result[opt.name] = opt.default;
        }
      }

      // add the new name/value
      result[name] = value;

      this.optionValues = Object.assign({}, result);
      this.bus.$emit("options-changed", this.optionValues);
    },
    deleteOption(opt) {
      let index = this.options.indexOf(opt);
      this.options.splice(index, 1);
    },
    addSaverOption() {
      this.options.push({
        "index": this.lastIndex + 1,
        "name": "", //New Option,
        "type": "slider",
        "description": "", //Description,
        "min": "1",
        "max": "100",
        "default": "75"
      });

      this.lastIndex = this.lastIndex + 1;
    },   
    closeWindow() {
      this.currentWindow.close();
    },
    saveData() {
      this.disabled = true;

      this.saver.attrs.options = this.options;
      this.saver.write(this.saver.attrs, this.saver.key);
      this.ipcRenderer.send("savers-updated", this.saver.key);

      new Noty({
        type: "success",
        layout: "topRight",
        timeout: 2000,
        text: "Changes saved!",
        animation: {
          open: null
        }
      }).show();

      this.disabled = false;
    },
    saveDataAndClose() {
      this.saveData();
      this.closeWindow();
    },
    openFolder() {
      var cmd;
      var args = [];
      
      // figure out the path to the screensaver folder. use
      // decodeURIComponent to convert %20 to spaces
      var filePath = path.dirname(decodeURIComponent(url.parse(this.src).path));

      switch(process.platform) {
      case "darwin":
        cmd = "open";
        args = [ filePath ];
        break;
      case "win32":
        if (process.env.SystemRoot) {
          cmd = path.join(process.env.SystemRoot, "explorer.exe");
        }
        else {
          cmd = "explorer.exe";
        }
        args = [`/select,${filePath}`];
        break;
      default:
        // # Strip the filename from the path to make sure we pass a directory
        // # path. If we pass xdg-open a file path, it will open that file in the
        // # most suitable application instead, which is not what we want.
        cmd = "xdg-open";
        args = [ filePath ];
      }
      
      exec(cmd, args, function() {});
    },
    reloadPreview() {
      this.bus.$emit("options-changed", this.optionValues);
    },
    openConsole() {
      this.currentWindow.toggleDevTools();
    },   
  }
}; 
</script>