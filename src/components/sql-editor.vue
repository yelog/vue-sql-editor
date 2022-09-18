<template>
  <div class="sql-editor">
    <textarea
      ref="editTextarea"
      v-model="text"
      class="sql-editor-textarea"
      style="width: 100%; height: 200px"
      @keydown="keyDownEvent"
    />
    <pre class="sql-editor-pre"><code class="sql-editor-code" v-html="html" /> </pre>
  </div>
</template>
<script>
import { debounce } from '@/utils/common'

export default {
  name: 'SqlEditor',
  data() {
    return {
      keywords: ['select', 'from', 'where', 'order by', 'desc', 'asc'],
      redo: {
        historyList: [],
        redoList: [],
        isRedo: false
      },
      text: '',
      html: ''
    }
  },
  watch: {
    text: {
      handler(newValue) {
        // 如果开始手动写入， 则清空 redo 列表
        if (this.redo.isRedo) {
          this.redo.isRedo = false
        } else {
          this.redo.redoList = []
        }
        this.storeHistory()
        console.log('watch', newValue)
        this.renderContent(newValue)
      },
      immediate: true
    }
  },
  mounted() {
    this.text = 'select * from sys_user'
  },
  methods: {
    renderContent(text) {
      // sql 关键字
      this.keywords.forEach(item => {
        text = text.replaceAll(new RegExp(`(${item})`, 'gi'), `<span class="keyword">$1</span>`)
      })
      // 注释
      text = text.replaceAll(/(--[\s\S]*?)(?=$|\n)/g, `<span class="comment">$1</span>`)
      this.html = text
    },
    storeHistory: debounce(function() {
      const latestHistory = this.redo.historyList[this.redo.historyList.length - 1]
      if (latestHistory === undefined || latestHistory.content !== this.text) {
        console.log('store history')
        this.redo.historyList[this.redo.historyList.length] = {
          content: this.text,
          caret: this.getCaretPos()
        }
      }
    }),
    keyDownEvent(event) {
      // console.log(event)
      // 禁用 tab 默认行为
      if (event.keyCode === 9) {
        event.preventDefault()
        this.text += '    '
        this.renderContent(this.text)
        return false
      } else if (event.keyCode === 90 && (this.isMac() ? event.metaKey : event.ctrlKey)) {
        event.preventDefault()
        let history
        if (event.shiftKey) {
          // 重写  ctrl-shift-z
          history = this.redo.redoList.pop()
        } else {
          // 重写 ctrl-z
          this.redo.redoList.push(this.redo.historyList.pop())
          history = this.redo.historyList[this.redo.historyList.length - 1]
        }
        if (history !== undefined) {
          // 标识当前 text 修改来自于撤销或重做
          this.redo.isRedo = true
          this.text = history.content
          this.$nextTick(() => {
            this.setCaretPos(history.caret)
          })
        }
      }
    },
    getCaretPos() {
      const editTextarea = this.$refs.editTextarea
      let caretPos = 0
      if (editTextarea.selectionStart || editTextarea.selectionStart === 0) {
        caretPos = editTextarea.selectionStart // 获取选定区的开始点
      }
      return caretPos
    },
    setCaretPos(caretPos) {
      const editTextarea = this.$refs.editTextarea
      if (editTextarea.setSelectionRange) {
        editTextarea.focus()
        editTextarea.setSelectionRange(caretPos, caretPos)
      }
    },
    isMac() {
      return /macintosh|mac os x/i.test(navigator.userAgent)
    }
  }
}
</script>
<style scoped lang="scss">
.sql-editor {
  position: relative;

  &-pre, &-textarea {
    width: 100%;
    //height: 100%;
    height: 200px;
    padding: 10px;
    margin: 0;
    top: 0;
    left: 0;
    font-size: 13px;
    line-height: 20px;
    position: absolute;
    overflow: auto;
    outline: none;
    box-sizing: border-box;
    border: none;
  }

  &-textarea {
    z-index: 2;
    background: none;
    border: none;
    resize: none;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
    caret-color: #2795EE;
    color: transparent;
    background: transparent;
  }
  &-pre {
    z-index: 3;
    pointer-events: none;
    //top: 200px;
  }
  &-code {
    display: block;
    color: #2795EE;
    width: 100%;
    height: 100%;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
    overflow: hidden;

    /deep/{
      .keyword {
        color: #A151D2;
      }
      .comment {
        color: #a0a1a7;
      }
    }
  }

}

</style>
