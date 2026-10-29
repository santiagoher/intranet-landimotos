import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = path.dirname(fileURLToPath(import.meta.url))
function load(file) {
  const mod = { exports: {} }
  const source = ts.transpileModule(readFileSync(path.join(root,file),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
  }).outputText
  vm.runInNewContext(source,{module:mod,exports:mod.exports,require:name=>{
    if(name.endsWith('.css'))return {}
    if(name==='next/navigation') return { useRouter:()=>({refresh(){}}) }
    if(name==='./actions'||name==='./self-start.actions'||name==='./evidence.actions') return {}
    if(name==='server-only')return {}
    if(name==='@/components/TablePagination') return {TablePagination:()=>null}
    if(name==='../components/InventoryPrimitives') return {inventoryFieldClass:'field'}
    if(name.startsWith('.')) return load(name+(existsSync(path.join(root,name+'.ts'))?'.ts':'.tsx'))
    return require(name)
  }})
  return mod.exports
}
const {progress,isVerified,isOverdue,elapsed,taskCommands,hasCompleteReviewComparison}=load('types.ts')

test('leader can review a completed operator DEMO while incomplete and official self-starts remain blocked',()=>{
  const task={total_productos:2,origen_creacion:'creado_por_operador',es_prueba:true}
  const comparison=[
    {id:'A',expected:'10',counted:'12',difference:'2',result:'sobrante'},
    {id:'B',expected:'0',counted:'0',difference:'0',result:'coincide'},
  ]
  assert.equal(hasCompleteReviewComparison(task,comparison),true)
  assert.equal(hasCompleteReviewComparison({...task,es_prueba:false},comparison),false)
  assert.equal(hasCompleteReviewComparison({...task,es_prueba:undefined},comparison),false)
  assert.equal(hasCompleteReviewComparison(task,comparison.slice(0,1)),false)
  assert.equal(hasCompleteReviewComparison({...task,total_productos:0},[]),false)
  for(const field of ['expected','counted']) {
    for(const missing of [null,undefined]) {
      assert.equal(hasCompleteReviewComparison(task,[{...comparison[0],[field]:missing},comparison[1]]),false)
    }
  }
  assert.equal(hasCompleteReviewComparison({...task,origen_creacion:null,es_prueba:false},comparison),true)
})
const {parseProductReport,parseAssignmentReport,filterProducts}=load('report.ts')
const {OperationsPanel}=load('OperationsPanel.tsx')
const {NewInventory}=load('NewInventory.tsx')
const {displayQuantity}=load('quantity.ts')
const {validateEvidenceImage,safeImageName}=load('evidence-image.server.ts')
const {readableHistory,historyTitle,quantityChange,groupHistory,inventoryProcess,historyKind}=load('history.ts')
const {InventoryHistory}=load('InventoryHistory.tsx')
const {EvidenceGallery}=load('EvidencePanel.tsx')
const now=Date.parse('2026-10-20T12:00:00Z')
const {assignedByName,operatorTasks,normalizePriority}=load('task-list.ts')
const listData={context:{userId:'OP',globalAdmin:false,warehouses:[{id:'W',name:'Warehouse',role:'operador'}],members:[],users:[],people:[{id:'AUTHOR',name:'Actual author'},{id:'LEADER',name:'Warehouse leader'},{id:'OP',name:'Operator'}]},categories:[{id:'C',nombre:'Cadenas'}],tasks:[],fetchedAt:now}
const taskFixture={id:'A',numero:'OP-00000001',categoria_id:'C',bodega_id:'W',asignado_a:'OP',asignado_por:'AUTHOR',lider_id:'LEADER',estado:'asignado',prioridad:'normal',avance_parcial:0,asignado_at:'2026-10-20T12:00:00Z',total_productos:40,productos_contados:12}
const noFilters={search:'',state:'',priority:'',warehouse:''}
const {monitoredTasks,filterMonitorTasks,emptyMonitorFilters,groupMonitorTasks,lastKnownActivity,closedToday}=load('monitor.ts')
const {MonitorGroups}=load('LeaderMonitor.tsx')

