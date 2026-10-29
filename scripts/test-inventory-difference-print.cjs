// Local browser validation only: synthetic documents, no Supabase or application session.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),assert=require('node:assert/strict')
const {pathToFileURL}=require('node:url')
const WebSocket=require('ws')
const root=process.cwd(),out=fs.mkdtempSync(path.join(os.tmpdir(),'landimotos-difference-print-'))
const webpack=require('next/dist/compiled/webpack/webpack').webpack
const {inflateSync}=require('node:zlib')
const source=path.join(root,'src/modules/inventarios/operations'),wait=ms=>new Promise(r=>setTimeout(r,ms))
const base={ticket:'OP-PRUEBA-IMPRESION',version:8,warehouse:'BODEGA DE PRUEBA',category:'Repuestos de prueba',operator:'Operador de prueba',leader:'Líder de prueba',countedAt:'2026-10-22T18:20:00Z',generatedAt:'2026-10-22T19:20:00Z',demo:true,missingReference:0,pendingCount:0,totalProducts:2}
const mixed={...base,shortages:1,surpluses:1,rows:[
 {id:'1',code:'SKU-000001',name:'Cadena de transmisión reforzada 428 × 120 eslabones para motocicleta de trabajo',expected:'10.000000',counted:'7.125000',difference:'-2.875000',result:'faltante',unit:'UN'},
 {id:'2',code:'SKU-000002',name:'Lubricante para motor de cuatro tiempos, presentación de un litro',expected:'1',counted:'2.000001',difference:'1.000001',result:'sobrante',unit:'L'},
]}
const many={...mixed,totalProducts:80,shortages:40,surpluses:40,rows:Array.from({length:80},(_,i)=>({...mixed.rows[i%2],id:String(i),code:`SKU-${String(i).padStart(4,'0')}-`+'X'.repeat(i%9===0?40:0),name:`Producto ${i} · `+mixed.rows[i%2].name}))}
let browser,ws
// Read the simple Type0 text streams emitted by Chromium for these fixtures.
function pdfPages(buffer){
 const objects=new Map([...buffer.toString('latin1').matchAll(/(\d+) 0 obj\s*([\s\S]*?)endobj/g)].map(m=>[m[1],m[2]]))
 const stream=id=>{const raw=objects.get(id),m=raw?.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);return m?inflateSync(Buffer.from(m[1],'latin1')).toString():''}
 const cmap=id=>{
  const map=new Map(),text=stream(objects.get(id)?.match(/\/ToUnicode (\d+) 0 R/)?.[1])
  for(const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))for(const m of block[1].matchAll(/<([\dA-F]+)>\s*<([\dA-F]+)>/gi))map.set(parseInt(m[1],16),String.fromCodePoint(parseInt(m[2],16)))
  for(const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))for(const m of block[1].matchAll(/<([\dA-F]+)>\s*<([\dA-F]+)>\s*<([\dA-F]+)>/gi))for(let n=parseInt(m[1],16);n<=parseInt(m[2],16);n++)map.set(n,String.fromCodePoint(parseInt(m[3],16)+n-parseInt(m[1],16)))
  return map
 }
 return [...objects.values()].filter(o=>/\/Type\s*\/Page\b/.test(o)).map(page=>{
  const fonts=new Map([...page.matchAll(/\/(F\d+) (\d+) 0 R/g)].map(m=>[m[1],cmap(m[2])]))
  let font='',text='';const content=stream(page.match(/\/Contents (\d+) 0 R/)?.[1])
  for(const m of content.matchAll(/\/(F\d+) [\d.]+ Tf|<([\dA-F]+)> Tj/gi)){
   if(m[1])font=m[1]
   else text+=(m[2].match(/.{4}/g)||[]).map(c=>fonts.get(font)?.get(parseInt(c,16))??'').join('')
  }
  return text
 })
}
async function main(){
 fs.writeFileSync(path.join(out,'ts-loader.cjs'),`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;`)
 fs.writeFileSync(path.join(out,'empty-loader.cjs'),'module.exports=()=>"";')
 fs.writeFileSync(path.join(out,'entry.js'),`import React from 'react';import{createRoot}from'react-dom/client';import{DifferencePrintPreview}from ${JSON.stringify(path.join(source,'DifferencePrintPreview.tsx'))};function Fixture(){const[data,setData]=React.useState(${JSON.stringify(mixed)});window.setDocument=setData;return React.createElement(DifferencePrintPreview,{data});}createRoot(document.body).render(React.createElement(Fixture));`)
 await new Promise((resolve,reject)=>webpack({mode:'development',devtool:false,entry:path.join(out,'entry.js'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.js','.ts','.tsx'],modules:[path.join(root,'node_modules')]},module:{rules:[{test:/\.tsx?$/,use:path.join(out,'ts-loader.cjs')},{test:/\.css$/,use:path.join(out,'empty-loader.cjs')}]},optimization:{minimize:false}},(error,stats)=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()))
 const css=fs.readFileSync(path.join(source,'difference-print.css'),'utf8')
 fs.writeFileSync(path.join(out,'preview.html'),`<!doctype html><html lang="es" class="dark"><head><meta charset="utf-8"><title>Prueba aislada de impresión</title><style>*{box-sizing:border-box}html,body{margin:0;background:#111;color:white}button,select{font:inherit}${css}</style></head><body><script src="bundle.js"></script></body></html>`)
 const exe=process.env.EDGE_BINARY||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
 browser=spawn(exe,['--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions','--remote-debugging-port=0',`--user-data-dir=${path.join(out,'browser')}`,'about:blank'],{windowsHide:true,stdio:'ignore'})
 const portFile=path.join(out,'browser','DevToolsActivePort')
 for(let i=0;!fs.existsSync(portFile)&&i<100;i++)await wait(100)
 const port=fs.readFileSync(portFile,'utf8').split('\n')[0]
 const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
 await new Promise((r,j)=>{const timeout=setTimeout(()=>j(new Error('Browser connection timeout')),15000);ws.onopen=()=>{clearTimeout(timeout);r()};ws.onerror=e=>{clearTimeout(timeout);j(e)}})
 let seq=0;const pending=new Map()
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timeout);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}}
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timeout=setTimeout(()=>reject(new Error('Browser command timeout: '+method)),15000);pending.set(id,{resolve,reject,timeout});ws.send(JSON.stringify({id,method,params}))})
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value}
 await call('Page.enable');await call('Runtime.enable')
 await call('Emulation.setDeviceMetricsOverride',{width:1100,height:1000,deviceScaleFactor:1,mobile:false})
 await call('Page.navigate',{url:pathToFileURL(path.join(out,'preview.html')).href})
 for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector(".difference-table")'))break;await wait(100)}
 assert.equal(await evaluate('document.querySelectorAll(".difference-verified").length'),2)
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".difference-sheet")).backgroundColor'),'rgb(255, 255, 255)')
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true)
 fs.writeFileSync(path.join(out,'preview-dark.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
 // Exercise the real React print handler without opening a system dialog.
 await evaluate('window.printCalls=0;window.print=()=>{window.printCalls++;window.dispatchEvent(new Event("beforeprint"))};Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Imprimir").click()')
 assert.equal(await evaluate('window.printCalls'),1)
 const results=[]
 for(const paper of ['A5','A4']){
  await evaluate(`document.querySelector('select').value='${paper}';document.querySelector('select').dispatchEvent(new Event('change',{bubbles:true}))`)
  await wait(100)
  assert.equal(await evaluate('document.querySelector("main").dataset.paper'),paper)
  for(const [label,data] of [['compact',mixed],['many',many]]){
   await evaluate(`window.setDocument(${JSON.stringify(data)})`);await wait(100)
   await call('Emulation.setEmulatedMedia',{media:'print'})
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".difference-toolbar")).display'),'none')
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".difference-table thead")).display'),'table-header-group')
   const pdf=Buffer.from((await call('Page.printToPDF',{printBackground:false,preferCSSPageSize:true,displayHeaderFooter:false})).data,'base64')
   fs.writeFileSync(path.join(out,`${label}-${paper}.pdf`),pdf)
   const text=pdf.toString('latin1'),pages=(text.match(/\/Type\s*\/Page\b/g)||[]).length
   const media=[...text.matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)].map(m=>m[1])
   assert.ok(pages>0);if(label==='many')assert.ok(pages>1)
   const dims=media[0].trim().split(/\s+/).map(Number)
   assert.ok(Math.abs(dims[2]-(paper==='A5'?419.5:595.3))<2)
   assert.ok(Math.abs(dims[3]-(paper==='A5'?595.3:841.9))<2)
   const pageTexts=pdfPages(pdf),fullText=pageTexts.join(' ')
   assert.equal(pageTexts.length,pages)
   for(const row of data.rows)assert.equal(pageTexts.filter(t=>t.includes(row.code)).length,1,'SKU must remain together on one page: '+row.code)
   for(const pageText of pageTexts.filter(t=>t.includes('SKU-')))assert.ok(pageText.includes('Código SKU')&&pageText.includes('Verificado'),'Table header repeats on each page with rows')
   assert.doesNotMatch(fullText,/Vista previa|Actualizar datos|Papel|firma/i)
   assert.ok(fullText.includes('Observaciones de verificación'))
   results.push({paper,label,pages,media:media[0],rows:data.rows.length,repeatedHeaders:true,completeSkus:true,noApplicationControls:true})
  }
 }
 await evaluate(`window.setDocument(${JSON.stringify(mixed)});document.querySelector('select').value='A5';document.querySelector('select').dispatchEvent(new Event('change',{bubbles:true}))`)
 await call('Emulation.setDeviceMetricsOverride',{width:492,height:900,deviceScaleFactor:1,mobile:false});await wait(100)
 fs.writeFileSync(path.join(out,'print-layout.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2))
 console.log(JSON.stringify({out,results,printButton:'PASS',darkTheme:'PASS',productionWrites:0}))
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{ws?.close();browser?.kill()})
