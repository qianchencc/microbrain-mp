import 'core-js/actual/atob.js'
import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({html:false,breaks:true})
const styles = {
 p:'margin:0 0 10px;line-height:1.8',
 h1:'font-size:17px;line-height:1.5;margin:18px 0 8px',
 h2:'font-size:17px;line-height:1.5;margin:18px 0 8px',
 h3:'font-size:17px;line-height:1.5;margin:18px 0 8px',
 ul:'padding-left:24px;margin:8px 0',
 ol:'padding-left:24px;margin:8px 0',
 blockquote:'margin:12px 0;padding-left:12px;border-left:2px solid #ccd6d0;color:#617068',
 pre:'overflow-x:auto;scrollbar-width:none;padding:12px;background:#edf0ee;border-radius:6px;white-space:pre',
 code:'font-size:13px',
 table:'display:block;overflow-x:auto;scrollbar-width:none;border-collapse:collapse;max-width:100%',
 th:'padding:6px 12px;border:1px solid #dbe2de;text-align:left',
 td:'padding:6px 12px;border:1px solid #dbe2de;text-align:left',
 img:'max-width:100%',
 a:'color:#176b54;text-decoration:underline'
}
const base = markdown.renderer.renderToken.bind(markdown.renderer)
markdown.renderer.renderToken = (tokens,index,options) => {
 const token = tokens[index]
 if (token.nesting !== -1 && styles[token.tag]) token.attrSet('style',styles[token.tag])
 return base(tokens,index,options)
}
// These rules bypass renderToken, so style their trusted wrappers explicitly.
markdown.renderer.rules.code_inline = (tokens,index) => `<code style="${styles.code}">${markdown.utils.escapeHtml(tokens[index].content)}</code>`
const codeBlock = (tokens,index) => `<pre style="${styles.pre}"><code style="${styles.code}">${markdown.utils.escapeHtml(tokens[index].content)}</code></pre>\n`
markdown.renderer.rules.fence = codeBlock
markdown.renderer.rules.code_block = codeBlock

export function renderMarkdown(content) {
 return markdown.render(content || '')
}
