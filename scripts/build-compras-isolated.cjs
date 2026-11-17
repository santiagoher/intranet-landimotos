// Build a temporary source copy outside OneDrive; do not copy credentials.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process')
const root=process.cwd(),dest=fs.mkdtempSync(path.join(os.tmpdir(),'landimotos-compras-build-'))
for(const name of ['src','public','package.json','tsconfig.json','postcss.config.mjs','next.config.ts','next-env.d.ts'])
 fs.cpSync(path.join(root,name),path.join(dest,name),{recursive:true})
fs.symlinkSync(path.join(root,'node_modules'),path.join(dest,'node_modules'),'junction')
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'build-placeholder-not-a-credential'}
console.log('Build directory:',dest)
const result=spawnSync(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:dest,env,stdio:'inherit',windowsHide:true})
process.exitCode=result.status??1
