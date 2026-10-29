/** One request at a time, visibility-aware, bounded retries, no mutation retries. */
export function startPolling({run,canRun,interval=30000,initial=false,onPause=()=>{}}:{
  run:(signal:AbortSignal)=>Promise<boolean|'stop'>;canRun:()=>boolean;interval?:number;initial?:boolean;onPause?:()=>void
}) {
  let disposed=false, running=false, failures=0, due=Date.now()+(initial?0:interval)
  let timer:ReturnType<typeof setTimeout>|undefined, controller:AbortController|undefined
  function schedule(delay:number){if(!disposed)timer=setTimeout(tick,delay)}
  async function tick(){
    if(disposed||running||failures>=3)return
    if(!canRun()){schedule(interval);return}
    running=true;controller=new AbortController()
    let result:boolean|'stop'=false
    try{result=await run(controller.signal)}catch{result=false}
    finally{running=false}
    if(disposed)return
    if(result==='stop'){failures=3;return}
    failures=result?0:failures+1
    if(failures>=3){onPause();return}
    const delay=Math.min(interval*2**failures,300000)
    due=Date.now()+delay;schedule(delay)
  }
  function wake(force=false){
    if(disposed||running||!canRun()||(!force&&(failures>=3||Date.now()<due)))return
    if(timer)clearTimeout(timer)
    if(force)failures=0
    void tick()
  }
  schedule(initial?0:interval)
  return {wake:()=>wake(),retry:()=>wake(true),resume:()=>{if(disposed||running)return;failures=0;if(timer)clearTimeout(timer);due=Date.now()+interval;schedule(interval)},stop:()=>{disposed=true;if(timer)clearTimeout(timer);controller?.abort()}}
}
