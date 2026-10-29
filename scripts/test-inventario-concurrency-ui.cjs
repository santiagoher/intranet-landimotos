// Isolated browser fixture. Reuses actual UI; every server action is a local mock.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict')
const {spawn}=require('node:child_process'),{pathToFileURL}=require('node:url')
const ts=require('typescript'),webpack=require('next/dist/compiled/webpack/webpack').webpack
const workspace=process.cwd(),ops=path.join(workspace,'src/modules/inventarios/operations')
const output=fs.mkdtempSync(path.join(os.tmpdir(),'landimotos-concurrency-ui-'))
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const write=(name,content)=>{const file=path.join(output,name);fs.writeFileSync(file,content);return file}
const actions=write('actions.js',`
export const task={id:'T',numero:'OP-PRUEBA',bodega_id:'W',categoria_id:'C',asignado_a:'OP',asignado_por:'L',lider_id:'L',estado:'en_proceso',prioridad:'media',version:1,avance_parcial:25,asignado_at:'2026-10-22T10:00:00Z',iniciado_at:'2026-10-22T10:01:00Z',total_productos:2,productos_contados:0};
const products=[{id:'I',code:'SKU-1',name:'Producto de prueba',quantity:null,countedAt:null},{id:'J',code:'SKU-2',name:'Otro producto',quantity:null,countedAt:null}];
globalThis.qa={writes:[],products,task};
export async function getTaskSnapshot(){return structuredClone({task,products})}
export async function saveCountProduct(input){qa.writes.push(input);if(qa.writes.length===1){task.version=2;task.productos_contados=1;products[0].quantity='7';return {error:'La tarea cambió. Actualiza antes de continuar',conflict:true}}if(input.version!==task.version)throw Error('Wrong reviewed version');products.find(p=>p.id===input.item).quantity=input.quantity;task.version++;return {ok:true}}
export async function getEvidence(){return {enabled:false,items:[],note:null}}
export async function getTaskEvents(){return {events:[]}}
export async function assignInventory(){} export async function updateInventory(){} export async function getTrialProducts(){}
export async function uploadEvidence(){} export async function deleteEvidence(){} export async function saveCountNote(){}
`)
const router=write('router.js','export function useRouter(){return {refresh(){}}}')
const loader=write('loader.cjs',`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){
if(this.resourcePath.endsWith('useInventoryMonitor.ts'))source='export function useInventoryMonitor(data){return {data,error:"",blocked:false,retry(){}}}';
if(this.resourcePath.endsWith('OperationsPanel.tsx'))source=source.replace("from './actions'",'from '+${JSON.stringify(JSON.stringify(actions))});
if(this.resourcePath.endsWith('EvidencePanel.tsx'))source=source.replace("from './evidence.actions'",'from '+${JSON.stringify(JSON.stringify(actions))});
return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}`)
const empty=write('empty.cjs','module.exports=function(){return ""}')
const entry=write('entry.js',`import React from 'react';import {createRoot} from 'react-dom/client';import {OperationsPanel} from ${JSON.stringify(path.join(ops,'OperationsPanel.tsx'))};import {task} from './actions.js';
const data={context:{userId:'OP',globalAdmin:false,warehouses:[{id:'W',name:'Bodega de pruebas',role:'operador'}],members:[],users:[],people:[{id:'L',name:'Líder de prueba'},{id:'OP',name:'Operador de prueba'}]},tasks:[structuredClone(task)],categories:[{id:'C',nombre:'Prueba aislada'}],fetchedAt:Date.now()};
createRoot(document.getElementById('root')).render(React.createElement(OperationsPanel,{data,initialNow:Date.now()}));`)
async function main(){
  await new Promise((resolve,reject)=>webpack({mode:'production',optimization:{minimize:false},entry,output:{path:output,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],modules:[path.join(workspace,'node_modules')],alias:{'@':path.join(workspace,'src'),'next/navigation':router}},module:{rules:[{test:/\.tsx?$/,use:[loader]},{test:/\.css$/,use:[empty]}]}},(error,stats)=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()))
  const css=fs.readdirSync('.next/static/chunks').filter(file=>file.endsWith('.css')).map(file=>fs.readFileSync('.next/static/chunks/'+file,'utf8')).join('\n')
  write('preview.css',css)
  const page=write('index.html','<!doctype html><html lang="es"><meta charset="utf-8"><link rel="stylesheet" href="preview.css"><style>body{padding:24px;background:var(--background);color:var(--foreground);font-family:Arial,sans-serif}</style><body><div id="root"></div><script src="bundle.js"></script></body></html>')
  const profile=path.join(output,'edge-profile')
  const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'})
  let socket
  try {
    let port
    for(let n=0;n<100;n++){if(fs.existsSync(path.join(profile,'DevToolsActivePort'))){port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break}await sleep(100)}
    if(!port)throw Error('Browser debugging endpoint unavailable')
    const targets=await (await fetch(`http://localhost:${port}/json/list`)).json()
    socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl)
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
    let nextId=0;const pending=new Map()
    socket.onmessage=event=>{const message=JSON.parse(event.data);if(pending.has(message.id)){const {resolve,reject}=pending.get(message.id);pending.delete(message.id);message.error?reject(Error(JSON.stringify(message.error))):resolve(message.result)}}
    const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
    const evaluate=async expression=>{const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value}
    const until=async expression=>{for(let n=0;n<100;n++){if(await evaluate(expression))return;await sleep(50)}throw Error('Timeout: '+expression)}
    const click=async text=>evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!button||button.disabled)throw Error('Unavailable button: '+${JSON.stringify(text)});button.click()})()`)
    const setInput=async(label,value)=>evaluate(`(()=>{const input=document.querySelector('input[aria-label="${label}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await cdp('Page.enable');await cdp('Page.navigate',{url:pathToFileURL(page).href})
    await until("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Continuar'))")
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Continuar')).click()")
    await until("document.querySelector('input[aria-label=\"Cantidad contada de SKU-1\"]')?.disabled===false")
    await setInput('Cantidad contada de SKU-1','19');await sleep(40);await click('Guardar')
    await until("document.body.textContent.includes('Conservar mi valor para reintentar')&&document.querySelector('input[aria-label=\"Cantidad contada de SKU-1\"]')?.disabled===false")
    assert.equal(await evaluate('qa.writes.length'),1)
    assert.equal(await evaluate("document.querySelector('input[aria-label=\"Cantidad contada de SKU-1\"]').value"),'19')
    assert.equal(await evaluate('qa.products[0].quantity'),'7')
    await setInput('Buscar o escanear producto','Otro');await sleep(40);await setInput('Buscar o escanear producto','');await sleep(40)
    assert.equal(await evaluate("document.querySelector('input[aria-label=\"Cantidad contada de SKU-1\"]').value"),'19')
    for(const theme of ['light','dark'])for(const width of [1280,390]){
      await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`)
      await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await sleep(60)
      assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true)
      const background=await evaluate("getComputedStyle(document.documentElement).getPropertyValue('--background').trim()")
      assert.ok((theme==='dark'?['#0e0f11']:['#fff','#ffffff']).includes(background))
      await evaluate("document.querySelector('tr [role=alert]').scrollIntoView({block:'center'})")
      const contrast=await evaluate(`(()=>{const s=getComputedStyle(document.querySelector('tr [role=alert]'));const luminance=color=>{const rgb=color.match(/[\\d.]+/g).slice(0,3).map(Number).map(n=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};const a=luminance(s.color),b=luminance(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)})()`)
      assert.ok(contrast>=4.5,'Conflict text contrast '+contrast)
      const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,`${theme}-${width}.png`),Buffer.from(screenshot.data,'base64'))
    }
    await click('Conservar mi valor para reintentar');await sleep(50)
    assert.equal(await evaluate('qa.writes.length'),1)
    await click('Guardar');await until('qa.writes.length===2&&qa.products[0].quantity==="19"')
    await sleep(250)
    assert.equal(await evaluate('qa.writes.length'),2);assert.equal(await evaluate('qa.writes[1].version'),2);assert.equal(await evaluate('qa.products[1].quantity'),null)
    console.log('PASS: actual React UI retains 19 vs saved 7 across filtering, no auto retry, explicit review then one manual save with version 2, other item untouched; light/dark desktop/mobile no page overflow.')
    console.log('Artifacts: '+output)
    await cdp('Browser.close')
  } finally {socket?.close();browser.kill()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
