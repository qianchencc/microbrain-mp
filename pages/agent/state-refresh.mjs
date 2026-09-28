export function createStateRefresh(refresh) {
 let timer
 const cancel = () => { clearTimeout(timer); timer = undefined }
 return {
  run() { cancel(); return refresh() },
  after(delayMs) { cancel(); timer = setTimeout(() => { timer = undefined; void refresh() }, delayMs) },
  cancel,
 }
}
