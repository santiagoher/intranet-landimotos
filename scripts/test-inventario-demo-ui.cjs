// Isolated React wizard fixture: mocked actions, no credentials, no Supabase traffic.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict')
const {spawn}=require('node:child_process'),{pathToFileURL}=require('node:url')
const webpack=require('next/dist/compiled/webpack/webpack').webpack
const root=process.cwd(),output=fs.mkdtempSync(path.join(os.tmpdir(),'landimotos-demo-ui-'))
const write=(name,text)=>{const p=path.join(output,name);fs.writeFileSync(p,text);return p},sleep=ms=>new Promise(r=>setTimeout(r,ms))
const actions=write('actions.js',`globalThis.qa={writes:[],routes:[]};
export async function getBlindCatalog(){return {products:[{id:'I',code:'DEMO-01-001',name:'Guaya de acelerador DEMO',unit:'UN',barcodes:['DEMO-BAR-1'],subcategory:'Acelerador (DEMO)',brand:'Marca A (DEMO)'},{id:'J',code:'DEMO-01-002',name:'Guaya de embrague DEMO',unit:'UN',barcodes:['DEMO-BAR-2'],subcategory:'Embrague (DEMO)',brand:'Marca B (DEMO)'}]}}
export async function createOwnInventory(input){qa.writes.push(input);await new Promise(r=>setTimeout(r,100));return qa.writes.length===1?{error:'Respuesta incierta de prueba'}:{ticket:'TEST-TICKET'}}`)
const router=write('router.js','export function useRouter(){return {refresh(){},push(url){qa.routes.push(url)}}}')
const link=write('link.js',"import React from 'react';export default function Link(props){return React.createElement('a',props)}")
const loader=write('loader.cjs',`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){if(this.resourcePath.endsWith('NewInventory.tsx'))source=source.replace("from './self-start.actions'",'from '+${JSON.stringify(JSON.stringify(actions))});return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}`)
const empty=write('empty.cjs','module.exports=function(){return ""}')
const entry=write('entry.js',`import React from 'react';import {createRoot} from 'react-dom/client';import {NewInventory} from ${JSON.stringify(path.join(root,'src/modules/inventarios/operations/NewInventory.tsx'))};
const data={context:{userId:'OP',globalAdmin:false,warehouses:[{id:'W',name:'Bodega de pruebas',role:'operador'}],members:[{id:'OP',warehouseId:'W',name:'Operador de prueba',role:'operador',leader:false}],people:[{id:'OP',name:'Operador de prueba'}],users:[]},categories:[],tasks:[],fetchedAt:Date.now(),selfStart:{enabled:!location.hash.includes('blocked'),warehouses:['W'],categories:[{id:'C',bodega_id:'W',nombre:'Guayas'}]}};
createRoot(document.getElementById('root')).render(React.createElement(NewInventory,{data}));`)
async function main(){
 await new Promise((resolve,reject)=>webpack({mode:'production',optimization:{minimize:false},entry,output:{path:output,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],modules:[path.join(root,'node_modules')],alias:{'@':path.join(root,'src'),'next/navigation':router,'next/link':link}},module:{rules:[{test:/\.tsx?$/,use:[loader]},{test:/\.css$/,use:[empty]}]}},(error,stats)=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()))
 // Compile repository Tailwind/CSS rather than approximating application styles.
 const postcss=require('next/node_modules/postcss'),tailwind=require('@tailwindcss/postcss')
 const source=fs.readFileSync('src/app/globals.css','utf8')+'\n'+fs.readFileSync('src/modules/inventarios/operations/new-inventory.css','utf8')
 const css=await postcss([tailwind({base:root})]).process(source,{from:path.join(root,'src/app/globals.css')})
 write('preview.css',css.css)
 const page=write('index.html','<!doctype html><html lang="es" data-theme="light"><meta charset="utf-8"><link rel="stylesheet" href="preview.css"><style>body{padding:24px;background:var(--background);color:var(--foreground);font-family:Arial,sans-serif}</style><body><div id="root"></div><script src="bundle.js"></script></body></html>')
 const profile=path.join(output,'edge-profile'),browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'})
 let socket
 process.on('exit',()=>browser.kill())
 try{
  let port
  for(let n=0;n<100;n++){if(fs.existsSync(path.join(profile,'DevToolsActivePort'))){port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break}await sleep(100)}
  if(!port)throw Error('No browser endpoint')
  const targets=await(await fetch(`http://localhost:${port}/json/list`)).json()
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
  let next=0;const requests=new Map();socket.onmessage=e=>{const m=JSON.parse(e.data);if(requests.has(m.id)){const {resolve,reject}=requests.get(m.id);requests.delete(m.id);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)}}
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>reject(Error('CDP timeout: '+method)),10000);requests.set(id,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});socket.send(JSON.stringify({id,method,params}))})
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
  const until=async expression=>{for(let n=0;n<100;n++){if(await evaluate(expression))return;await sleep(40)}throw Error('Timeout: '+expression)}
  const click=label=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Button unavailable');b.click()})()`)
  await cdp('Page.enable');await cdp('Page.navigate',{url:pathToFileURL(page).href});await until("document.body.textContent.includes('Paso 1 de 3')")
  assert.equal(await evaluate("document.querySelector('select').value"),'W')
  await click('Continuar');await until("document.body.textContent.includes('Paso 2 de 3')")
  await evaluate("const s=document.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'C');s.dispatchEvent(new Event('change',{bubbles:true}))")
  await until("document.body.textContent.includes('2 referencias SKU')")
  const select=async(index,value)=>evaluate(`(()=>{const s=document.querySelectorAll('select')[${index}];Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(value)});s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await select(2,'Marca B (DEMO)');await until("document.body.textContent.includes('1 referencia SKU')")
  assert.equal(await evaluate("document.querySelector('tbody').textContent.includes('DEMO-01-001')"),false)
  await select(1,'Acelerador (DEMO)');await until("document.querySelectorAll('select')[2].value===''")
  assert.equal(await evaluate("document.querySelector('tbody').textContent.includes('DEMO-01-002')"),false)
  assert.equal(await evaluate("[...document.querySelectorAll('select')[2].options].some(o=>o.value==='Marca B (DEMO)')"),false)
  await select(1,'');await until("document.body.textContent.includes('2 referencias SKU')")
  await select(2,'Marca A (DEMO)');await until("document.body.textContent.includes('1 referencia SKU')")
  for(const theme of ['light','dark'])for(const width of [1280,768,390]){
   await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await sleep(80)
   assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true)
   const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(output,`filters-${theme}-${width}.png`),Buffer.from(shot.data,'base64'))
  }
  assert.equal(await evaluate("document.body.textContent.includes('Referencia del sistema')"),false)
  await click('Continuar');await until("document.body.textContent.includes('Paso 3 de 3')")
  assert.equal(await evaluate("document.body.textContent.includes('Se valida al crear el inventario')"),true)
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Crear e iniciar')).disabled"),false)
  for(const theme of ['light','dark'])for(const width of [1280,768,390]){
   await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await sleep(80)
   assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true)
   const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(output,`${theme}-${width}.png`),Buffer.from(shot.data,'base64'))
  }
  await evaluate("const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Crear e iniciar'));b.click();b.click()")
  await until("document.body.textContent.includes('Respuesta incierta')")
  assert.equal(await evaluate('qa.writes.length'),1);assert.equal(await evaluate('qa.routes.length'),0)
  assert.deepEqual(await evaluate('qa.writes[0].productIds'),['I'])
  assert.equal(await evaluate('qa.writes[0].brand'),'Marca A (DEMO)')
  assert.equal(await evaluate('qa.writes[0].subcategory'),'')
  await click('Reintentar confirmación');await until('qa.routes.length===1')
  assert.equal(await evaluate('qa.writes.length'),2);assert.equal(await evaluate('qa.writes[0].key===qa.writes[1].key'),true)
  assert.equal(await evaluate('qa.routes[0]'),'/inventarios/registros?ticket=TEST-TICKET')
  await cdp('Page.navigate',{url:pathToFileURL(page).href+'?test=blocked#blocked'});await until("document.body.textContent.includes('Creación pendiente')")
  assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Crear'))"),false)
  console.log('PASS UI: automatic warehouse, 3 steps, DEMO SKU catalogue, light/dark 1280/768/390 no overflow, double click guarded, failed response no redirect, same-key retry then existing count route, blocked environment. Artifacts: '+output)
  await cdp('Browser.close')
 }finally{socket?.close();browser.kill()}
}
const watchdog=setTimeout(()=>{console.error('UI test timed out');process.exit(1)},90000)
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>clearTimeout(watchdog))
