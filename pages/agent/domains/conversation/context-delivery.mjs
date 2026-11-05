// A message-card reference and question are one user intention: accept both or keep both.
export function createContextDelivery({ read, write, confirm, isActive }) {
 let revision = 0
 const same = (a, b) => a.text === b.text && JSON.stringify(a.reference) === JSON.stringify(b.reference) && a.editing === b.editing
 return {
  invalidate() { revision++ },
  async receive(context) {
   const current = ++revision, before = read()
   const next = { ...before, text: context.prompt ?? before.text, reference: context.reference ?? null, editing: false }
   if (same(before, next)) return true
   if ((before.text.trim() || before.reference || before.editing) && !await confirm()) return false
   if (current !== revision || !isActive(before.scope) || !same(before, read())) return false
   write(next)
   return true
  },
 }
}
