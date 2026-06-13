'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface TablePaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function TablePagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }: TablePaginationProps) {
  if (totalPages <= 1) return null

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  // Generate page numbers to show (max 5 visible)
  const getVisiblePages = () => {
    const pages: number[] = []
    let start = Math.max(1, currentPage - 2)
    const end = Math.min(totalPages, start + 4)
    
    if (end - start < 4) {
      start = Math.max(1, end - 4)
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-neutral-800 bg-neutral-950/30">
      <span className="text-xs text-neutral-500 font-medium">
        Mostrando <span className="text-neutral-300 font-bold">{startItem}</span> - <span className="text-neutral-300 font-bold">{endItem}</span> de <span className="text-neutral-300 font-bold">{totalItems}</span>
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Primera página"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getVisiblePages().map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
              currentPage === page
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Última página"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * Hook para paginar un arreglo de datos del lado del cliente.
 * Retorna los datos de la página actual, la página, y las funciones de control.
 */
export function usePagination<T>(data: T[], pageSize = 15) {
  const totalItems = data.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  return {
    totalItems,
    totalPages,
    pageSize,
    paginate: (page: number) => {
      const start = (page - 1) * pageSize
      return data.slice(start, start + pageSize)
    }
  }
}
