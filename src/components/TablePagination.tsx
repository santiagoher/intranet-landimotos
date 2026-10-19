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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-border bg-subtle">
      <span className="text-xs text-muted font-medium">
        Mostrando <span className="text-secondary font-bold">{startItem}</span> - <span className="text-secondary font-bold">{endItem}</span> de <span className="text-secondary font-bold">{totalItems}</span>
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="icon-button disabled:opacity-30 disabled:cursor-not-allowed"
          title="Primera página"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="icon-button disabled:opacity-30 disabled:cursor-not-allowed"
          title="Anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getVisiblePages().map((page) => (
          <button
            key={page}
            aria-label={`Página ${page}`}
            aria-current={currentPage === page ? 'page' : undefined}
            onClick={() => onPageChange(page)}
            className={`min-w-9 h-10 rounded-lg text-xs font-medium transition-colors ${
              currentPage === page
                ? 'bg-active text-foreground'
                : 'text-muted hover:text-foreground hover:bg-hover'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="icon-button disabled:opacity-30 disabled:cursor-not-allowed"
          title="Siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="icon-button disabled:opacity-30 disabled:cursor-not-allowed"
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
  