test('leader monitor scopes mixed roles, combines filters and normalizes legacy priorities',()=>{
  const data={...listData,context:{...listData.context,userId:'LEADER',warehouses:[{id:'W',name:'Warehouse',role:'lider'},{id:'OTHER',name:'Other',role:'operador'}]},tasks:[taskFixture,{...taskFixture,id:'B',asignado_a:'OP2',prioridad:'urgente',estado:'cerrado',cierre_con_diferencias:true},{...taskFixture,id:'C',bodega_id:'OTHER'},{...taskFixture,id:'D',bodega_id:'FOREIGN'}]}
  assert.equal(monitoredTasks(data).length,2)
  assert.equal(filterMonitorTasks(data,{...emptyMonitorFilters,operator:'OP2',priority:'alta',state:'differences'},'activity')[0].id,'B')
  assert.equal(filterMonitorTasks(data,{...emptyMonitorFilters,search:'  CADENAS  ',priority:'media'},'newest').length,1)
  const html=renderToStaticMarkup(React.createElement(OperationsPanel,{data,initialNow:now}))
  assert.ok(html.includes('Monitoreo de inventarios'));assert.ok(!html.includes('value="OTHER"'))
  assert.ok(html.includes('Por estado'));assert.ok(html.includes('Por operador'));assert.ok(html.includes('Filtrar operador'))
})

test('monitor activity uses actual known timestamps, and closed today respects Bogota midnight',()=>{
  const task={...taskFixture,estado:'cerrado',asignado_at:'2026-10-20T01:00:00Z',cerrado_at:'2026-10-20T04:59:00Z',enviado_at:'2026-10-20T03:00:00Z'}
  assert.equal(closedToday([task],now),0)
  assert.equal(closedToday([{...task,cerrado_at:'2026-10-20T05:00:00Z'},{...task,estado:'enviado_verificacion',cerrado_at:null}],now),1)
  assert.equal(lastKnownActivity(task,{...listData,notifications:[{ticket_id:'FOREIGN',created_at:'2026-10-25T10:00:00Z'},{ticket_id:'A',created_at:'2026-10-20T06:00:00Z'}]}),'2026-10-20T06:00:00Z')
  const data={...listData,context:{...listData.context,warehouses:[{id:'W',role:'lider'}]},tasks:[task,{...taskFixture,id:'B',asignado_at:'2026-10-19T12:00:00Z',iniciado_at:'2026-10-20T07:00:00Z'}]}
  assert.equal(filterMonitorTasks(data,emptyMonitorFilters,'activity')[0].id,'B')
  assert.equal(filterMonitorTasks(data,emptyMonitorFilters,'newest')[0].id,'A')
  assert.equal(filterMonitorTasks(data,emptyMonitorFilters,'oldest')[0].id,'B')
})

test('monitor grouping preserves official and unknown states and does not duplicate or lose tasks',()=>{
  const tasks=[taskFixture,{...taskFixture,id:'B',estado:'aceptado'},{...taskFixture,id:'C',estado:'future_state',asignado_a:null},{...taskFixture,id:'D',estado:'future_state'}]
  for(const mode of ['state','operator']) {
    const grouped=groupMonitorTasks(tasks,mode)
    assert.equal([...grouped.values()].flat().length,4)
    assert.ok([...grouped.values()].every(list=>list.length>0))
  }
  assert.equal(groupMonitorTasks(tasks,'state').get('future_state').length,2)
  assert.equal(groupMonitorTasks(tasks,'operator').get('OP').length,3)
  const html=renderToStaticMarkup(React.createElement(MonitorGroups,{data:listData,tasks,mode:'operator',onOpen(){}}))
  assert.ok(html.includes('Operator'));assert.ok(html.includes('Sin asignar'))
  assert.equal((html.match(/class="monitor-card"/g)??[]).length,4)
})

