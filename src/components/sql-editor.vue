<template>
  <div class="sql-editor">
    <textarea
      ref="editTextarea"
      v-model="text"
      class="sql-editor-textarea"
      @input="inputEvent"
      @blur="blurEvent"
      @keydown="keydownEvent"
      @click="clickEvent"
      @keyup="keyupEvent"
    />
    <pre class="sql-editor-pre"><code class="sql-editor-code" v-html="html" /> </pre>
  </div>
</template>
<script>
import { debounce } from '@/utils/common'
import { getCursorPos } from '@/utils/getCursorPos'

export default {
  name: 'SqlEditor',
  data() {
    return {
      // 前后不能有其它字符
      keywords: ['create', 'drop', 'alter', 'table', 'column', 'use', 'database',
        'int', 'integer', 'varchar',
        'select', 'delete', 'update', 'set', 'insert', 'into', 'values',
        'min', 'max', 'as', 'from', 'left', 'join', 'outer',
        'where', 'like', 'between', 'and', 'in', 'not', 'is', 'null',
        'group', 'on', 'having',
        'order', 'by', 'desc', 'asc'],
      // 前后可以有其它字符
      operator: [',', '=', '!=', '\\(', '\\)', '<', '>', ';', '\\*'],
      tables: [
        { name: 'sys_user', column: ['username', 'password', 'type'] },
        { name: 'sys_role', column: ['username', 'password', 'type'] }
      ],
      redo: {
        historyList: [],
        redoList: [],
        isRedo: false
      },
      hint: {
        hintAreaDom: null,
        caretPos: 0,
        curWord: '',
        selectedDom: '',
        itemDomList: []
      },
      isInput: false,
      text: '',
      html: ''
    }
  },
  computed: {
    tableNames() {
      return this.tables.map(table => table.name)
    }
  },
  watch: {
    text: {
      handler(newValue) {
        if (this.redo.isRedo) {
          // 撤销/重做操作
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
    generateMatchList(list) {
      return list
        .filter(item => new RegExp(this.hint.curWord.split('').join('\\w*'), 'gi').test(item)).map((item) => {
          // 所有第一个匹配的char
          const matchIndexList = []
          const itemArray = item.split('')
          let lastIndex = 0
          for (let i = 0; i < this.hint.curWord.length; i++) {
            for (let j = lastIndex; j < itemArray.length; j++) {
              if (itemArray[j] === this.hint.curWord[i]) {
                matchIndexList.push(j)
                lastIndex = j + 1
                break
              }
            }
          }
          return {
            content: item,
            matchIndexList: matchIndexList
          }
        })
    },
    showHints() {
      const innerHtml = []
      // 获取当前字符串
      const curWordArray = []
      for (let i = this.getCaretPos() - 1; i >= 0; i--) {
        const curChar = this.text[i]
        if (!/\w/g.test(curChar)) {
          break
        }
        curWordArray.push(curChar)
      }
      this.hint.curWord = curWordArray.reverse().join('')
      const matchList = []
      if (this.hint.curWord !== '') {
        matchList.push(...this.generateMatchList(this.keywords))
        // 匹配表名
        matchList.push(...this.generateMatchList(this.tableNames))
        // matchList.push(...this.tableNames
        //   .filter(item => new RegExp(this.hint.curWord.split('').join('\\w*'), 'gi').test(item)))
      }
      if (matchList.length === 0 || (matchList.length === 1 && matchList[0].content === this.hint.curWord)) {
        this.closeHints()
        return
      }
      // 开始展示
      this.hint.caretPos = this.getCaretPos()
      this.hint.hintAreaDom = document.getElementById('hint-area')
      if (!this.hint.hintAreaDom) {
        this.hint.hintAreaDom = document.createElement('div')
        this.hint.hintAreaDom.id = 'hint-area'
        this.hint.hintAreaDom.className = 'hint-area'
        document.body.appendChild(this.hint.hintAreaDom)
      }
      // 设置位置信息
      const pos = getCursorPos.getInputPositon(this.$refs.editTextarea, this.getCaretPos() - curWordArray.length)
      // console.log(pos)
      this.hint.hintAreaDom.style.top = (pos.top + 20) + 'px'
      this.hint.hintAreaDom.style.left = (pos.left - 18) + 'px'
      // 设置列表
      innerHtml.push(...matchList
      // 排序， 索引数和最小的最靠上
        .sort((item1, item2) => item1.matchIndexList.reduce((prev, cur) => prev + cur, 0) - item2.matchIndexList.reduce((prev, cur) => prev + cur, 0))
        .map((item, index) => {
          const itemArray = item.content.split('')
          for (let i = 0; i < item.matchIndexList.length; i++) {
            itemArray[item.matchIndexList[i]] = `<span class="matchKey">${itemArray[item.matchIndexList[i]]}</span>`
          }
          return `<div class="hint-area-item ${index === 0 ? 'selected' : ''}"><div class="hint-area-item-icon"></div>${itemArray.join('')}</div>`
        }))
      this.hint.hintAreaDom.innerHTML = innerHtml.join('')
      // 记录到变量中
      this.hint.selectedDom = this.hint.hintAreaDom.querySelector('.selected')
      this.hint.itemDomList = this.hint.hintAreaDom.querySelectorAll('.hint-area-item')
      this.hint.itemDomList.forEach(el => {
        // 鼠标移动高亮
        el.addEventListener('mouseenter', (event) => {
          // console.log(hintAreaDom.querySelector('.selected'))
          this.hint.hintAreaDom.querySelector('.selected').classList.remove('selected')
          event.target.classList.add('selected')
          this.hint.selectedDom = event.target
        })
        // 鼠标点击选中
        el.addEventListener('click', (event) => {
          this.addText(event.target.innerText + ' ', this.getCaretPos() - this.hint.curWord.length, this.hint.curWord.length)
          this.closeHints()
        })
      })
    },
    closeHints() {
      const hintAreaDom = this.hint.hintAreaDom || document.getElementById('hint-area')
      if (hintAreaDom) {
        hintAreaDom.remove()
      }
      this.hint.hintAreaDom = null
    },
    replaceByPlaceholder(text, placeholderList, reg, className) {
      let result = ''
      while ((result = reg.exec(text)) !== null) {
        placeholderList.push({
          index: result.index,
          content: result[0],
          className: className
        })
      }
    },
    renderContent(text) {
      const placeholderList = []
      // 替换 '' 字符串
      this.replaceByPlaceholder(text, placeholderList, /('[\s\S]*?')/ig, 'string')
      // 替换操作符
      this.replaceByPlaceholder(text, placeholderList, new RegExp('(' + this.operator.join('|') + ')', 'gi'), 'operate')
      // 替换数字
      this.replaceByPlaceholder(text, placeholderList, /(?<=^|\W)(\d+?)(?=$|\W)/g, 'number')
      // 表名
      this.replaceByPlaceholder(text, placeholderList, new RegExp('(?<=(from|join|update|into) +)(\\w+)|(\\w+)(?=\\.)', 'gi'), 'table-name')
      // 列名
      // this.replaceByPlaceholder(text, placeholderList, new RegExp('(?<=(from|join|update|into) +)(\\w+)|(\\w+)(?=\\.)', 'gi'), 'table-name')

      // 倒序处理， 防止先替换前面的数据， 导致后面的数据替换时， 下标错乱的情况
      const sortedPlaceholderList = placeholderList.sort((p1, p2) => p2.index - p1.index)
      for (let i = 0; i < sortedPlaceholderList.length; i++) {
        text = text.slice(0, sortedPlaceholderList[i].index) + ' ' + text.slice(sortedPlaceholderList[i].index + sortedPlaceholderList[i].content.length)
      }
      // 表字段
      // sql 关键字
      this.keywords.forEach(item => {
        text = text.replaceAll(new RegExp(`(?<=^|\\W)(${item})(?=$|\\W)`, 'gi'), `<span class="keyword">$1</span>`)
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
          const queryResult = placeholderList.filter(placeholder => (placeholder.index + 1) === originIndex)
          if (queryResult.length > 0) {
            originIndex += queryResult[0].content.length - 1
            breaks[i] = `<span class="${queryResult[0].className}">${queryResult[0].content}</span>`
          }
        }
      }
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
    inputEvent(event) {
      if (/\w/g.test(event.data)) {
        this.$nextTick(() => {
          this.showHints()
        })
      }
    },
    blurEvent() {
      this.closeHints()
    },
    keydownEvent(event) {
      // console.log(event)
      if (this.hint.hintAreaDom) {
        // 有提示框
        if (event.keyCode === 13) {
          // 回车
          event.preventDefault()
          this.addText(this.hint.selectedDom.innerText + ' ', this.getCaretPos() - this.hint.curWord.length, this.hint.curWord.length)
          this.closeHints()
        }
        if (event.keyCode === 9) {
          event.preventDefault()
          this.addText('    ')
          this.closeHints()
        }
        if (event.keyCode === 40 || event.keyCode === 38) {
          // 下 上 tab
          event.preventDefault()
          // console.log(this.hint.itemDomList.indexOf(this.hint.selectedDom))
          let nextIndex = [].indexOf.call(this.hint.itemDomList, this.hint.selectedDom) +
              (event.keyCode === 40 ? 1 : -1)
          if (nextIndex >= this.hint.itemDomList.length) {
            nextIndex = 0
          } else if (nextIndex < 0) {
            nextIndex = this.hint.itemDomList.length - 1
          }
          this.hint.selectedDom.classList.remove('selected')
          this.hint.itemDomList[nextIndex].classList.add('selected')
          this.hint.selectedDom = this.hint.itemDomList[nextIndex]
        }
      } else {
        if (event.keyCode === 9) {
          // 禁用 tab 默认行为
          event.preventDefault()
          this.addText('    ')
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
            // 标识当前 text 修改来自撤销或重做
            this.redo.isRedo = true
            this.text = history.content
            this.setCaretPos(history.caret)
          }
        }
      }
    },
    keyupEvent(event) {
      if (this.hint.hintAreaDom) {
        // 左右键
        if (event.keyCode === 37 || event.keyCode === 39) {
          if (this.hint.caretPos !== this.getCaretPos()) {
            this.closeHints()
          }
        }
      }
    },
    clickEvent(event) {
      if (this.hint.hintAreaDom) {
        if (this.hint.caretPos !== this.getCaretPos()) {
          this.closeHints()
        }
      }
    },
    addText(addText, caretPos = this.getCaretPos(), delCount = 0) {
      const text = this.text
      this.text = text.slice(0, caretPos) + addText + text.slice(caretPos + Math.abs(delCount))
      this.setCaretPos(caretPos + addText.length)
    },
    getCaretPos() {
      const editTextarea = this.$refs.editTextarea
      if (editTextarea && (editTextarea.selectionStart || editTextarea.selectionStart === 0)) {
        return editTextarea.selectionStart // 获取选定区的开始点
      } else {
        return undefined
      }
    },
    setCaretPos(caretPos) {
      this.$nextTick(() => {
        const editTextarea = this.$refs.editTextarea
        if (editTextarea.setSelectionRange) {
          editTextarea.focus()
          editTextarea.setSelectionRange(caretPos, caretPos)
        }
      })
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
  font-size: 15px;
  line-height: 1.1;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
  width: 100%;
  height: inherit;

  &-pre, &-textarea {
    width: 100%;
    height: 100%;
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
      .operate {
        color: #795548;
      }
      .comment {
        color: #a0a1a7;
      }
      .string {
        color: #249d7f;
      }
      .number {
        color: #ff8645;
      }
      .error {

      }
      .symbol {
        color: #778899;
      }
      .table-name {
        color: crimson;
      }
    }
  }
}
</style>
