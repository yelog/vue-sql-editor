<template>
  <div class="sql-editor">
    <textarea
      v-model="text"
      class="sql-editor-textarea"
      style="width: 100%; height: 200px"
      @keydown.tab="pressTab"
    />
    <pre class="sql-editor-pre"><code class="sql-editor-code" v-html="html" /> </pre>
  </div>
</template>
<script>
export default {
  name: 'SqlEditor',
  data() {
    return {
      keywords: ['select', 'from', 'where'],
      text: 'select * from sys_user',
      html: ''
    }
  },
  watch: {
    text: {
      handler(newValue) {
        this.renderContent(newValue)
      },
      immediate: true
    }
  },
  mounted() {
  },
  methods: {
    changeContent(event) {
      console.log('change')
      console.log(event.target.innerHTML)
      console.log(event.data)
      console.log(event.target.innerText.replaceAll(/\n/g, '\\n'))
      // console.log(event.target.innerText)
      const offset = this.getCaretCharacterOffsetWithin()
      this.renderContent(event.target.innerText)
      this.$nextTick(() => {
        this.setCaretPosition(offset, event.inputType === 'insertParagraph')
        console.log(event.target.innerHTML.replaceAll(/\n/g, '\\n'))
      })
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

  &-pre {
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
    opacity: 0.5;
    min-width: 0;
    min-height: 0;
    margin: 0;
    padding: 0;
    position: absolute;
    outline: none!important;
    resize: none;
    border: none;
    overflow: hidden;
    color: transparent;
    background-color: transparent;
    font-size: 1px;
    line-height: 18px;
    top: 96px;
    left: 134px;
    width: 1px;
    height: 1px;
    font-family: Menlo, Monaco, "Courier New", monospace;
    font-weight: normal;
    letter-spacing: 0;
  }
  &-code {
    display: block;
    color: #A9B7C6;
    width: 100%;
    height: 100%;

    /deep/ .keyword {
      color: #CC7832;
    }
  }

}

</style>
