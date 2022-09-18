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
    },
    changeContent(event) {
      // console.log('change')
      // console.log(event.target.innerHTML)
      // console.log(event.data)
      // console.log(event.target.innerText.replaceAll(/\n/g, '\\n'))
      // console.log(event.target.innerText)
      // const offset = this.getCaretCharacterOffsetWithin()
      this.renderContent(this.text)
      // this.$nextTick(() => {
      //   this.setCaretPosition(offset, event.inputType === 'insertParagraph')
      //   console.log(event.target.innerHTML.replaceAll(/\n/g, '\\n'))
      // })
    },
    renderContent(text) {
      this.keywords.forEach(item => {
        text = text.replaceAll(new RegExp(`(${item})`, 'gi'), `<span class="keyword">$1</span>`)
      })
      this.html = text
    },
    getCaretCharacterOffsetWithin() {
      const element = this.$refs.content
      let caretOffset = 0
      const doc = element.ownerDocument || element.document
      const win = doc.defaultView || doc.parentWindow
      let sel
      if (typeof win.getSelection !== 'undefined') {
        sel = win.getSelection()
        if (sel.rangeCount > 0) {
          const range = win.getSelection().getRangeAt(0)
          const preCaretRange = range.cloneRange()
          preCaretRange.selectNodeContents(element)
          preCaretRange.setEnd(range.endContainer, range.endOffset)
          caretOffset = preCaretRange.toString().length
        }
      } else if ((sel = doc.selection) && sel.type !== 'Control') {
        const textRange = sel.createRange()
        const preCaretTextRange = doc.body.createTextRange()
        preCaretTextRange.moveToElementText(element)
        preCaretTextRange.setEndPoint('EndToEnd', textRange)
        caretOffset = preCaretTextRange.text.length
      }
      return caretOffset
    },
    setCaretPosition(offset, isEnter) {
      const element = this.$refs.content
      const range = document.createRange()
      const sel = window.getSelection()

      // select appropriate node
      let currentNode = null
      let previousNode = null
      let nextStop = false

      for (let i = 0; i < element.childNodes.length; i++) {
        // save previous node
        previousNode = currentNode

        // get current node
        currentNode = element.childNodes[i]
        // if we get span or something else then we should get child node
        while (currentNode.childNodes.length > 0) {
          [currentNode] = currentNode.childNodes
        }
        if (nextStop) {
          break
        }

        // calc offset in current node
        if (previousNode != null) {
          offset -= previousNode.length
        }
        // check whether current node has enough length
        if (offset <= currentNode.length) {
          if (isEnter) {
            if (element.childNodes[i].nodeName === '#text') {
              // 如果是结尾，则移动到最后
              offset += currentNode.length - offset === 2 ? 2 : 1
              break
            } else {
              nextStop = true
              offset = 1
            }
          } else {
            break
          }
        }
      }
      // move caret to specified offset
      if (currentNode != null) {
        range.setStart(currentNode, offset)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    },
    pressTab(event) {
      // 阻止默认切换元素的行为
      if (event && event.preventDefault) {
        event.preventDefault()
      } else {
        window.event.returnValue = false
      }
      //
      // var newCaretPosition;
      // newCaretPosition = textarea.getCaretPosition() + "    ".length;
      // textarea.value = textarea.value.substring(0, textarea.getCaretPosition()) + "    " + textarea.value.substring(textarea.getCaretPosition(), textarea.value.length);
      // textarea.setCaretPosition(newCaretPosition);
    },
    pressEnter(event) {
      // 阻止默认切换元素的行为
      // if (event && event.preventDefault) {
      //   event.preventDefault()
      // } else {
      //   window.event.returnValue = false
      // }
      // this.insertHtmlAtCaret('\n')
      // this.changeContent(event)
    }
    // insertHtmlAtCaret(html) {
    //   var sel, range, frag
    //   if (window.getSelection) {
    //     sel = window.getSelection()
    //     if (sel.getRangeAt && sel.rangeCount) {
    //       range = sel.getRangeAt(0)
    //       range.deleteContents()
    //       var el = document.createElement('div')
    //       el.innerHTML = html
    //       frag = document.createDocumentFragment()
    //       var node
    //       var lastNode
    //       while ((node = el.firstChild)) {
    //         lastNode = frag.appendChild(node)
    //       }
    //       range.insertNode(frag)
    //       if (lastNode) {
    //         range = range.cloneRange()
    //         range.setStartAfter(lastNode)
    //         range.collapse(true)
    //         sel.removeAllRanges()
    //         sel.addRange(range)
    //       }
    //     } else {
    //       var el = this.$refs.content
    //       el.innerHTML = html
    //     }
    //   }
    // }
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
    caret-color: #111;
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
    color: #A9B7C6;
    width: 100%;
    height: 100%;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
    overflow: hidden;

    /deep/ .keyword {
      color: #CC7832;
    }
  }

}

</style>