test('evidence gallery preserves the three-photo limit and hides upload controls in read-only mode',()=>{
  const item={id:'1',usuario_id:'OP',nombre_original:'foto.webp',estado:'vigente',created_at:'2026-10-21T13:00:00Z',url:null}
  const props={items:[item],editable:false,uploadsEnabled:true,busy:false,name:()=> 'Operador',onOpen(){},onRemove(){},onAdd(){}}
  const readonly=renderToStaticMarkup(React.createElement(EvidenceGallery,props))
  assert.ok(!readonly.includes('Agregar evidencia'));assert.ok(!readonly.includes('Eliminar'))
  const editable=renderToStaticMarkup(React.createElement(EvidenceGallery,{...props,editable:true}))
  assert.ok(editable.includes('Agregar evidencia'));assert.ok(editable.includes('2 espacios disponibles'))
  const full=renderToStaticMarkup(React.createElement(EvidenceGallery,{...props,editable:true,items:[item,{...item,id:'2'},{...item,id:'3'}]}))
  assert.ok(!full.includes('Agregar evidencia'))
})

test('operator detail actions have accessible labels and dashboard retains blind-count restrictions',()=>{
  const task={...taskFixture,estado:'cerrado',cierre_con_diferencias:true}
  const html=renderToStaticMarkup(React.createElement(OperationsPanel,{data:{...listData,tasks:[task]},initialNow:now}))
  assert.ok(html.includes('Resumen de mis inventarios'))
  assert.ok(html.includes(`aria-label="Ver detalle ${task.numero}"`))
  assert.ok(!html.includes('Referencia del sistema'))
})

