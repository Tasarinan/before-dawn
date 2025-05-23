<div id="prefs">
  <div class="saver-detail">
    <iframe
      title="preview"
      src="{previewUrl}"
      scrolling="no"
      class="saver-preview"
    ></iframe>
  </div>
  <div class="saver-info space-at-top">
      <SaverSummary saver={saverObj} on:editScreensaver={editSaver} on:deleteScreensaver="{deleteSaver}" />
      {#if saverObj !== undefined && saverObj.options}
        <SaverOptions bind:saver="{saverObj}" on:optionsChanged="{updatePreview}" />
      {/if}
  </div>

  <SaverList bind:savers={savers} bind:current={saver} saverPicked={saverPicked} />

  <div class="basic-prefs space-at-top">
    <h1>Settings</h1>
    <form class="grid">
      <div>
        <div class="form-group">
          <label for="delay">Activate after:</label>
          <select
            bind:value="{prefs.delay}"
            onchange="{({ target }) => { target.value = Number(target.value); }}"
            name="delay"
          >
            <option value="{Number(0)}">
              never
            </option>
            <option value="{Number(1)}">
              1 minute
            </option>
            <option value="{Number(5)}">
              5 minutes
            </option>
            <option value="{Number(10)}">
              10 minutes
            </option>
            <option value="{Number(15)}">
              15 minutes
            </option>
            <option value="{Number(30)}">
              30 minutes
            </option>
            <option value="{Number(60)}">
              1 hour
            </option>
          </select>
          <small class="form-text text-muted block">
            The screensaver will activate once your computer has been idle for this amount of time.
          </small>
        </div>
        
        <div class="form-group">
          <label for="sleep">Sleep after:</label>
          <select
           bind:value="{prefs.sleep}"
           onchange="{({ target }) => { target.value = Number(target.value); }}"
           name="sleep"
          >
            <option value="{Number(0)}">
              never
            </option>
            <option value="{Number(1)}">
              1 minute
            </option>
            <option value="{Number(5)}">
              5 minutes
            </option>
            <option value="{Number(10)}">
              10 minutes
            </option>
            <option value="{Number(15)}">
              15 minutes
            </option>
            <option value="{Number(30)}">
              30 minutes
            </option>
            <option value="{Number(60)}">
              1 hour
            </option>
          </select>
          <small class="form-text text-muted block">
            The screensaver will stop, and the displays will
            be turned off to save energy after this amount
            of time.
          </small>
        </div>
      </div>
    </form>
  </div>

  <footer class="footer">
    <div>
      <button
        class="align-middle btn create"
        onclick="{createNewScreensaver}"
      >
        Create Screensaver
      </button>
    </div>

    <div>
      <button
        class="btn settings"
        onclick="{openSettings}"
      >
        Advanced Settings
      </button>
      <button
        class="btn save"
        disabled="{disabled}"
        onclick="{saveDataClick}"
      >
        Save
      </button>
    </div>
  </footer>
</div> <!-- #prefs -->


<script>
  import Notarize from "@/components/Notarize";
  import SaverList from "@/components/SaverList.svelte";
  import SaverOptions from "@/components/SaverOptions.svelte";
  import SaverSummary from "@/components/SaverSummary.svelte";
	import { onMount, onDestroy, tick } from "svelte";


	let savers = $state([]);
  let prefs = $state({});
  let saver = $state(undefined);
  let size = undefined;
  let screenshot = undefined;
  let previewUrl = $state(undefined);
  let disabled = $state(false);

  let saverIndex = $derived.by(() => {
    return findIndexOf(saver);
  });
  let saverObj = $state(undefined);


	onMount(async () => {
    console.log = window.api.log;
    window.addEventListener("error", console.log);
    window.addEventListener("unhandledrejection", console.log);

    size = await window.api.getDisplayBounds();
    screenshot = await window.api.getScreenshot();

    await getData();

    resizePreview();
    setPreviewUrl();

    window.api.addListener("savers-updated", onSaversUpdated);

    const globals = await window.api.getGlobals();
    if ( globals.NEW_RELEASE_AVAILABLE ) {
      await tick();
      // window.api.displayUpdateDialog();
    }
  });

  onDestroy(() => {
   window.api.removeListener("savers-updated", onSaversUpdated);
  });

  async function getData() {
    savers = await window.api.listSavers();
    prefs = await window.api.getPrefs();
    saver = prefs.saver;

    if ( savers.length <= 0 ) {
      return;
    }

    // ensure default settings in the config for all savers
    savers = savers.map((s) => {
      if ( s.settings === undefined ) {
        s.settings = {};
      }
      return s;
    });

    savers = savers;

    // saverIndex won't resolve yet so find via function instead
    const tmpIndex = findIndexOf(saver);
    saverObj = savers[tmpIndex];

    if ( tmpIndex == -1 ) {
      saverObj = savers[0];
    }
  }

  async function onSaversUpdated() {
    getData();
  }

  function findIndexOf(saver) {
    if ( saver === undefined ) {
      return 0;
    }
    let lookup = saver;
    if ( saver.key !== undefined ) {
      lookup = saver.key; 
    }

    return savers.findIndex((s) => s.key === lookup);
  }

  function urlOpts(s, opts) {
    var base = {
      width: size.width,
      height: size.height,
      preview: 1,
      platform: window.api.platform(),
      screenshot: screenshot
    };

    if ( typeof(s) === "undefined" ) {
      s = saver;
    }
    if (!opts) {
      opts = s.settings;
    }

    var mergedOpts = Object.assign(base, opts);


    return mergedOpts;
  }

  function setPreviewUrl(opts) {
    if (saverObj === undefined) {
      return;
    }

    const urlParams = new URLSearchParams(urlOpts(saverObj, opts));
    previewUrl = `${saverObj.url}?${urlParams.toString()}`;
  }


  function updatePreview(event) {
    setPreviewUrl(event.detail.options);
  }

  function saverPicked() {
    saverObj = savers[saverIndex];
    setPreviewUrl();
  }

  function createNewScreensaver() {
    window.api.openWindow("add-new", {
      screenshot
    });
  }

  async function saveData() {
    // copy in some data (not sure we really need this)
    if (saverIndex !== -1 ) {
      prefs.saver = saver;
      prefs.options[saver] = savers[saverIndex].settings;
    }

    const clone = JSON.parse(JSON.stringify(prefs));   
    return await window.api.updatePrefs(clone);
  }

  async function saveDataClick() {
    let output;

    disabled = true;
    try {
      await saveData();
      output = "Changes saved!";
    }
    catch(e) {
      output = "Something went wrong!";
      console.log(e);
    }

    disabled = false;
    new Notarize({timeout: 1000}).show(output);
  }

  function resizePreview() {
    document.documentElement.style
      .setProperty("--preview-width", `${size.width}px`);
    document.documentElement.style
      .setProperty("--preview-height", `${size.height}px`);
    const scale = 500 / (size.width + 40);

    document.documentElement.style
      .setProperty("--preview-scale", `${scale}`);
  }

  function openSettings() {
    window.api.openWindow("settings");
  }

  function editSaver() {
    var opts = {
      src: saverObj.src,
      screenshot: screenshot
    };
    window.api.openWindow("editor", opts);
  }

  async function deleteSaver() {
    const index = savers.indexOf(saverObj);
    const newIndex = Math.max(index-1, 0);
    const saverToDelete = savers[index];

    saver = savers[newIndex].key;

    savers = savers.filter(s => s !== saverToDelete);

    await window.api.deleteSaver(saverToDelete);
    await getData();

    saver = prefs.saver;
    setPreviewUrl();
  }
</script>

<style>
</style>
