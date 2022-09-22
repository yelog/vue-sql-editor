<template>
  <div class="back">
    <sql-editor class="my-editor" />
  </div>
</template>
<script>
import SqlEditor from '@/components/sql-editor'
export default {
  components: { SqlEditor }
}
</script>
<style lang="scss" scoped>
.back {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  .my-editor {
    width: 400px;
    height: 400px;
  }
}
</style>
