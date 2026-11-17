'use client'
import { useRouter } from 'next/navigation'
import { TablePagination } from '@/components/TablePagination'
export function ComprasPagination({page,total,base,query}:{page:number;total:number;base:string;query:string}){
  const router=useRouter()
  return <TablePagination currentPage={page} totalPages={Math.ceil(total/25)} totalItems={total} pageSize={25} onPageChange={n=>{const p=new URLSearchParams(query);p.set('pagina',String(n));router.push(`${base}?${p}`)}}/>
}
