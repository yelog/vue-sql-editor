<template>
  <div id="app">
    <test-sql-editor />
  </div>
</template>

<script>
import TestSqlEditor from './views/test-sql-editor'
export default {
  components: { TestSqlEditor }
}
</script>
<style lang="scss">
html,body {
  padding: 0;
  margin: 0;
  height: 100%;
}
#app {
  height: 100%;
}

</style>
