'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronRight, Settings2, type LucideIcon } from 'lucide-react'
import { useNavigationHash } from './useNavigationHash'

export interface NavigationLink {
  id: string
  name: string
  href: string
  icon: LucideIcon
}

interface NavigationItem extends NavigationLink {
  children?: { id: string; name: string; href: string }[]
}

// Receive the already-filtered links: grouping never grants additional access.
export function getNavigationSections(links: NavigationLink[], isAdmin: boolean, inventoryReports = false) {
  const operations: NavigationItem[] = []
  const administrative: NavigationLink[] = []

  for (const link of links) {
    if (link.id === 'despachos') {
      operations.push({
        ...link,
        children: [
          { id: 'despachos-records', name: 'Registros', href: link.href },
          ...(isAdmin ? [{ id: 'despachos-reports', name: 'Reportes', href: '/despachos#reportes' }] : []),
        ],
      })
    } else if (link.id === 'mensajeros') {
      operations.push({
        ...link,
        children: [
          { id: 'mensajeros-records', name: 'Registros', href: link.href },
          // Reports retain their existing admin-only access.
          ...(isAdmin ? [
            { id: 'mensajeros-reports', name: 'Reportes', href: `${link.href}#reportes` },
          ] : []),
        ],
      })
    } else if (link.id === 'inventarios') {
      operations.push({
        ...link,
        children: inventoryReports ? [
          { id: 'inventarios-overview', name: 'Vista general', href: '/inventarios' },
          { id: 'inventarios-records', name: 'Tareas de inventario', href: '/inventarios/registros' },
          { id: 'inventarios-reports', name: 'Reportes', href: '/inventarios/reportes' },
        ] : [
          { id: 'inventarios-records', name: 'Mis inventarios', href: '/inventarios/registros' },
          { id: 'inventarios-new', name: 'Nuevo inventario', href: '/inventarios' },
        ],
      })
    } else if (link.id === 'vehiculos') {
      operations.push(link)
    } else {
      administrative.push(link)
    }
  }

  return [
    { id: 'operaciones', name: 'Operaciones', items: operations },
    { id: 'administracion', name: 'Administración', items: administrative.length ? [{
      id: 'management', name: 'Gestión administrativa', href: '', icon: Settings2,
      children: administrative,
    }] : [] },
  ].filter(section => section.items.length > 0)
}

function matchesPath(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavigationGroup({ item, pathname, hash, onNavigate }: {
  item: NavigationItem
  pathname: string
  hash: string
  onNavigate: () => void
}) {
  const children = item.children ?? []
  const activeChild = children.find(child => child.href === `${pathname}${hash}`)
    ?? [...children].sort((a,b)=>b.href.length-a.href.length).find(child => matchesPath(child.href, pathname))
    ?? (item.id === 'inventarios' && matchesPath(item.href, pathname) ? children[0] : undefined)
  const location = `${pathname}${hash}`
  const [disclosure, setDisclosure] = useState({ location, expanded: Boolean(activeChild) })
  // A new destination inside the group always reveals the active item. Manual
  // collapse remains available while staying on the same destination.
  const expanded = disclosure.location === location ? disclosure.expanded : Boolean(activeChild) || disclosure.expanded
  const Icon = item.icon
  const panelId = `sidebar-${item.id}-children`

  return <li>
    <button type="button" aria-expanded={expanded} aria-controls={panelId}
      onClick={() => setDisclosure({ location, expanded: !expanded })}
      className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] leading-5 transition-colors ${activeChild ? 'bg-active font-medium text-foreground' : 'text-secondary hover:bg-hover hover:text-foreground'}`}>
      <Icon className="size-[17px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
      <span className="min-w-0 flex-1">{item.name}</span>
      <ChevronRight className={`size-3.5 shrink-0 text-muted transition-transform duration-[220ms] ${expanded ? 'rotate-90' : ''}`} aria-hidden="true" />
    </button>
    <div id={panelId} aria-hidden={!expanded} inert={!expanded}
      className={`grid transition-[grid-template-rows,opacity] duration-[220ms] ease-in-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
      <div className="min-h-0 overflow-hidden">
        <ul className="ml-5 my-1 space-y-0.5 border-l border-border pl-3">
          {children.map(child => {
            const active = child.id === activeChild?.id
            const props = {
              href: child.href,
              onClick: onNavigate,
              'aria-current': active ? 'page' as const : undefined,
              className: `flex min-h-9 items-center rounded-md px-3 py-2 text-[13px] leading-5 transition-colors ${active ? 'bg-active font-medium text-foreground' : 'text-secondary hover:bg-hover hover:text-foreground'}`,
            }
            // Native navigation also resets the fragment when choosing the
            // records and supports direct entry, reload and browser Back.
            return <li key={child.id}>{item.id === 'despachos' || item.id === 'mensajeros' || child.href.includes('#')
              ? <a {...props}>{child.name}</a>
              : <Link {...props}>{child.name}</Link>}</li>
          })}
        </ul>
      </div>
    </div>
  </li>
}

export function SidebarNavigation({ links, isAdmin, pathname, onNavigate, inventoryReports = false }: {
  links: NavigationLink[]
  isAdmin: boolean
  pathname: string
  onNavigate: () => void
  inventoryReports?: boolean
}) {
  const hash = useNavigationHash()
  return <nav aria-label="Navegación principal" className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 pb-5 pt-2">
    {getNavigationSections(links, isAdmin, inventoryReports).map(section => <section key={section.id} aria-labelledby={`sidebar-${section.id}`}>
      <h2 id={`sidebar-${section.id}`} className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-muted">{section.name}</h2>
      <ul className="space-y-1">
        {section.items.map(item => {
          if (item.children) return <NavigationGroup key={item.id} item={item} pathname={pathname} hash={hash} onNavigate={onNavigate} />
          const Icon = item.icon
          const active = matchesPath(item.href, pathname)
          return <li key={item.id}>
            <Link href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
              className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] leading-5 transition-colors ${active ? 'bg-active font-medium text-foreground' : 'text-secondary hover:bg-hover hover:text-foreground'}`}>
              <Icon className="size-[17px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
              <span>{item.name}</span>
            </Link>
          </li>
        })}
      </ul>
    </section>)}
  </nav>
}