const eventFixture=(id,evento,minute=0,extra={})=>({id,evento,actor_id:'OP',actor_rol:'operador',created_at:new Date(now+minute*60000).toISOString(),motivo:null,...extra})
test('history groups only adjacent same-author counts within five minutes without losing changes',()=>{
  const events=[eventFixture('1','producto_contado'),eventFixture('2','producto_contado',1),eventFixture('3','observacion_guardada',2),eventFixture('4','producto_contado',3),eventFixture('5','producto_contado',4,{actor_id:'OTHER'}),eventFixture('6','producto_contado',10,{actor_id:'OTHER'})]
  const grouped=groupHistory(events)
  assert.equal(grouped.map(g=>g.length).join(','),'2,1,1,1,1')
  assert.equal(grouped.flat().map(e=>e.id).join(','),events.map(e=>e.id).join(','))
})
test('history formats recorded quantities precisely and preserves unrecognized messages',()=>{
  const event=eventFixture('1','producto_contado',0,{motivo:'SKU:001: sin contar → 10.000000'})
  assert.equal(quantityChange(event).code,'SKU:001');assert.equal(quantityChange(event).after,'10');assert.equal(historyTitle(event,''),'Cantidad registrada')
  const changed={...event,motivo:'SKU:001: 8.000000 → 99999999999999.123450'}
  assert.equal(quantityChange(changed).before,'8');assert.equal(quantityChange(changed).after,'99999999999999.12345');assert.equal(historyTitle(changed,''),'Cantidad actualizada')
  assert.equal(quantityChange({...event,motivo:'Texto anterior sin estructura'}),null)
  assert.equal(historyKind(eventFixture('2','evidencia_adjunta')),'Evidencia')
  assert.equal(historyKind(eventFixture('3','desconocido')),'Sistema')
})
test('process resets delivery and review on recount and never fabricates a new start date',()=>{
  const events=[eventFixture('1','asignado'),eventFixture('2','iniciar',1),eventFixture('3','finalizar',2),eventFixture('4','revisar',3),eventFixture('5','devolver',4,{actor_id:'LEADER'})]
  const task={...taskFixture,estado:'en_proceso',iniciado_at:events[1].created_at,enviado_at:null,verificacion_iniciada_at:null}
  const steps=inventoryProcess(task,events)
  assert.equal(steps.find(s=>s.key==='count').status,'current');assert.equal(steps.find(s=>s.key==='count').date,null)
  assert.equal(steps.find(s=>s.key==='submitted').status,'pending');assert.equal(steps.find(s=>s.key==='review').status,'pending')
  assert.equal(steps.find(s=>s.key==='recount').actor,'LEADER')
  const closed=inventoryProcess({...task,estado:'cerrado',cierre_con_diferencias:true},[...events,eventFixture('6','verificado_cerrado_con_diferencias',5)])
  assert.equal(closed.at(-1).status,'done');assert.equal(closed.at(-1).label,'Cerrado con diferencias')
})
test('history renders both blocks, evidence access, raw admin details and resilient empty/error states',()=>{
  const props={task:taskFixture,events:[eventFixture('1','evidencia_adjunta',0,{entidad_id:'PHOTO',motivo:'foto.webp'}),eventFixture('2','observacion_guardada',1,{motivo:'Etiqueta dañada'})],loading:false,name:id=>id,warehouse:'Bodega',category:'Cadenas',onEvidence(){},admin:false}
  const html=renderToStaticMarkup(React.createElement(InventoryHistory,props))
  for(const text of ['Proceso del inventario','Actividad en la app','Abrir evidencia','Etiqueta dañada'])assert.ok(html.includes(text))
  assert.ok(!html.includes('Datos del registro'))
  assert.ok(renderToStaticMarkup(React.createElement(InventoryHistory,{...props,admin:true})).includes('Datos del registro'))
  assert.ok(renderToStaticMarkup(React.createElement(InventoryHistory,{...props,events:[]})).includes('Sin actividad registrada'))
  assert.ok(!renderToStaticMarkup(React.createElement(InventoryHistory,{...props,error:'Consulta fallida'})).includes('Sin actividad registrada'))
})
test('count detail hides internal history from operators but preserves supervisor history',()=>{
  const own={...taskFixture,iniciado_at:null,enviado_at:null,verificacion_iniciada_at:null,verificacion_finalizada_at:null,cerrado_at:null}
  const operator=renderToStaticMarkup(React.createElement(OperationsPanel,{data:{...listData,tasks:[own]},initialNow:now,initialTicket:'A'}))
  assert.ok(operator.includes('Observaciones y evidencias'))
  assert.ok(!operator.includes('Historial de cambios'))
  assert.ok(!operator.includes('Información y tiempos del inventario'))
  const leaderData={...listData,context:{...listData.context,userId:'LEADER',warehouses:[{id:'W',name:'Warehouse',role:'lider'}]},tasks:[own]}
  const leader=renderToStaticMarkup(React.createElement(OperationsPanel,{data:leaderData,initialNow:now,initialTicket:'A'}))
  assert.ok(leader.includes('Historial de cambios'));assert.ok(leader.includes('Observaciones y evidencias'))
})
test('quantity formatting removes only insignificant zeros without floating point rounding',()=>{
  assert.equal(displayQuantity('9.000000'),'9');assert.equal(displayQuantity('0.000000'),'0')
  assert.equal(displayQuantity('99999999999999.123450'),'99999999999999.12345')
  assert.equal(displayQuantity('0.000001'),'0.000001');assert.equal(displayQuantity(null),'Sin contar')
})
test('evidence images are decoded, whitelisted and re-encoded; invalid and oversized inputs rejected',async()=>{
  const sharp=require('sharp')
  const png=await sharp({create:{width:16,height:16,channels:3,background:'#446688'}}).png().toBuffer()
  const first=await validateEvidenceImage(png),second=await validateEvidenceImage(png)
  assert.equal(first.hash,second.hash);assert.equal(first.mime,'image/webp')
  assert.equal((await sharp(first.body).metadata()).format,'webp')
  await assert.rejects(()=>validateEvidenceImage(Buffer.from('not an image')))
  await assert.rejects(()=>validateEvidenceImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')))
  await assert.rejects(()=>validateEvidenceImage(Buffer.alloc(5*1024*1024+1)))
  assert.equal(safeImageName('../../test<>.png'),'test.png')
})
test('assignment author is historical author, never operator or warehouse leader',()=>{
  assert.equal(assignedByName(taskFixture,listData.context),'Actual author')
  assert.equal(assignedByName({...taskFixture,asignado_por:null},listData.context),'No registrado')
  assert.equal(assignedByName({...taskFixture,asignado_por:'UNKNOWN'},listData.context),'No registrado')
})
test('self-start preserves separate creator and leader and exposes no assignment controls',()=>{
  const own={...taskFixture,asignado_por:null,origen_creacion:'creado_por_operador',creado_por:'OP',estado:'en_proceso'}
  assert.equal(assignedByName(own,listData.context),'Autoiniciado')
  const html=renderToStaticMarkup(React.createElement(OperationsPanel,{data:{...listData,tasks:[own]},initialNow:now}))
  assert.ok(html.includes('Autoiniciado'));assert.ok(html.includes('Continuar'))
  assert.ok(!html.includes('Asignar inventario'))
  assert.equal(taskCommands({...own,estado:'en_verificacion'},'lider','LEADER').map(x=>x[0]).join(','),'verificar_cerrar,devolver')
  assert.equal(taskCommands({...own,estado:'en_verificacion'},'operador','OP').length,0)
})
test('new inventory safely handles pending migration and authorized single warehouse',()=>{
  const unavailable=renderToStaticMarkup(React.createElement(NewInventory,{data:listData}))
  assert.ok(unavailable.includes('pendiente de habilitación'))
  assert.ok(!unavailable.includes('Crear e iniciar inventario'))
  const ready=renderToStaticMarkup(React.createElement(NewInventory,{data:{...listData,selfStart:{enabled:true,warehouses:['W']}}}))
  assert.ok(ready.includes('Paso 1 de 3'));assert.ok(ready.includes('value="W" selected=""'))
  assert.ok(!ready.includes('Asignar inventario'));assert.ok(!ready.includes('expectedQuantity'))
})
test('operator filters and sorts only assigned authorized tickets',()=>{
  const data={...listData,tasks:[taskFixture,{...taskFixture,id:'B',prioridad:'urgente',asignado_at:'2026-10-21T12:00:00Z'},{...taskFixture,id:'C',prioridad:'baja'},{...taskFixture,id:'FOREIGN',asignado_a:'OTHER'},{...taskFixture,id:'OTHER_WAREHOUSE',bodega_id:'OTHER'}]}
  assert.equal(operatorTasks(data,noFilters,{key:'priority',direction:'asc'}).map(t=>t.id).join(','),'B,A,C')
  assert.equal(operatorTasks(data,noFilters,{key:'date',direction:'desc'})[0].id,'B')
  assert.equal(operatorTasks(data,{...noFilters,priority:'media',search:'cadenas'},{key:'date',direction:'asc'}).length,1)
  assert.equal(operatorTasks(data,{...noFilters,state:'cerrado'},{key:'date',direction:'asc'}).length,0)
  const mixed={...data,tasks:[taskFixture,{...taskFixture,id:'OWN',origen_creacion:'creado_por_operador',creado_por:'OP'}]}
  assert.equal(operatorTasks(mixed,{...noFilters,origin:'self'},{key:'date',direction:'asc'}).map(t=>t.id).join(','),'OWN')
  assert.equal(operatorTasks(mixed,{...noFilters,origin:'assigned'},{key:'date',direction:'asc'}).map(t=>t.id).join(','),taskFixture.id)
  assert.equal(normalizePriority('urgente'),'alta')
  assert.equal(normalizePriority('normal'),'media')
})
test('operator has compact table, true author and SKU progress without administrative controls',()=>{
  const html=renderToStaticMarkup(React.createElement(OperationsPanel,{data:{...listData,tasks:[taskFixture]},initialNow:now}))
  for(const text of ['Asignado por','Actual author','12 / 40 productos','30 %','Iniciar','Más recientes'])assert.ok(html.includes(text),text)
  for(const text of ['Warehouse leader','Vista por columnas','Promedio ejecución','Agrupar por','Asignar inventario','Todas mis bodegas','Urgente'])assert.ok(!html.includes(text),text)
  assert.ok(html.includes('aria-sort="descending"'))
  const stages=renderToStaticMarkup(React.createElement(OperationsPanel,{data:{...listData,tasks:[{...taskFixture,total_productos:0}]},initialNow:now}))
  assert.ok(stages.includes('Progreso por etapas'))
})
test('progress and overdue use explicit operational milestones and terminal states',()=>{
  for(const [state,value] of [['asignado',10],['en_proceso',25],['enviado_verificacion',70],['en_verificacion',85],['verificado_sin_diferencias',100],['cerrado',100]]) {
    assert.equal(progress({estado:state,avance_parcial:0}),value)
  }
  assert.equal(progress({estado:'en_proceso',avance_parcial:48}),48)
  assert.equal(isOverdue({estado:'asignado',vencimiento_at:'2026-10-19T12:00:00Z'},now),true)
  assert.equal(isOverdue({estado:'cerrado',vencimiento_at:'2026-10-19T12:00:00Z'},now),false)
  assert.equal(elapsed('2026-10-20T10:30:00Z',null,now),'1 h 30 min')
})
test('operator rendering excludes assignment and membership controls; manager rendering includes them',()=>{
  const base={userId:'TEST',globalAdmin:false,warehouses:[],members:[],users:[],people:[]}
  for(const role of ['operador','lider','administrador']) {
    const data={context:{...base,globalAdmin:role==='administrador',warehouses:[{id:'W',name:'TEST BODEGA',role,origin:'excel'}]},
      tasks:[],categories:[],fetchedAt:now}
    const html=renderToStaticMarkup(React.createElement(OperationsPanel,{data,initialNow:now}))
    assert.equal(html.includes('Asignar inventario'),role==='lider')
    assert.equal(html.includes('Equipo y bodegas'),role==='administrador')
    assert.ok(html.includes(role==='operador'?'Sin tareas en este alcance':'Aún no hay inventarios en este alcance'))
    assert.equal(html.includes('Monitoreo de inventarios'),role!=='operador')
  }
})

test('administration is read-only at every stage and only the leader can close discrepancies',()=>{
  for(const estado of ['asignado','en_proceso','enviado_verificacion','en_verificacion','verificado_sin_diferencias','verificado_con_diferencias','cerrado']) {
    assert.equal(taskCommands({estado,asignado_a:'OP'},'administrador','ADMIN').length,0)
  }
  const task={estado:'verificado_con_diferencias',asignado_a:'OP'}
  assert.equal(taskCommands(task,'operador','OP').length,0)
  assert.equal(taskCommands(task,'lider','LEADER').map(c=>c[0]).join(','),'verificar_cerrar,devolver')
  task.estado='cerrado';task.cierre_con_diferencias=true
  assert.equal(taskCommands(task,'lider','LEADER').length,0)
  assert.equal(isVerified(task),false)
})

test('leader review always exposes exactly two decisions and excludes self-review',()=>{
  for(const estado of ['enviado_verificacion','en_verificacion','verificado_sin_diferencias','verificado_con_diferencias']) {
    const task={estado,asignado_a:'OP'}
    assert.equal(JSON.stringify(taskCommands(task,'lider','LEADER')),JSON.stringify([['verificar_cerrar','Verificar y cerrar'],['devolver','Devolver al operador']]))
    assert.equal(taskCommands(task,'lider','OP').length,0)
  }
})

test('report import preserves codes, accepts quoted descriptions, and discards expected stock',()=>{
  const rows=parseProductReport('\uFEFFCódigo;Descripción;Familia;Grupo;SubGrupo;Marcas;Existencias\r\n001;"Filtro; aceite";ACCESORIOS;Motor;Filtros;ACME;987654\r\n002;"Luz ""LED""";ACCESORIOS;Luces;;OTRA;123456')
  assert.equal(rows[0].code,'001')
  assert.equal(rows[0].name,'Filtro; aceite')
  assert.equal(rows[1].name,'Luz "LED"')
  assert.deepEqual(Object.keys(rows[0]).sort(),['brand','code','family','group','name','subgroup'])
  assert.ok(!JSON.stringify(rows).includes('987654'))
  assert.equal(filterProducts(rows,{family:'ACCESORIOS',group:'Motor',subgroup:'',brand:''}).length,1)
  assert.equal(filterProducts(rows,{family:'ACCESORIOS',group:'Motor',subgroup:'',brand:'OTRA'}).length,0)
  assert.equal(parseProductReport('sku,nombre\n0001,Manigueta')[0].code,'0001')
  assert.equal(parseProductReport('Referencia\tProducto\n002\tLubricante')[0].name,'Lubricante')
})

test('report rejects missing identifiers, duplicated codes and malformed rows',()=>{
  for(const text of ['Nombre;Cantidad\nTEST;1','codigo;nombre\n1;','codigo;nombre\n1;A\n1;B','codigo;nombre\n1;A;extra','codigo;nombre\n1;"abierto']) {
    assert.throws(()=>parseProductReport(text))
  }
})

test('count completion is independent of supervisor verification',()=>{
  const task={estado:'en_proceso',avance_parcial:25,total_productos:4,productos_contados:0}
  assert.equal(progress(task),0)
  task.productos_contados=1
  assert.equal(progress(task),25)
  task.productos_contados=4
  assert.equal(progress(task),100)
  assert.equal(isVerified(task),false)
  task.estado='verificado_con_diferencias'
  assert.equal(isVerified(task),false)
  task.estado='verificado_sin_diferencias'
  assert.equal(isVerified(task),true)
})

test('supervisor import preserves reference decimals but never mistakes missing values for zero',()=>{
  const rows=parseAssignmentReport('Código;Nombre;Cantidad\n001;A;0\n002;B;12345678901234.123456\n003;C;2,125')
  assert.equal(rows[0].expectedQuantity,'0')
  assert.equal(rows[1].expectedQuantity,'12345678901234.123456')
  assert.equal(rows[2].expectedQuantity,'2.125')
  assert.equal(parseAssignmentReport('Código;Nombre\n001;A')[0].expectedQuantity,undefined)
  for(const value of ['', 'NaN','-1','1.000,50','1e2'])assert.throws(()=>parseAssignmentReport(`Código;Nombre;Cantidad\n001;A;${value}`))
})

test('trial catalog is explicitly hypothetical and its blind projection has no balances',()=>{
  const {getTrialCatalog,withoutReference}=load('catalog.server.ts')
  const products=getTrialCatalog()
  assert.equal(products.length,8)
  assert.ok(products.every(p=>p.code.startsWith('PRUEBA-') && p.expectedQuantity!==undefined))
  for(const p of products)assert.equal(Object.hasOwn(withoutReference(p),'expectedQuantity'),false)
  products[0].expectedQuantity='999'
  assert.equal(getTrialCatalog()[0].expectedQuantity,'20')
})

test('supervisor report can open full task history and identifies trial records',()=>{
  const data={context:{userId:'ADMIN',globalAdmin:true,warehouses:[{id:'W',name:'BODEGA',role:'administrador'}],members:[],users:[],people:[]},
    tasks:[{id:'T',numero:'TEST-1',bodega_id:'W',categoria_id:'C',asignado_a:'O',estado:'en_proceso',prioridad:'normal',avance_parcial:25,asignado_at:new Date(now).toISOString(),es_prueba:true,total_productos:3,productos_contados:2}],
    categories:[{id:'C',nombre:'CAT'}],reconciliations:[{ticketId:'T',total:3,pending:1,missingReference:0,matched:1,shortages:1,surpluses:0}],fetchedAt:now}
  const html=renderToStaticMarkup(React.createElement(OperationsPanel,{data,initialNow:now,reports:true}))
  for(const text of ['Informe detallado por tarea','Ver detalle','Faltantes','Sobrantes','Prueba'])assert.ok(html.includes(text))
})

test('legacy assignment rows become one readable event without losing notes or unrelated history',()=>{
  const base={actor_id:'L',actor_rol:'lider',created_at:'2026-10-21T13:46:00Z'}
  const reference={...base,id:'R',evento:'referencia_registrada',motivo:'Inventario de prueba'}
  const assigned={...base,id:'A',evento:'asignado',motivo:'Contar estos productos'}
  const later={...reference,id:'LATER',created_at:'2026-10-21T14:00:00Z'}
  const result=readableHistory([reference,assigned,later])
  assert.equal(result.length,2)
  assert.equal(result[0].motivo,assigned.motivo)
  assert.equal(result[0].contexto,reference.motivo)
  assert.equal(result[1].id,'LATER')
  assert.equal(historyTitle(result[0],'PRINCIPAL DESPACHO'),'Inventario creado y asignado a PRINCIPAL DESPACHO')
  assert.equal(readableHistory([reference]).length,1)
  assert.equal(readableHistory([{...reference,actor_id:'OTHER'},assigned]).length,2)
  const fresh={...assigned,destinatario_nombre:'Nombre al asignar',contexto:'Referencia registrada'}
  assert.equal(readableHistory([fresh]).length,1)
  assert.equal(historyTitle(fresh,'Nombre cambiado'),'Inventario creado y asignado a Nombre al asignar')
})
