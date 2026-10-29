const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const mod = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/modules/inventarios/local/model.ts','utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText,{module:mod,exports:mod.exports})
const source = JSON.parse(fs.readFileSync('src/modules/inventarios/local/excel-source.json','utf8'))
const data = mod.exports.normalizeExcel(source)
const quote = text => "'" + text.replaceAll("'","''") + "'"
const output = process.argv[2]
if (!output || !/^supabase\/migrations\/\d+_inventarios_catalogo_excel_inicial\.sql$/.test(output)) throw Error('Pass the CLI-generated migration filename')
let sql = `-- Actual catalog from workbook SHA256 ${source.sha256}.
-- No totals, ERP identifiers, task seeds or account role changes.
do $$
begin
 if (select count(*) from public.perfiles where nombre='ALEJANDRA TALENTO' and rol='Admin' and estado='activo')<>1 then
  raise exception 'Confirm the initial inventory administrator'; end if;
 if (select count(*) from public.perfiles where nombre='PRINCIPAL DESPACHO' and estado='activo' and 'inventarios'=any(modulos_permitidos))<>1 then
  raise exception 'Confirm the initial inventory operator'; end if;
end $$;
insert into public.inventario_administradores(perfil_id)
select id from public.perfiles where nombre='ALEJANDRA TALENTO' and rol='Admin' and estado='activo'
on conflict(perfil_id) do nothing;
`
for(const warehouse of data.warehouses) {
  const ref=quote('excel:'+warehouse.name)
  sql+=`insert into public.inventario_bodegas(nombre,origen,referencia_local) values(${quote(warehouse.name)},'excel',${ref}) on conflict(referencia_local) do nothing;\n`
  sql+=`insert into public.inventario_categorias(bodega_id,nombre,origen,referencia_local)
select b.id,c.name,'excel',c.name from public.inventario_bodegas b cross join (values
${warehouse.categories.map(c=>`(${quote(c.name)})`).join(',\n')}
) c(name) where b.referencia_local=${ref} on conflict(bodega_id,referencia_local) do nothing;\n`
  sql+=`insert into public.inventario_usuarios_bodegas(perfil_id,bodega_id,rol)
select p.id,b.id,'operador' from public.perfiles p cross join public.inventario_bodegas b
where p.nombre='PRINCIPAL DESPACHO' and p.estado='activo' and b.referencia_local=${ref}
on conflict(perfil_id,bodega_id) do nothing;\n`
}
fs.writeFileSync(output,sql)
console.log(`Prepared ${data.warehouses.length} warehouses and ${data.warehouses.reduce((n,w)=>n+w.categories.length,0)} categories. No remote writes.`)
