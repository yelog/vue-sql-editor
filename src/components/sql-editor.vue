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
        typeMap: {
          'sql': {
            icon: 'icon-sql',
            suffix: ' '
          },
          'table': {
            icon: 'icon-table',
            suffix: ''
          },
          'column': {
            icon: 'icon-freezecolumn',
            suffix: ''
          }
        },
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
    },
    tableColumns() {
      const columns = []
      for (let i = 0; i < this.tables.length; i++) {
        for (let j = 0; j < this.tables[i].column.length; j++) {
          // columns.push(this.tables[i].column[j] + `(${this.tables[i].name})`)
          columns.push({
            value: this.tables[i].column[j],
            leftPrompt: `(${this.tables[i].name})`
          })
        }
      }
      return columns
    },
    renderItemList() {
      return [
        { className: 'comment', immediate: true, regex: /(--[\s\S]*?)(?=$|\n)/gi },
        { className: 'string', immediate: true, regex: /('[\s\S]*?')/gi },
        { className: 'operate', immediate: true, regex: new RegExp('(' + [',', '=', '!=', '\\(', '\\)', '<', '>', ';', '\\*'].join('|') + ')', 'gi') },
        { className: 'number', regex: /(?<=^|\W)(\d+?)(?=$|\W)/g },
        { className: 'keyword', regex: new RegExp(`(?<=^|\\W)(${this.keywords.join('|')})(?=$|\\W)`, 'gi') },
        { className: 'table-name', regex: new RegExp(`(?<=(from|join|update|into)\\W+)(${this.tableNames.join('|')})|(${this.tableNames.join('|')}\\.)`, 'gi') },
        { className: 'column', regex: [/((?<=select\W+)[\s\S]*?(?=$|\W+from))|((?<=\W+on\W+)[\s\S]*?(?=$|\W+where))|((?<=\W+where\W+)[\s\S]*?(?=$|\)))/g, /(\w+)(?!\.|\w)/g] }
      ]
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
    this.text = 'select\n    username, password, sys_user.type as user_type\nfrom\n    sys_user user\n    left join sys_role role on user.role_id = role.id\nwhere username=\'yang\'\n    and sys_user.type in (\'web\')\n    and age between 18 and 30 and role.id < 5'
  },
  methods: {
    generateMatchList(list, type = 'sql') {
      return list
        .map(item => typeof item === 'string' ? { value: item } : item)
        .filter(item => new RegExp(this.hint.curWord.split('').join('\\w*'), 'gi').test(item.value)).map((item) => {
          // 所有第一个匹配的char
          const matchIndexList = []
          const itemArray = item.value.split('')
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
            value: item.value,
            suffix: this.hint.typeMap[type].suffix,
            matchIndexList: matchIndexList,
            icon: this.hint.typeMap[type].icon,
            leftPrompt: item.leftPrompt,
            rightPrompt: item.rightPrompt
          }
        })
    },
    // 展示提示框
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
        // 匹配sql关键字
        matchList.push(...this.generateMatchList(this.keywords, 'sql'))
        // 匹配表名
        matchList.push(...this.generateMatchList(this.tableNames, 'table'))
        // 匹配列名
        matchList.push(...this.generateMatchList(this.tableColumns, 'column'))
      }
      if (matchList.length === 0 || (matchList.length === 1 && matchList[0].content === this.hint.curWord)) {
        this.closeHints()
        return
      }
      // 有需要展示的数据，开始展示
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
      this.hint.hintAreaDom.style.left = (pos.left - 23) + 'px'
      // 设置列表
      innerHtml.push(...matchList
      // 排序， 索引数和最小的最靠上
        .sort((item1, item2) => item1.matchIndexList.reduce((prev, cur) => prev + cur, 0) - item2.matchIndexList.reduce((prev, cur) => prev + cur, 0))
        .map((item, index) => {
          const itemArray = item.value.split('')
          for (let i = 0; i < item.matchIndexList.length; i++) {
            itemArray[item.matchIndexList[i]] = `<span class="matchKey">${itemArray[item.matchIndexList[i]]}</span>`
          }
          return `<div class="hint-area-item ${index === 0 ? 'selected' : ''}" data-value="${item.value + item.suffix}"><div class="hint-area-item-icon iconfont ${item.icon}"></div><div class="hin-area-item-content">${itemArray.join('')}</div><div class="hint-area-item-prompt"><div>${item.leftPrompt || ''}</div><div>${item.rightPrompt || ''}</div></div></div>`
        }))
      this.hint.hintAreaDom.innerHTML = innerHtml.join('')
      // 记录到变量中
      this.hint.selectedDom = this.hint.hintAreaDom.querySelector('.selected')
      this.hint.itemDomList = this.hint.hintAreaDom.querySelectorAll('.hint-area-item')
      this.hint.itemDomList.forEach(el => {
        // 鼠标移动高亮
        // el.addEventListener('mouseenter', (event) => {
        //   // console.log(hintAreaDom.querySelector('.selected'))
        //   this.hint.hintAreaDom.querySelector('.selected').classList.remove('selected')
        //   event.target.classList.add('selected')
        //   this.hint.selectedDom = event.target
        // })
        // 鼠标点击选中
        el.addEventListener('click', (event) => {
          this.addText(event.target.dataset.value, this.getCaretPos() - this.hint.curWord.length, this.hint.curWord.length)
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
    handleRegex(text, startIndex, curPlaceholderList, regexArray, regexIndex, className, immediate) {
      let result = ''
      // 修复仍记录上次lastIndex导致下次查询失败的问题
      regexArray[regexIndex].lastIndex = 0
      while ((result = regexArray[regexIndex].exec(text)) !== null && result[0] !== '') {
        // console.log(className, result)
        if (regexIndex + 1 === regexArray.length) {
          // 当前是最后一个
          curPlaceholderList.push({
            index: startIndex + result.index,
            content: result[0],
            className: className,
            immediate: immediate
          })
        } else {
          this.handleRegex(result[0], startIndex + result.index, curPlaceholderList, regexArray, regexIndex + 1, className, immediate)
        }
      }
    },
    replaceByPlaceholder(text, placeholderList, regex, className, immediate) {
      const curPlaceholderList = []
      this.handleRegex(text, 0, curPlaceholderList, Array.isArray(regex) ? regex : [regex], 0, className, immediate)
      placeholderList.push(...curPlaceholderList)
      if (immediate) {
        const sortedPlaceholderList = curPlaceholderList.sort((p1, p2) => p2.index - p1.index)
        for (let i = 0; i < sortedPlaceholderList.length; i++) {
          text = text.slice(0, sortedPlaceholderList[i].index) + Array.from({ length: sortedPlaceholderList[i].content.length }, () => ' ').join('') + text.slice(sortedPlaceholderList[i].index + sortedPlaceholderList[i].content.length)
        }
      }
      return text
    },
    renderContent(text) {
      const placeholderList = []
      this.renderItemList.forEach(item => {
        text = this.replaceByPlaceholder(text, placeholderList, item.regex, item.className, item.immediate)
      })
      // 没有立即处理的， 倒序处理， 防止先替换前面的数据， 导致后面的数据替换时， 下标错乱的情况
      const sortedPlaceholderList = placeholderList.filter(item => !item.immediate).sort((p1, p2) => p2.index - p1.index)
      for (let i = 0; i < sortedPlaceholderList.length; i++) {
        text = text.slice(0, sortedPlaceholderList[i].index) + Array.from({ length: sortedPlaceholderList[i].content.length }, () => ' ').join('') + text.slice(sortedPlaceholderList[i].index + sortedPlaceholderList[i].content.length)
      }
      // ((?<=select\W+)((\w+)\W*)+?(?=\W*from))|(?<=set\W+)(\w+\W*)+(?=where)|(?<=where\W+)(\w+\W*)+?

      // 还原替换符
      const breaks = text.split('')
      const tagStack = []
      const tag = []
      let originIndex = 0
      let placeholderCount = 0
      for (let i = 0; i < breaks.length; i++) {
        if (placeholderCount > 0) {
          placeholderCount--
          breaks[i] = ''
          continue
        }
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
            placeholderCount = queryResult[0].content.length - 1
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
      } else {
        this.closeHints()
      }
    },
    blurEvent(event) {
      this.closeHints()
    },
    keydownEvent(event) {
      // console.log(event)
      if (this.hint.hintAreaDom) {
        // 有提示框
        if (event.keyCode === 13) {
          // 回车 选中并替换光标前单词
          event.preventDefault()
          this.addText(this.hint.selectedDom.dataset.value, this.getCaretPos() - this.hint.curWord.length
            , this.hint.curWord.length + (this.text[this.getCaretPos()] === ' ' && this.hint.selectedDom.dataset.value.endsWith(' ') ? 1 : 0))
          this.closeHints()
        }
        if (event.keyCode === 9) {
          // tab 选中并替换光标所在单词
          event.preventDefault()
          const theRestWord = []
          for (let i = this.getCaretPos(); i < this.text.length; i++) {
            const curChar = this.text[i]
            if (!/\w/g.test(curChar)) {
              // 如果后面有空格就重写这个空格
              if (curChar === ' ' && this.hint.selectedDom.dataset.value.endsWith(' ')) {
                theRestWord.push(curChar)
              }
              break
            }
            theRestWord.push(curChar)
          }
          this.addText(this.hint.selectedDom.dataset.value, this.getCaretPos() - this.hint.curWord.length
            , this.hint.curWord.length + theRestWord.length)
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
        // esc 关闭提示框
        if (event.keyCode === 27) {
          event.preventDefault()
          this.closeHints()
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
    caret-color: #000000;
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
    color: #000000;
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
      .column {
        color: #2795EE;
      }
    }
  }
}
</style>
