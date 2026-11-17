import 'server-only'
import ExcelJS from 'exceljs'
import { estados, eventos, fecha, type Revision, type Observacion, type Movimiento } from './types'
export interface ExportData { registros:Revision[]; observaciones:Observacion[]; historial:Movimiento[] }

export async function comprasWorkbook(data:ExportData) {
  const book=new ExcelJS.Workbook();book.creator='Landimotos';book.created=new Date()
  const invoices=new Map(data.registros.map(r=>[r.id,r.factura]))
  const sheets:[string,string[],(string|number|null)[][]][]=[
    ['Revisiones',['ID','Factura','Proveedor','Mesa','Encargado','Encargado ID','Asignado por','Asignador ID','Estado','CPM','Asignación (Bogotá)','Inicio (Bogotá)','Finalización (Bogotá)','Cierre (Bogotá)','Cerrado por','Cerrador ID','Minutos laborales','Versión','Número de artículos','Jornadas laborales','Plazo'],data.registros.map(r=>[r.id,r.factura,r.proveedor_nombre,r.mesa_id,r.encargado_nombre,r.encargado_id,r.asignador_nombre,r.asignado_por,estados[r.estado],r.cpm,fecha(r.creado_at),fecha(r.iniciado_at),fecha(r.finalizado_at),fecha(r.cerrado_at),r.cerrador_nombre,r.cerrado_por,Math.round(r.segundos_laborales/60*100)/100,r.version,r.numero_articulos??null,r.jornadas_laborales,r.vencida?'Vencida':'Dentro del plazo'])],
    ['Observaciones',['Revisión ID','Factura','Observación','Autor','Autor ID','Fecha (Bogotá)'],data.observaciones.map(o=>[o.revision_id,invoices.get(o.revision_id)??'',o.contenido,o.autor_nombre,o.autor_id,fecha(o.creado_at)])],
    ['Historial',['Revisión ID','Factura','Evento','Estado anterior','Estado nuevo','Responsable','Responsable ID','Fecha (Bogotá)','Detalle','Mesa','Encargado','Encargado ID','CPM','Versión','Destinatarios notificados','Número de artículos'],data.historial.map(h=>[h.revision_id,invoices.get(h.revision_id)??'',eventos[h.evento]??h.evento,h.estado_anterior?estados[h.estado_anterior]:'',estados[h.estado_nuevo],h.actor_nombre,h.actor_id,fecha(h.creado_at),h.detalle,h.datos.mesa_id,h.datos.encargado_nombre,h.datos.encargado_id,h.datos.cpm,h.datos.version,h.datos.notificados.join(', '),h.datos.numero_articulos??null])],
  ]
  for(const [name,headers,rows] of sheets){
    const sheet=book.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]})
    sheet.addRow(headers);sheet.addRows(rows)
    sheet.columns=headers.map((header,i)=>({width:Math.min(55,Math.max(18,header.length+3,...rows.slice(0,100).map(r=>String(r[i]??'').length)))}))
    sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}}
    sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1769FF'}}
    sheet.getRow(1).height=25
    sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:headers.length}}
    sheet.eachRow((row,n)=>{if(n>1){row.alignment={vertical:'top',wrapText:true};if(n%2===0)row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F6F8'}}}})
    // Strings remain typed strings (never Excel formulas); keeps leading CPM zeros.
  }
  return book.xlsx.writeBuffer()
}

