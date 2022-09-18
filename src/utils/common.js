// fn 不能使用箭头函数， 这里需要函数执行的 this 进行传递
export function debounce(fn, delay = 300) {
  let timeout = null
  return function() {
    if (timeout) clearTimeout(timeout)
    // 利用apply改变函数指向，使得封装后的函数可以接收event本身
    timeout = setTimeout(() => fn.apply(this, arguments), delay)
  }
}
