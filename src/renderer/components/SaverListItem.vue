<template>
  <li :class="classes" v-on:click="pickSaver(saver)">
    <div class="d-flex w-100 justify-content-between">
      <label>
        <div class="body">
          <input type="radio" 
            name="screensaver" 
            :data-name="saver.name" 
            v-bind:value="saver.key" 
            v-on="$listeners" 
            :checked="checked"/>
          <b>{{saver.name}}</b>
          <div class="description">
            <small>{{saver.description}}</small>
          </div>
        </div>
      </label>
    </div>
  </li>
</template>


<script>
export default {
  name: "saver-list-item",
  props: ["saver", "checked"],
  computed: {
    classes() {
      let base = "list-group-item flex-column entry";
      if ( this.checked ) {
        return base + " active";
      }
      return base;
    }
  },
  methods: {
    pickSaver(s) {
      document.querySelector(`input[name='screensaver'][value='${s.key}']`).click();
    }
  }
};
</script>
