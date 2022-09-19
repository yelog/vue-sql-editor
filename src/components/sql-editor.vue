<template>
  <div class="sql-editor">
    <textarea
      ref="editTextarea"
      v-model="text"
      class="sql-editor-textarea"
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
      keywords: ['select', 'from',
        'where', 'like', 'and',
        'group', 'on',
        'order', 'by', 'desc', 'asc'],
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
        // console.log('watch', newValue)
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
      // 拆分 <>， 防止被页面解析
      text = text.replaceAll(/([<>])/g, `<span class="symbol">$1</span>`)

      // 替换 ''
      const placeholderList = []
      const reg = /('[\s\S]*?')/ig
      let result = ''
      while ((result = reg.exec(text)) !== null) {
        placeholderList.push({
          index: result.index,
          content: result[0]
        })
      }
      for (let i = 0; i < placeholderList.length; i++) {
        text = text.replace(placeholderList[i].content, ' ')
      }
      // 引号使用强制颜色， 如果有问题按照上面的拆分
      // text = text.replaceAll(reg, `<span class="quote">$1</span>`)
      // sql 关键字
      this.keywords.forEach(item => {
        text = text.replaceAll(new RegExp(`(?<=^|\\s|\\W)(${item})(?=$|\\s|\\W)`, 'gi'), `<span class="keyword">$1</span>`)
      })
      // 注释
      text = text.replaceAll(/(--[\s\S]*?)(?=$|\n)/g, `<span class="comment">$1</span>`)

      // 还原替换符
      const breaks = text.split('')
      const tagStack = []
      const tag = []
      let originIndex = 0
      for (let i = 0; i < breaks.length; i++) {
        if (breaks[i] === '<' || tag.length > 0) {
          tag.push(breaks[i])
        }
        if (breaks[i] === '>') {
          if (tag[1] === '/') {
            // close tag
            tagStack.pop()
          } else {
            // start tag
            tagStack.push(tag.join(''))
          }
          tag.length = 0
        }
        if (!(breaks[i] === '<' || tag.length > 0 || breaks[i] === '>')) {
          originIndex++
        }
        const queryResult = placeholderList.filter(placeholder => (placeholder.index + 1) === originIndex)
        if (queryResult.length > 0) {
          originIndex += queryResult[0].content.length - 1
          breaks[i] = `<span class="quote">${queryResult[0].content}</span>`
        }
      }
      console.log('origin', originIndex)
      console.log('origin - text', this.text.length)
      this.html = breaks.join('')
    },
    storeHistory: debounce(function() {
      const latestHistory = this.redo.historyList[this.redo.historyList.length - 1]
      if (latestHistory === undefined || latestHistory.content !== this.text) {
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
  font-size: 20px;
  line-height: 1;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;

  &-pre, &-textarea {
    width: 100%;
    //height: 100%;
    height: 200px;
    padding: 10px;
    margin: 0;
    top: 0;
    left: 0;
    font-size: inherit;
    line-height: inherit;
    position: absolute;
    overflow: auto;
    outline: none;
    box-sizing: border-box;
    border: none;
    font-family: inherit;
  }

  &-textarea {
    z-index: 2;
    background: none;
    border: none;
    resize: none;
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
    font-family: inherit;
    overflow: hidden;

    /deep/{
      .keyword {
        color: #A151D2;
      }
      .comment {
        color: #a0a1a7;
      }
      .quote {
        color: #249d7f!important;
      }
      .error {

      }
      .symbol {
        color: #778899;
      }
    }
  }

}

</style>
