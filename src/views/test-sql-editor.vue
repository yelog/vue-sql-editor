<template>
  <div class="back">
    <sql-editor v-model="sql" class="my-editor" />
    <div><pre>{{ sql }}</pre></div>
  </div>
</template>
<script>
import SqlEditor from '@/components/sql-editor'
export default {
  components: { SqlEditor },
  data() {
    return {
      sql: ''
    }
  },
  mounted() {
    this.sql = 'select\n    username, password, sys_user.type as user_type\nfrom\n    sys_user user\n    left join sys_role role on user.role_id = role.id\nwhere username=\'yang\'\n    and sys_user.type in (\'web\')\n    and age between 18 and 30 and role.id < 5'
  }
}
</script>
<style lang="scss" scoped>
.back {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  .my-editor {
    width: 800px;
    height: 400px;
  }
}
</style>
