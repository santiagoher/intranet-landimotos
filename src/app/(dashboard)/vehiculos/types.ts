export interface Vehicle {
  id: string
  placa: string
  marca: string
  modelo?: string
  tipo: 'Moto' | 'Carro' | 'Camión' | 'Otro'
  kilometraje: number
  estado: 'activo' | 'mantenimiento' | 'inactivo'
  created_at?: string
}

export interface Checklist {
  id: string
  vehiculo_id: string
  usuario_id: string | null
  conductor_nombre?: string
  conductor_cedula?: string
  conductor_cargo?: string
  kilometraje: number
  luces: string
  frenos: string
  llantas: string
  espejos: string
  aceite_motor: string
  liquido_frenos: string
  carroceria: string
  documentos: string
  tiene_novedad: boolean
  observaciones: string
  evaluaciones?: Record<string, string>
  created_at: string
  vehiculo?: {
    placa: string
    marca: string
    modelo?: string
    tipo: string
  }
  usuario?: {
    nombre: string
  }
}

export interface Alerta {
  id: string
  checklist_id: string
  vehiculo_id: string
  usuario_id: string | null
  estado: 'pendiente' | 'solucionado'
  comentarios_admin: string | null
  created_at: string
  resolved_at: string | null
  vehiculo?: {
    placa: string
    marca: string
    modelo?: string
    tipo: string
    kilometraje: number
  }
  checklist?: {
    id: string
    observaciones: string
    luces: string
    frenos: string
    llantas: string
    espejos: string
    aceite_motor: string
    liquido_frenos: string
    carroceria: string
    documentos: string
    conductor_nombre?: string
    conductor_cedula?: string
    conductor_cargo?: string
    evaluaciones?: Record<string, string>
  }
  usuario?: {
    nombre: string
  }
}
