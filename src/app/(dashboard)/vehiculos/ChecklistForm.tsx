'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X, ClipboardCheck, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react'
import { createChecklist, getChecklists } from './actions'
import { Vehicle } from './types'
import { getMensajeros } from '../mensajeros/actions'

const checklistFormSchema = z.object({
  vehiculo_id: z.string().uuid('Por favor, selecciona un vehículo'),
  conductor_nombre: z.string().min(3, 'Ingresa tu nombre completo'),
  conductor_cedula: z.string().min(3, 'Ingresa tu número de cédula'),
  conductor_cargo: z.enum(['Conductor', 'Mensajero']),
  kilometraje: z.coerce.number().min(0, 'El kilometraje debe ser mayor o igual a 0'),
  evaluaciones: z.record(z.string(), z.enum(['b', 'm', 'na'])),
  observaciones: z.string().optional().default(''),
})

type ChecklistFormData = z.infer<typeof checklistFormSchema>

interface ChecklistFormProps {
  vehiculos: Vehicle[]
  onSuccess: () => void
  onCancel: () => void
}

// Estructura de items a evaluar organizados por categorías
export const CATEGORIES = [
  {
    id: 'documentacion',
    title: '1. Documentación',
    items: [
      { id: 'licencia_transito', label: 'Licencia de tránsito' },
      { id: 'licencia_conduccion', label: 'Licencia de conducción' },
      { id: 'vigencia_soat', label: 'Vigencia del SOAT' },
      { id: 'revision_tecnomecanica', label: 'Revisión tecnomecánica' }
    ]
  },
  {
    id: 'fluidos',
    title: '2. Fluidos',
    items: [
      { id: 'liquido_refrigerante', label: 'Líquido refrigerante' },
      { id: 'aceite_direccion', label: 'Aceite dirección asistida' },
      { id: 'liquido_frenos', label: 'Líquido de frenos' },
      { id: 'aceite_motor', label: 'Aceite del motor' },
      { id: 'fugas', label: 'No se evidencian fugas' },
      { id: 'limpia_parabrisas', label: 'Shampoo limpia parabrisas' },
      { id: 'bateria', label: 'Estado de la batería' }
    ]
  },
  {
    id: 'luces',
    title: '3. Luces',
    items: [
      { id: 'luz_freno', label: 'Luz de freno' },
      { id: 'direccionales', label: 'Direccionales' },
      { id: 'luz_reversa', label: 'Luz de reversa' },
      { id: 'luz_cabina', label: 'Luz de cabina' },
      { id: 'luces_estacionarias', label: 'Luces estacionarias' },
      { id: 'luces_altas_bajas', label: 'Luces altas/bajas' }
    ]
  },
  {
    id: 'suspension_direccion',
    title: '4. Suspensión y Dirección',
    items: [
      { id: 'labrado_llantas', label: 'Labrado mínimo de llantas de acuerdo al manual' },
      { id: 'presion_aire', label: 'Presión de aire de acuerdo a especificaciones técnicas' },
      { id: 'amortiguadores', label: 'Estado de amortiguadores' },
      { id: 'ballestas', label: 'Estado de ballestas' },
      { id: 'desgaste_llantas', label: 'Desgaste de las llantas (Alineación)' },
      { id: 'terminales', label: 'Estado de terminales' },
      { id: 'cauchos_bujes', label: 'Estado de cauchos y bujes' }
    ]
  },
  {
    id: 'carroceria',
    title: '5. Carrocería',
    items: [
      { id: 'plumillas', label: 'Plumillas limpia parabrisas' },
      { id: 'vidrios_panoramico', label: 'Vidrios/Panorámico' },
      { id: 'estado_carroceria', label: 'Estado carrocería' },
      { id: 'cinturones', label: 'Cinturones de seguridad' },
      { id: 'espejos', label: 'Ajuste de espejos' },
      { id: 'silla', label: 'Ajuste de silla' },
      { id: 'puertas', label: 'Ajuste de puertas' },
      { id: 'vidrios_puertas', label: 'Estado de los vidrios de las puertas' },
      { id: 'orden_aseo', label: 'Orden y aseo del vehículo' },
      { id: 'kit_arrastre', label: 'Estado kit de arrastre' },
      { id: 'tension_cadena', label: 'Tensión de cadena' },
      { id: 'buje_tijera', label: 'Estado buje de tijera' }
    ]
  },
  {
    id: 'frenos',
    title: '6. Frenos',
    items: [
      { id: 'pastillas_delanteras', label: 'Desgaste de pastillas de los frenos delanteros' },
      { id: 'pastillas_traseras', label: 'Desgaste de pastillas de los frenos traseros' },
      { id: 'freno_estacionamiento', label: 'Freno de estacionamiento' },
      { id: 'freno_trasero_tensionado', label: 'Freno trasero tensionado' }
    ]
  },
  {
    id: 'prevencion',
    title: '7. Equipo de Prevención',
    items: [
      { id: 'elementos_proteccion', label: 'Elementos de protección (Cascos, guantes, protección de extremidades)' },
      { id: 'equipo_carretera', label: 'Equipo de carretera completo Art.30' }
    ]
  },
  {
    id: 'proteccion_personal',
    title: '8. Equipos de Protección Personal',
    isSpecial: true, // Indica que solo tiene Bien / NA
    items: [
      { id: 'proteccion_superior', label: 'Elementos de protección superiores' },
      { id: 'proteccion_inferior', label: 'Elementos de protecciones inferiores' },
      { id: 'impermeable', label: 'Impermeable' },
      { id: 'chaleco_reflectivo', label: 'Chaleco reflectivo' }
    ]
  }
]

// Valores iniciales por defecto para evaluaciones
const defaultEvaluaciones: Record<string, 'b' | 'm' | 'na'> = {}
CATEGORIES.forEach(cat => {
  cat.items.forEach(item => {
    defaultEvaluaciones[item.id] = 'b'
  })
})

function getDocumentStatus(dateStr: string | null) {
  if (!dateStr) return { status: 'missing', text: 'Pendiente', colorClass: 'text-neutral-400 bg-neutral-900 border-neutral-800' }
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const [year, month, day] = dateStr.split('-').map(Number)
  const expiryDate = new Date(year, month - 1, day)
  
  const diffTime = expiryDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) {
    return { status: 'expired', text: 'Vencido', colorClass: 'text-red-400 bg-red-400/10 border-red-500/20' }
  } else if (diffDays <= 30) {
    return { status: 'expiring_soon', text: `Vence en ${diffDays} días`, colorClass: 'text-amber-400 bg-amber-400/10 border-amber-500/20' }
  } else {
    return { status: 'ok', text: 'Vigente', colorClass: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20' }
  }
}

export function VehicleBlueprint({ tipo, checklist }: { tipo: string; checklist: any }) {
  const getStatusClasses = (status: string | undefined) => {
    if (!status) return {
      strokeColor: '#a5c2f0',
      strokeOpacity: 0.85,
      fillColor: '#a5c2f0',
      fillOpacity: 0.05,
      lineColor: '#a5c2f0',
      lineOpacity: 0.5,
      textColor: '#a5c2f0',
      textOpacity: 0.9,
      circleColor: '#a5c2f0',
      className: ''
    }
    const s = status.toLowerCase()
    if (s === 'b') return {
      strokeColor: '#52d68c',
      strokeOpacity: 0.95,
      fillColor: '#52d68c',
      fillOpacity: 0.1,
      lineColor: '#52d68c',
      lineOpacity: 0.7,
      textColor: '#52d68c',
      textOpacity: 1,
      circleColor: '#52d68c',
      className: ''
    }
    if (s === 'm') return {
      strokeColor: '#ff4a6b',
      strokeOpacity: 1,
      fillColor: '#ff4a6b',
      fillOpacity: 0.25,
      lineColor: '#ff4a6b',
      lineOpacity: 1,
      textColor: '#ff4a6b',
      textOpacity: 1,
      circleColor: '#ff4a6b',
      className: 'animate-pulse'
    }
    return {
      strokeColor: '#a5c2f0',
      strokeOpacity: 0.6,
      fillColor: '#a5c2f0',
      fillOpacity: 0.05,
      lineColor: '#a5c2f0',
      lineOpacity: 0.4,
      textColor: '#a5c2f0',
      textOpacity: 0.7,
      circleColor: '#a5c2f0',
      className: ''
    }
  }

  const getMotorStatus = () => {
    const a = checklist?.aceite_motor
    const f = checklist?.liquido_frenos
    if (a === 'm' || f === 'm') return 'm'
    if (a === 'na' && f === 'na') return 'na'
    if (!a && !f) return undefined
    return 'b'
  }
  const motorStatus = getMotorStatus()

  const mirrorStyle = getStatusClasses(checklist?.espejos)
  const chassisStyle = getStatusClasses(checklist?.carroceria)
  const brakesStyle = getStatusClasses(checklist?.frenos)
  const lightsStyle = getStatusClasses(checklist?.luces)
  const motorStyle = getStatusClasses(motorStatus)
  const tiresStyle = getStatusClasses(checklist?.llantas)

  if (tipo.toLowerCase() === 'moto') {
    return (
      <svg viewBox="0 0 400 220" className="w-full h-auto max-h-[220px] mx-auto transition-all duration-300 font-sans">
        <defs>
          <pattern id="blueprint-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.5" />
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" />
          </pattern>
        </defs>

        {/* Blueprint Canvas Background */}
        <rect width="100%" height="100%" fill="#0b2b5c" rx="12" stroke="#1d4f91" strokeWidth="1.5" />
        <rect width="100%" height="100%" fill="url(#blueprint-grid)" rx="12" />

        {/* Outer Tech border */}
        <rect x="4" y="4" width="392" height="212" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" rx="8" />

        {/* Technical Title */}
        <text x="380" y="20" textAnchor="end" fill="rgba(255, 255, 255, 0.25)" fontSize="9px" fontWeight="bold" fontFamily="monospace" letterSpacing="0.8px">
          BOXER CT100 TECHNICAL BLUEPRINT
        </text>

        {/* =========================================================================
            MOTORCYCLE DRAWING (BOXER CT100 HIGH FIDELITY REDESIGNED)
            ========================================================================= */}
        <g transform="translate(5, 5)">
          {/* Llantas & Horquilla (Tires, Spokes, suspension) */}
          <g className={tiresStyle.className}>
            {/* Rear wheel spokes (Cross Pattern) */}
            <path d="M 80 135 L 115 150 M 78 145 L 118 145 M 80 155 L 115 140 M 88 167 L 105 135 M 110 177 L 110 135 M 132 167 L 115 135 M 140 155 L 105 140 M 142 145 L 102 145 M 140 135 L 105 150 M 132 123 L 115 155 M 110 113 L 110 155 M 88 123 L 105 155" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity * 0.5} strokeWidth="0.6" />
            {/* Rear Tyre */}
            <circle cx="110" cy="145" r="32" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="3.5" />
            <circle cx="110" cy="145" r="28" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity * 0.8} strokeWidth="1" />
            <circle cx="110" cy="145" r="9" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="1.2" />

            {/* Front wheel spokes (Cross Pattern) */}
            <path d="M 260 135 L 295 150 M 258 145 L 298 145 M 260 155 L 295 140 M 268 167 L 285 135 M 290 177 L 290 135 M 312 167 L 295 135 M 320 155 L 285 140 M 322 145 L 282 145 M 320 135 L 285 150 M 312 123 L 295 155 M 290 113 L 290 155 M 268 123 L 285 155" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity * 0.5} strokeWidth="0.6" />
            {/* Front Tyre */}
            <circle cx="290" cy="145" r="32" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="3.5" />
            <circle cx="290" cy="145" r="28" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity * 0.8} strokeWidth="1" />
            <circle cx="290" cy="145" r="9" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="1.2" />

            {/* Telescopic Front Forks */}
            <line x1="290" y1="145" x2="250" y2="65" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="2.2" />
            <line x1="288" y1="145" x2="248" y2="65" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="0.5" />
            {/* Fork gaiters / rubber boots */}
            <rect x="263" y="96" width="6" height="20" transform="rotate(26, 263, 96)" fill={tiresStyle.fillColor} fillOpacity={tiresStyle.fillOpacity} stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="1" />
            {/* Front mudguard (fender) */}
            <path d="M 252 110 C 265 105, 290 108, 312 123 L 306 129 C 286 116, 268 115, 254 116 Z" fill={tiresStyle.fillColor} fillOpacity={tiresStyle.fillOpacity} stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="1.2" />

            {/* Rear swingarm */}
            <path d="M 110 145 L 180 145 L 175 135 L 115 135 Z" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="1.2" />
            {/* Rear shock absorber (spring detail in RED - matching Boxer CT100 image) */}
            <line x1="120" y1="95" x2="115" y2="145" stroke="#ff4a6b" strokeWidth="2.5" />
            <path d="M 122 100 L 116 104 L 122 108 L 116 112 L 122 116 L 116 120 L 122 124 L 116 128 L 122 132 L 116 136 L 122 140" fill="none" stroke="#ff4a6b" strokeWidth="1.8" />
          </g>

          {/* Chassis / Frame (Carrocería) */}
          <g className={chassisStyle.className}>
            {/* Main Frame Tubing */}
            <line x1="98" y1="98" x2="135" y2="105" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1.6" />
            <line x1="135" y1="105" x2="175" y2="140" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1.4" />
            
            {/* Fuel Tank (Boxer CT100 Shape) */}
            <path d="M 170 82 C 170 78, 175 62, 195 59 C 215 56, 235 58, 245 72 C 248 76, 246 83, 238 85 L 172 85 Z" fill={chassisStyle.fillColor} fillOpacity={chassisStyle.fillOpacity} stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1.8" />
            {/* Tank Decal Strip */}
            <path d="M 185 85 Q 210 73 235 81" fill="none" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="0.8" strokeDasharray="2,2" />
            {/* Text logo on tank */}
            <text x="200" y="78" fill={chassisStyle.strokeColor} fillOpacity="0.45" fontSize="6px" fontWeight="bold" fontFamily="monospace">BOXER</text>
            <text x="222" y="78" fill="#ff4a6b" fillOpacity="0.6" fontSize="5px" fontWeight="bold" fontFamily="monospace">CT100</text>

            {/* Seat */}
            <path d="M 168 85 C 150 81, 125 81, 98 86 L 98 96 L 168 93 Z" fill={chassisStyle.fillColor} fillOpacity={chassisStyle.fillOpacity} stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1.6" />
            <line x1="98" y1="89" x2="168" y2="86" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="0.8" />
            <text x="110" y="93" fill={chassisStyle.strokeColor} fillOpacity="0.4" fontSize="5px" fontWeight="bold" fontFamily="monospace">BOXER</text>

            {/* Side Cover */}
            <path d="M 135 96 L 170 93 L 165 113 L 132 108 Z" fill={chassisStyle.fillColor} fillOpacity={chassisStyle.fillOpacity} stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1" />
            
            {/* Tail Cowl */}
            <path d="M 98 86 C 88 86, 75 90, 72 98 C 70 104, 75 110, 85 110 L 98 96 Z" fill={chassisStyle.fillColor} fillOpacity={chassisStyle.fillOpacity} stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1" />

            {/* Luggage Rack */}
            <path d="M 95 86 L 60 86 L 55 91 M 60 86 L 65 96 M 75 86 L 80 96" fill="none" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1.2" />

            {/* Drive Chain Cover (Technical component under swingarm) */}
            <path d="M 100 148 L 165 148 L 165 142 L 105 138 Z" fill="none" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity * 0.5} strokeWidth="1" />
          </g>

          {/* Mirrors (Espejos) */}
          <g className={mirrorStyle.className}>
            {/* Handlebar tubes */}
            <path d="M 250 65 L 245 48 M 245 48 L 235 48" fill="none" stroke={mirrorStyle.strokeColor} strokeOpacity={mirrorStyle.strokeOpacity} strokeWidth="2" />
            {/* Left Mirror */}
            <line x1="244" y1="48" x2="225" y2="28" stroke={mirrorStyle.strokeColor} strokeOpacity={mirrorStyle.strokeOpacity} strokeWidth="1.2" />
            <ellipse cx="225" cy="28" rx="8" ry="5" transform="rotate(-30, 225, 28)" fill={mirrorStyle.fillColor} fillOpacity={mirrorStyle.fillOpacity} stroke={mirrorStyle.strokeColor} strokeOpacity={mirrorStyle.strokeOpacity} strokeWidth="1" />
            {/* Right Mirror */}
            <line x1="248" y1="48" x2="238" y2="22" stroke={mirrorStyle.strokeColor} strokeOpacity={mirrorStyle.strokeOpacity} strokeWidth="1.2" />
            <ellipse cx="238" cy="22" rx="8" ry="5" transform="rotate(-15, 238, 22)" fill={mirrorStyle.fillColor} fillOpacity={mirrorStyle.fillOpacity} stroke={mirrorStyle.strokeColor} strokeOpacity={mirrorStyle.strokeOpacity} strokeWidth="1" />
          </g>

          {/* Luces (Headlight, tail light, turn signals) */}
          <g className={lightsStyle.className}>
            {/* Headlight Fairing/Visor (Boxer CT100 Shape) */}
            <path d="M 250 65 C 255 65, 275 60, 280 72 C 285 82, 275 92, 260 92 Z" fill={lightsStyle.fillColor} fillOpacity={lightsStyle.fillOpacity} stroke={lightsStyle.strokeColor} strokeOpacity={lightsStyle.strokeOpacity} strokeWidth="1.2" />
            <path d="M 252 65 C 255 50, 265 45, 270 48 C 275 52, 272 62, 266 65 Z" fill={lightsStyle.fillColor} fillOpacity={lightsStyle.fillOpacity} stroke={lightsStyle.strokeColor} strokeOpacity={lightsStyle.strokeOpacity} strokeWidth="1" />
            {/* Lens */}
            <path d="M 280 72 C 283 75, 283 81, 280 84 C 277 86, 274 84, 274 78 Z" fill="none" stroke={lightsStyle.strokeColor} strokeOpacity={lightsStyle.strokeOpacity} strokeWidth="1.8" />
            {/* Light beam vector */}
            <polygon points="282,78 315,68 315,88" fill="none" stroke={lightsStyle.strokeColor} strokeOpacity="0.15" strokeWidth="0.5" strokeDasharray="2,2" />
            
            {/* Tail light */}
            <path d="M 72 98 L 65 98 L 67 104 Z" fill={lightsStyle.fillColor} fillOpacity={lightsStyle.fillOpacity} stroke={lightsStyle.strokeColor} strokeOpacity={lightsStyle.strokeOpacity} strokeWidth="1.2" />
            {/* Turn signals */}
            <circle cx="258" cy="94" r="2.5" fill={lightsStyle.fillColor} fillOpacity={lightsStyle.fillOpacity} stroke={lightsStyle.strokeColor} strokeOpacity={lightsStyle.strokeOpacity} strokeWidth="1" />
            <circle cx="78" cy="106" r="2.5" fill={lightsStyle.fillColor} fillOpacity={lightsStyle.fillOpacity} stroke={lightsStyle.strokeColor} strokeOpacity={lightsStyle.strokeOpacity} strokeWidth="1" />
          </g>

          {/* Motor / Fluidos */}
          <g className={motorStyle.className}>
            {/* Main Engine Crankcase Base (Cárter) */}
            <path d="M 162 135 L 210 135 L 215 155 L 165 155 Z" fill={motorStyle.fillColor} fillOpacity={motorStyle.fillOpacity} stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.5" />
            
            {/* Cylinder Block (Angled forward, Base around 185,135 to 205,135) */}
            <path d="M 185 135 L 210 112 L 225 118 L 200 138 Z" fill={motorStyle.fillColor} fillOpacity={motorStyle.fillOpacity} stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.5" />
            
            {/* Horizontal Cooling Fins (Stack of flat lines matching the incline profile) */}
            <line x1="205" y1="115" x2="225" y2="115" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.2" />
            <line x1="200" y1="120" x2="222" y2="120" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.2" />
            <line x1="195" y1="125" x2="219" y2="125" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.2" />
            <line x1="190" y1="130" x2="216" y2="130" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.2" />
            <line x1="186" y1="135" x2="212" y2="135" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.2" />

            {/* Cylinder Head Cover (Culata) */}
            <path d="M 210 112 C 210 106, 222 108, 226 114 Z" fill={motorStyle.fillColor} fillOpacity={motorStyle.fillOpacity} stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.5" />
            
            {/* Concentric Crankcase Cover (Right side clutch cover detail) */}
            <circle cx="185" cy="145" r="13" fill={motorStyle.fillColor} fillOpacity={motorStyle.fillOpacity} stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.5" />
            <circle cx="185" cy="145" r="7" fill="none" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1" />
            {/* Front smaller gear case circle */}
            <circle cx="205" cy="146" r="6" fill={motorStyle.fillColor} fillOpacity={motorStyle.fillOpacity} stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.2" />

            {/* Carburetor (behind the cylinder block) */}
            <path d="M 172 118 L 184 118 L 180 130 L 168 130 Z" fill="none" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.2" />
            <circle cx="176" cy="124" r="3" fill="none" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="0.8" />
            
            {/* Sparkplug and cable */}
            <path d="M 218 108 L 222 98 L 230 100" fill="none" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.2" />

            {/* Engine Crash Guard (Defensa - double contour line for premium feel) */}
            <path d="M 235 90 C 242 105, 235 125, 218 135" fill="none" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.6" />
            <path d="M 238 90 C 245 105, 238 128, 220 138" fill="none" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity * 0.4} strokeWidth="0.8" />

            {/* Exhaust pipe & Muffler */}
            <path d="M 220 116 C 232 116, 236 126, 232 145 L 224 163 C 218 168, 190 168, 155 168 L 105 168" fill="none" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="2" />
            {/* Heat Shield on Muffler */}
            <path d="M 148 165 L 100 165 L 95 171 L 143 171 Z" fill={motorStyle.fillColor} fillOpacity={motorStyle.fillOpacity} stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.2" />

            {/* Stands */}
            <line x1="175" y1="155" x2="162" y2="176" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="2" />
            <path d="M 182 155 L 180 176 M 186 155 L 188 176" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.2" />
          </g>

          {/* Frenos */}
          <g className={brakesStyle.className}>
            {/* Rear brake drum hub actuator */}
            <circle cx="110" cy="145" r="14" fill="none" stroke={brakesStyle.strokeColor} strokeOpacity={brakesStyle.strokeOpacity} strokeWidth="1" strokeDasharray="3,1" />
            <line x1="110" y1="145" x2="125" y2="132" stroke={brakesStyle.strokeColor} strokeOpacity={brakesStyle.strokeOpacity} strokeWidth="2" />
            
            {/* Front disc rotor and caliper */}
            <circle cx="290" cy="145" r="18" fill="none" stroke={brakesStyle.strokeColor} strokeOpacity={brakesStyle.strokeOpacity} strokeWidth="1" strokeDasharray="2,2" />
            <path d="M 298 132 L 292 140 L 298 143 Z" fill={brakesStyle.fillColor} fillOpacity={brakesStyle.fillOpacity} stroke={brakesStyle.strokeColor} strokeOpacity={brakesStyle.strokeOpacity} strokeWidth="1.5" />
            {/* Front brake cable */}
            <path d="M 295 136 C 290 115, 275 80, 245 68" fill="none" stroke={brakesStyle.strokeColor} strokeOpacity={brakesStyle.strokeOpacity * 0.4} strokeWidth="0.6" />
          </g>

          {/* Tech helper dimensions (Wheelbase 1285mm) */}
          <g stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" fill="none">
            <line x1="110" y1="192" x2="290" y2="192" />
            <line x1="110" y1="188" x2="110" y2="196" />
            <line x1="290" y1="188" x2="290" y2="196" />
            <polygon points="110,192 116,189 116,195" fill="rgba(255,255,255,0.3)" />
            <polygon points="290,192 284,189 284,195" fill="rgba(255,255,255,0.3)" />
          </g>
          <text x="200" y="201" textAnchor="middle" fill="rgba(255,255,255,0.3)" className="text-[6.5px] font-mono tracking-widest">
            DISTANCIA ENTRE EJES: 1285 mm
          </text>
        </g>

        {/* =========================================================================
            LEADER LINES AND LABELS (CORRESPONDING TO CHECKLIST SECTIONS)
            ========================================================================= */}
        {/* Left Side: 3 Labels */}
        
        {/* 1. Retrovisores (espejos) */}
        <g className={mirrorStyle.className}>
          <path d="M 243 27 L 180 15 L 105 15" fill="none" stroke={mirrorStyle.lineColor} strokeOpacity={mirrorStyle.lineOpacity} strokeWidth="1" />
          <circle cx="243" cy="27" r="2" fill={mirrorStyle.circleColor} stroke="#0b2b5c" strokeWidth="1" />
          <text x="100" y="11" textAnchor="end" fill={mirrorStyle.textColor} fillOpacity={mirrorStyle.textOpacity} className="text-[8px] font-bold tracking-wider">
            ESPEJOS / RETROVISORES
          </text>
          <text x="100" y="20" textAnchor="end" fill={mirrorStyle.textColor} fillOpacity={mirrorStyle.textOpacity} className="text-[7px] font-bold tracking-widest">
            {checklist?.espejos === 'b' ? 'ESTADO: BIEN' : checklist?.espejos === 'm' ? 'ESTADO: REVISIÓN' : 'SIN DATOS'}
          </text>
        </g>

        {/* 2. Chasis / Carrocería (carroceria - includes seat, fuel tank, chain guard) */}
        <g className={chassisStyle.className}>
          <path d="M 175 90 L 135 60 L 105 60" fill="none" stroke={chassisStyle.lineColor} strokeOpacity={chassisStyle.lineOpacity} strokeWidth="1" />
          <circle cx="175" cy="90" r="2" fill={chassisStyle.circleColor} stroke="#0b2b5c" strokeWidth="1" />
          <text x="100" y="56" textAnchor="end" fill={chassisStyle.textColor} fillOpacity={chassisStyle.textOpacity} className="text-[8px] font-bold tracking-wider">
            CHASIS / CARROCERÍA
          </text>
          <text x="100" y="65" textAnchor="end" fill={chassisStyle.textColor} fillOpacity={chassisStyle.textOpacity} className="text-[7px] font-bold tracking-widest">
            {checklist?.carroceria === 'b' ? 'ESTADO: BIEN' : checklist?.carroceria === 'm' ? 'ESTADO: REVISIÓN' : 'SIN DATOS'}
          </text>
        </g>

        {/* 3. Frenos (frenos - points to rear drum actuator) */}
        <g className={brakesStyle.className}>
          <path d="M 115 150 L 85 125 L 55 125" fill="none" stroke={brakesStyle.lineColor} strokeOpacity={brakesStyle.lineOpacity} strokeWidth="1" />
          <circle cx="115" cy="150" r="2" fill={brakesStyle.circleColor} stroke="#0b2b5c" strokeWidth="1" />
          <text x="50" y="121" textAnchor="end" fill={brakesStyle.textColor} fillOpacity={brakesStyle.textOpacity} className="text-[8px] font-bold tracking-wider">
            SISTEMA DE FRENOS
          </text>
          <text x="50" y="130" textAnchor="end" fill={brakesStyle.textColor} fillOpacity={brakesStyle.textOpacity} className="text-[7px] font-bold tracking-widest">
            {checklist?.frenos === 'b' ? 'ESTADO: BIEN' : checklist?.frenos === 'm' ? 'ESTADO: REVISIÓN' : 'SIN DATOS'}
          </text>
        </g>

        {/* Right Side: 3 Labels */}

        {/* 4. Luces / Farola (luces - points to headlight) */}
        <g className={lightsStyle.className}>
          <path d="M 285 83 L 310 40 L 335 40" fill="none" stroke={lightsStyle.lineColor} strokeOpacity={lightsStyle.lineOpacity} strokeWidth="1" />
          <circle cx="285" cy="83" r="2" fill={lightsStyle.circleColor} stroke="#0b2b5c" strokeWidth="1" />
          <text x="340" y="36" textAnchor="start" fill={lightsStyle.textColor} fillOpacity={lightsStyle.textOpacity} className="text-[8px] font-bold tracking-wider">
            LUCES / FAROLA
          </text>
          <text x="340" y="45" textAnchor="start" fill={lightsStyle.textColor} fillOpacity={lightsStyle.textOpacity} className="text-[7px] font-bold tracking-widest">
            {checklist?.luces === 'b' ? 'ESTADO: BIEN' : checklist?.luces === 'm' ? 'ESTADO: REVISIÓN' : 'SIN DATOS'}
          </text>
        </g>

        {/* 5. Motor y Fluidos (aceite_motor & liquido_frenos - points to cylinder) */}
        <g className={motorStyle.className}>
          <path d="M 200 135 L 235 100 L 285 100" fill="none" stroke={motorStyle.lineColor} strokeOpacity={motorStyle.lineOpacity} strokeWidth="1" />
          <circle cx="200" cy="135" r="2" fill={motorStyle.circleColor} stroke="#0b2b5c" strokeWidth="1" />
          <text x="290" y="96" textAnchor="start" fill={motorStyle.textColor} fillOpacity={motorStyle.textOpacity} className="text-[8px] font-bold tracking-wider">
            MOTOR Y FLUIDOS
          </text>
          <text x="290" y="105" textAnchor="start" fill={motorStyle.textColor} fillOpacity={motorStyle.textOpacity} className="text-[7px] font-bold tracking-widest">
            {motorStatus === 'b' ? 'ESTADO: BIEN' : motorStatus === 'm' ? 'ESTADO: REVISIÓN' : 'SIN DATOS'}
          </text>
        </g>

        {/* 6. Llantas y Horquilla (llantas/suspension - points to front fork boots) */}
        <g className={tiresStyle.className}>
          <path d="M 275 120 L 305 170 L 335 170" fill="none" stroke={tiresStyle.lineColor} strokeOpacity={tiresStyle.lineOpacity} strokeWidth="1" />
          <circle cx="275" cy="120" r="2" fill={tiresStyle.circleColor} stroke="#0b2b5c" strokeWidth="1" />
          <text x="340" y="166" textAnchor="start" fill={tiresStyle.textColor} fillOpacity={tiresStyle.textOpacity} className="text-[8px] font-bold tracking-wider">
            LLANTAS Y HORQUILLA
          </text>
          <text x="340" y="175" textAnchor="start" fill={tiresStyle.textColor} fillOpacity={tiresStyle.textOpacity} className="text-[7px] font-bold tracking-widest">
            {checklist?.llantas === 'b' ? 'ESTADO: BIEN' : checklist?.llantas === 'm' ? 'ESTADO: REVISIÓN' : 'SIN DATOS'}
          </text>
        </g>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 400 220" className="w-full h-auto max-h-[220px] mx-auto transition-all duration-300 font-sans">
      <defs>
        <pattern id="blueprint-grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="0.5" />
          <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.8" />
        </pattern>
      </defs>

      {/* Blueprint Canvas Background */}
      <rect width="100%" height="100%" fill="#0b2b5c" rx="12" stroke="#1d4f91" strokeWidth="1.5" />
      <rect width="100%" height="100%" fill="url(#blueprint-grid)" rx="12" />

      {/* Outer Tech border */}
      <rect x="4" y="4" width="392" height="212" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" rx="8" />

      {/* =========================================================================
          CAR DRAWING
          ========================================================================= */}
      <g transform="translate(10, 0)">
        {/* Chassis / Frame (Carrocería) */}
        <g className={chassisStyle.className}>
          {/* Sedan profile outline */}
          <path d="M 95 155 L 105 130 C 105 130, 110 128, 120 128 L 150 128 L 180 100 L 255 100 L 285 128 L 315 128 C 325 128, 330 130, 330 135 L 330 155 L 320 155" fill={chassisStyle.fillColor} fillOpacity={chassisStyle.fillOpacity} stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1.5" />
          {/* Wheel arches */}
          <path d="M 120 155 A 24 24 0 0 1 168 155" fill="none" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1.5" />
          <path d="M 252 155 A 24 24 0 0 1 300 155" fill="none" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1.5" />
          {/* Underbody line */}
          <line x1="168" y1="155" x2="252" y2="155" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1.5" />
          <line x1="95" y1="155" x2="120" y2="155" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1.5" />
          <line x1="300" y1="155" x2="320" y2="155" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1.5" />

          {/* Windows detail */}
          <path d="M 183 104 L 215 104 L 215 124 L 159 124 Z" fill="none" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1" />
          <path d="M 221 104 L 252 104 L 278 124 L 221 124 Z" fill="none" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="1" />
          
          {/* Door panels */}
          <path d="M 152 128 L 152 155" fill="none" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="0.8" />
          <path d="M 218 124 L 218 155" fill="none" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="0.8" />
          <path d="M 285 128 L 285 155" fill="none" stroke={chassisStyle.strokeColor} strokeOpacity={chassisStyle.strokeOpacity} strokeWidth="0.8" />
        </g>

        {/* Mirrors (Espejos) */}
        <g className={mirrorStyle.className}>
          <path d="M 221 120 L 214 116 C 211 114, 211 108, 217 110 Z" fill={mirrorStyle.fillColor} fillOpacity={mirrorStyle.fillOpacity} stroke={mirrorStyle.strokeColor} strokeOpacity={mirrorStyle.strokeOpacity} strokeWidth="1.2" />
        </g>

        {/* Luces (Headlight & Tail light) */}
        <g className={lightsStyle.className}>
          {/* Front Headlight */}
          <path d="M 324 133 C 328 133, 330 138, 328 143 Z" fill={lightsStyle.fillColor} fillOpacity={lightsStyle.fillOpacity} stroke={lightsStyle.strokeColor} strokeOpacity={lightsStyle.strokeOpacity} strokeWidth="1.2" />
          <polygon points="329,138 355,130 355,146" fill="none" stroke={lightsStyle.strokeColor} strokeOpacity="0.2" strokeWidth="0.5" />
          {/* Rear Tail Light */}
          <path d="M 101 133 C 97 133, 95 138, 97 141 Z" fill={lightsStyle.fillColor} fillOpacity={lightsStyle.fillOpacity} stroke={lightsStyle.strokeColor} strokeOpacity={lightsStyle.strokeOpacity} strokeWidth="1.2" />
        </g>

        {/* Motor / Fluidos (Engine) */}
        <g className={motorStyle.className}>
          <rect x="290" y="132" width="22" height="18" rx="2" fill={motorStyle.fillColor} fillOpacity={motorStyle.fillOpacity} stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1.5" />
          <circle cx="301" cy="141" r="5" fill="none" stroke={motorStyle.strokeColor} strokeOpacity={motorStyle.strokeOpacity} strokeWidth="1" />
        </g>

        {/* Frenos */}
        <g className={brakesStyle.className}>
          <circle cx="144" cy="155" r="10" fill="none" stroke={brakesStyle.strokeColor} strokeOpacity={brakesStyle.strokeOpacity} strokeWidth="1" strokeDasharray="2,1" />
          <circle cx="276" cy="155" r="10" fill="none" stroke={brakesStyle.strokeColor} strokeOpacity={brakesStyle.strokeOpacity} strokeWidth="1" strokeDasharray="2,1" />
          <path d="M 150 148 L 146 153 Z" stroke={brakesStyle.strokeColor} strokeOpacity={brakesStyle.strokeOpacity} strokeWidth="2" />
          <path d="M 282 148 L 278 153 Z" stroke={brakesStyle.strokeColor} strokeOpacity={brakesStyle.strokeOpacity} strokeWidth="2" />
        </g>

        {/* Llantas & Amortiguadores */}
        <g className={tiresStyle.className}>
          <circle cx="144" cy="155" r="18" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="2" />
          <circle cx="144" cy="155" r="6" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="1" />
          <line x1="144" y1="155" x2="144" y2="137" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="0.8" />
          <line x1="144" y1="155" x2="144" y2="173" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="0.8" />
          <line x1="144" y1="155" x2="126" y2="155" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="0.8" />
          <line x1="144" y1="155" x2="162" y2="155" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="0.8" />
          
          <circle cx="276" cy="155" r="18" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="2" />
          <circle cx="276" cy="155" r="6" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="1" />
          <line x1="276" y1="155" x2="276" y2="137" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="0.8" />
          <line x1="276" y1="155" x2="276" y2="173" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="0.8" />
          <line x1="276" y1="155" x2="258" y2="155" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="0.8" />
          <line x1="276" y1="155" x2="294" y2="155" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="0.8" />
          
          <path d="M 144 137 L 144 120" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="1.5" />
          <path d="M 276 137 L 276 120" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="1.5" />
        </g>

        {/* Dimension Line decoration */}
        <g stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" fill="none">
          <line x1="144" y1="190" x2="276" y2="190" />
          <line x1="144" y1="186" x2="144" y2="194" />
          <line x1="276" y1="186" x2="276" y2="194" />
          <polygon points="144,190 150,187 150,193" fill="rgba(255,255,255,0.4)" />
          <polygon points="276,190 270,187 270,193" fill="rgba(255,255,255,0.4)" />
        </g>
        <text x="210" y="199" textAnchor="middle" fill="rgba(255,255,255,0.4)" className="text-[7px] font-mono tracking-widest">
          DISTANCIA ENTRE EJES: 2650 mm
        </text>
      </g>

      {/* Leader lines and labels */}
      {/* espejos */}
      <g className={mirrorStyle.className}>
        <path d="M 221 116 L 180 25 L 105 25" fill="none" stroke={mirrorStyle.lineColor} strokeOpacity={mirrorStyle.lineOpacity} strokeWidth="1" />
        <circle cx="221" cy="116" r="2" fill={mirrorStyle.circleColor} stroke="#0b2b5c" strokeWidth="1" />
        <text x="100" y="21" textAnchor="end" fill={mirrorStyle.textColor} fillOpacity={mirrorStyle.textOpacity} className="text-[8px] font-bold tracking-wider">
          ESPEJOS RETROVISORES
        </text>
        <text x="100" y="30" textAnchor="end" fill={mirrorStyle.textColor} fillOpacity={mirrorStyle.textOpacity} className="text-[7px] font-bold tracking-widest">
          {checklist?.espejos === 'b' ? 'ESTADO: BIEN' : checklist?.espejos === 'm' ? 'ESTADO: REVISIÓN' : 'SIN DATOS'}
        </text>
      </g>

      {/* carroceria */}
      <g className={chassisStyle.className}>
        <path d="M 200 100 L 150 70 L 105 70" fill="none" stroke={chassisStyle.lineColor} strokeOpacity={chassisStyle.lineOpacity} strokeWidth="1" />
        <circle cx="200" cy="100" r="2" fill={chassisStyle.circleColor} stroke="#0b2b5c" strokeWidth="1" />
        <text x="100" y="66" textAnchor="end" fill={chassisStyle.textColor} fillOpacity={chassisStyle.textOpacity} className="text-[8px] font-bold tracking-wider">
          CHASIS / CARROCERÍA
        </text>
        <text x="100" y="75" textAnchor="end" fill={chassisStyle.textColor} fillOpacity={chassisStyle.textOpacity} className="text-[7px] font-bold tracking-widest">
          {checklist?.carroceria === 'b' ? 'ESTADO: BIEN' : checklist?.carroceria === 'm' ? 'ESTADO: REVISIÓN' : 'SIN DATOS'}
        </text>
      </g>

      {/* frenos */}
      <g className={brakesStyle.className}>
        <path d="M 144 155 L 100 135 L 55 135" fill="none" stroke={brakesStyle.lineColor} strokeOpacity={brakesStyle.lineOpacity} strokeWidth="1" />
        <circle cx="144" cy="155" r="2" fill={brakesStyle.circleColor} stroke="#0b2b5c" strokeWidth="1" />
        <text x="50" y="131" textAnchor="end" fill={brakesStyle.textColor} fillOpacity={brakesStyle.textOpacity} className="text-[8px] font-bold tracking-wider">
          SISTEMA DE FRENOS
        </text>
        <text x="50" y="140" textAnchor="end" fill={brakesStyle.textColor} fillOpacity={brakesStyle.textOpacity} className="text-[7px] font-bold tracking-widest">
          {checklist?.frenos === 'b' ? 'ESTADO: BIEN' : checklist?.frenos === 'm' ? 'ESTADO: REVISIÓN' : 'SIN DATOS'}
        </text>
      </g>

      {/* luces */}
      <g className={lightsStyle.className}>
        <path d="M 324 138 L 335 50 L 335 50" fill="none" stroke={lightsStyle.lineColor} strokeOpacity={lightsStyle.lineOpacity} strokeWidth="1" />
        <circle cx="324" cy="138" r="2" fill={lightsStyle.circleColor} stroke="#0b2b5c" strokeWidth="1" />
        <text x="340" y="46" textAnchor="start" fill={lightsStyle.textColor} fillOpacity={lightsStyle.textOpacity} className="text-[8px] font-bold tracking-wider">
          LUCES / FAROLAS
        </text>
        <text x="340" y="55" textAnchor="start" fill={lightsStyle.textColor} fillOpacity={lightsStyle.textOpacity} className="text-[7px] font-bold tracking-widest">
          {checklist?.luces === 'b' ? 'ESTADO: BIEN' : checklist?.luces === 'm' ? 'ESTADO: REVISIÓN' : 'SIN DATOS'}
        </text>
      </g>

      {/* motor */}
      <g className={motorStyle.className}>
        <path d="M 295 142 L 310 110 L 335 110" fill="none" stroke={motorStyle.lineColor} strokeOpacity={motorStyle.lineOpacity} strokeWidth="1" />
        <circle cx="295" cy="142" r="2" fill={motorStyle.circleColor} stroke="#0b2b5c" strokeWidth="1" />
        <text x="340" y="106" textAnchor="start" fill={motorStyle.textColor} fillOpacity={motorStyle.textOpacity} className="text-[8px] font-bold tracking-wider">
          MOTOR Y FLUIDOS
        </text>
        <text x="340" y="115" textAnchor="start" fill={motorStyle.textColor} fillOpacity={motorStyle.textOpacity} className="text-[7px] font-bold tracking-widest">
          {motorStatus === 'b' ? 'ESTADO: BIEN' : motorStatus === 'm' ? 'ESTADO: REVISIÓN' : 'SIN DATOS'}
        </text>
      </g>

      {/* llantas */}
      <g className={tiresStyle.className}>
        <path d="M 276 155 L 310 175 L 335 175" fill="none" stroke={tiresStyle.strokeColor} strokeOpacity={tiresStyle.strokeOpacity} strokeWidth="1" />
        <circle cx="276" cy="155" r="2" fill={tiresStyle.circleColor} stroke="#0b2b5c" strokeWidth="1" />
        <text x="340" y="171" textAnchor="start" fill={tiresStyle.textColor} fillOpacity={tiresStyle.textOpacity} className="text-[8px] font-bold tracking-wider">
          LLANTAS Y HORQUILLA
        </text>
        <text x="340" y="180" textAnchor="start" fill={tiresStyle.textColor} fillOpacity={tiresStyle.textOpacity} className="text-[7px] font-bold tracking-widest">
          {checklist?.llantas === 'b' ? 'ESTADO: BIEN' : checklist?.llantas === 'm' ? 'ESTADO: REVISIÓN' : 'SIN DATOS'}
        </text>
      </g>
    </svg>
  )
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '---'
  const [year, month, day] = dateStr.split('-')
  return `${day}-${month}-${year}`
}

export function ChecklistForm({ vehiculos, onSuccess, onCancel }: ChecklistFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(1) // Wizard step 1 a 5
  const [mensajeros, setMensajeros] = useState<any[]>([])
  const [loadingMensajeros, setLoadingMensajeros] = useState(true)
  const [latestChecklist, setLatestChecklist] = useState<any | null>(null)
  const [loadingLatestChecklist, setLoadingLatestChecklist] = useState(false)
  
  const {
    register,
    handleSubmit,
    control,
    watch,
    trigger,
    setValue,
    formState,
  } = useForm<any>({
    resolver: zodResolver(checklistFormSchema),
    defaultValues: {
      vehiculo_id: '',
      conductor_nombre: '',
      conductor_cedula: '',
      conductor_cargo: 'Mensajero',
      kilometraje: 0,
      evaluaciones: defaultEvaluaciones,
      observaciones: '',
    },
  })

  const errors = formState.errors as any
  const isSubmitting = formState.isSubmitting

  useEffect(() => {
    async function loadMensajeros() {
      try {
        const data = await getMensajeros()
        setMensajeros(data)
      } catch (err) {
        console.error('Error al cargar conductores:', err)
      } finally {
        setLoadingMensajeros(false)
      }
    }
    loadMensajeros()
  }, [])

  const conductorCedula = watch('conductor_cedula')

  // Buscar el conductor por cédula
  const matchedConductor = mensajeros.find(
    (m) => m.cedula && m.cedula.trim() === conductorCedula?.trim()
  )

  useEffect(() => {
    if (matchedConductor) {
      setValue('conductor_nombre', matchedConductor.nombre_conductor)
      setValue('conductor_cargo', matchedConductor.cargo || 'Mensajero')
      
      // Auto-seleccionar vehículo por placa
      if (matchedConductor.placa_conductor) {
        const matchedVehicle = vehiculos.find(
          (v) => v.placa.trim().toUpperCase() === matchedConductor.placa_conductor.trim().toUpperCase()
        )
        if (matchedVehicle) {
          setValue('vehiculo_id', matchedVehicle.id)
          setValue('kilometraje', matchedVehicle.kilometraje || 0)
        } else if (vehiculos.length > 0) {
          // Fallback si la placa asignada no existe en la BD
          const fallback = vehiculos.find(v => v.estado === 'activo') || vehiculos[0]
          setValue('vehiculo_id', fallback.id)
          setValue('kilometraje', fallback.kilometraje || 0)
        }
      } else if (vehiculos.length > 0) {
        // Fallback si no tiene placa asignada
        const fallback = vehiculos.find(v => v.estado === 'activo') || vehiculos[0]
        setValue('vehiculo_id', fallback.id)
        setValue('kilometraje', fallback.kilometraje || 0)
      }
    } else {
      // Limpiar los campos si no se encuentra
      setValue('conductor_nombre', '')
      setValue('conductor_cargo', 'Mensajero')
      setValue('vehiculo_id', '')
      setValue('kilometraje', 0)
    }
  }, [matchedConductor, setValue, vehiculos])

  const selectedVehiculoId = watch('vehiculo_id')
  const currentVehiculo = vehiculos.find(v => v.id === selectedVehiculoId)
  const evaluaciones = watch('evaluaciones') || {}

  useEffect(() => {
    if (selectedVehiculoId) {
      setLoadingLatestChecklist(true)
      getChecklists(undefined, undefined, selectedVehiculoId)
        .then((data) => {
          if (data && data.length > 0) {
            const latest = data[0]
            const latestDate = new Date(latest.created_at)
            const today = new Date()
            const isLatestToday = 
              latestDate.getDate() === today.getDate() &&
              latestDate.getMonth() === today.getMonth() &&
              latestDate.getFullYear() === today.getFullYear()
            
            if (isLatestToday) {
              setLatestChecklist(latest)
            } else {
              setLatestChecklist(null)
            }
          } else {
            setLatestChecklist(null)
          }
        })
        .catch((err) => {
          console.error('Error al cargar la última inspección:', err)
          setLatestChecklist(null)
        })
        .finally(() => {
          setLoadingLatestChecklist(false)
        })
    } else {
      setLatestChecklist(null)
    }
  }, [selectedVehiculoId])

  // Verificar si hay fallas marcadas como "Mal"
  const hasNovelty = Object.values(evaluaciones).includes('m')

  const handleFormSubmit = async (data: any) => {
    setError(null)
    
    // Si tiene novedades mecánicas, la observación es obligatoria
    if (hasNovelty && (!data.observaciones || data.observaciones.trim() === '')) {
      setError('Es obligatorio registrar una observación detallando la falla cuando reportas un componente como MALO (M).')
      setStep(5) // Llevar a la pestaña final
      return
    }

    try {
      const result = await createChecklist(data)
      if (result.error) {
        if (typeof result.error === 'object') {
          const firstKey = Object.keys(result.error)[0]
          const fieldErrors = (result.error as Record<string, string[]>)[firstKey]
          setError(fieldErrors[0] || 'Error al guardar la inspección')
        } else {
          setError(result.error)
        }
      } else {
        onSuccess()
      }
    } catch {
      setError('Error al registrar la inspección preoperacional')
    }
  }

  // Navegación con validación del paso actual
  const nextStep = async () => {
    if (step === 1) {
      const isValid = await trigger([
        'conductor_nombre',
        'conductor_cedula',
        'conductor_cargo',
        'vehiculo_id',
        'kilometraje'
      ])
      if (!isValid) return
    }
    setStep(prev => Math.min(prev + 1, 5))
  }

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-900/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Inspección Preoperacional</h3>
              <p className="text-xs text-neutral-400 mt-1">Inspección técnica de seguridad PESV y SST</p>
            </div>
          </div>
          <button 
            onClick={onCancel} 
            className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paso / Wizard Indicator */}
        <div className="bg-neutral-950 px-6 py-3 border-b border-neutral-800/60 flex items-center justify-between flex-shrink-0">
          <div className="flex gap-1.5 flex-1 max-w-md">
            {[1, 2, 3, 4, 5].map((s) => (
              <div 
                key={s} 
                className={`h-1.5 rounded-full flex-1 transition-all ${
                  s <= step ? 'bg-blue-600' : 'bg-neutral-800'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-neutral-400 ml-4">Paso {step} de 5</span>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* STEP 1: Datos Personales e Identificación */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Mensaje de bienvenida oficial de SST / PESV */}
              <div className="p-4 bg-blue-600/5 border border-blue-600/10 rounded-xl leading-relaxed text-xs text-neutral-300">
                <p className="font-bold text-white mb-1">Estimado colaborador,</p>
                <p>En coordinación con el área encargada de <strong>SST</strong> y <strong>PESV</strong> de la empresa <strong>LANDIMOTOS S.A.S</strong>, se implementa este formulario con el fin de registrar las inspecciones diarias del vehículo que tengas asignado.</p>
                <p className="mt-2 font-semibold text-blue-400">¡Muchas gracias por su compromiso con la seguridad!</p>
              </div>

              <h4 className="text-sm font-bold text-white uppercase tracking-wider border-b border-neutral-850 pb-2">Identificación del Conductor</h4>
              
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">N° de Cédula</label>
                <div className="relative">
                  <input
                    {...register('conductor_cedula')}
                    placeholder="1010XXXXXX"
                    className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  />
                  {loadingMensajeros && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    </div>
                  )}
                </div>
                {errors.conductor_cedula && <p className="mt-1 text-xs text-red-500">{errors.conductor_cedula.message}</p>}
              </div>

              {/* Registro oculto para que react-hook-form capture los datos del conductor */}
              <input type="hidden" {...register('conductor_nombre')} />
              <input type="hidden" {...register('conductor_cargo')} />

              {/* Tarjeta de perfil del conductor si se encuentra */}
              {matchedConductor ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                  {/* Columna Izquierda: Perfil Conductor */}
                  <div className="p-4 bg-neutral-950/40 border border-neutral-850 rounded-2xl flex flex-col justify-between space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center overflow-hidden text-blue-500 font-bold text-lg flex-shrink-0 shadow-inner">
                        {matchedConductor.foto_url ? (
                          <img src={matchedConductor.foto_url} alt={matchedConductor.nombre_conductor} className="w-full h-full object-cover" />
                        ) : (
                          matchedConductor.nombre_conductor.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-white text-sm truncate">{matchedConductor.nombre_conductor}</h5>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                            matchedConductor.cargo === 'Conductor'
                              ? 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
                              : 'text-purple-400 bg-purple-400/10 border-purple-400/20'
                          }`}>
                            {matchedConductor.cargo || 'Mensajero'}
                          </span>
                          {matchedConductor.licencia_categoria && (
                            <span className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                              Cat. {matchedConductor.licencia_categoria}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Estado de Documentos de Tránsito */}
                    <div className="grid grid-cols-3 gap-2">
                      {/* SOAT */}
                      <div className="p-2 bg-neutral-950 border border-neutral-800/80 rounded-xl flex flex-col justify-between items-center text-center">
                        <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider">SOAT</span>
                        <span className="text-[10px] font-semibold text-neutral-200 mt-1 font-mono">{formatDate(matchedConductor.soat_vencimiento)}</span>
                        {(() => {
                          const info = getDocumentStatus(matchedConductor.soat_vencimiento)
                          return (
                            <span className={`mt-1.5 text-[8px] font-bold py-0.5 px-1.5 rounded border leading-none scale-90 ${info.colorClass}`}>
                              {info.text}
                            </span>
                          )
                        })()}
                      </div>

                      {/* Tecno */}
                      <div className="p-2 bg-neutral-950 border border-neutral-800/80 rounded-xl flex flex-col justify-between items-center text-center">
                        <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider">Tecno</span>
                        <span className="text-[10px] font-semibold text-neutral-200 mt-1 font-mono">{formatDate(matchedConductor.tecno_vencimiento)}</span>
                        {(() => {
                          const info = getDocumentStatus(matchedConductor.tecno_vencimiento)
                          return (
                            <span className={`mt-1.5 text-[8px] font-bold py-0.5 px-1.5 rounded border leading-none scale-90 ${info.colorClass}`}>
                              {info.text}
                            </span>
                          )
                        })()}
                      </div>

                      {/* Licencia */}
                      <div className="p-2 bg-neutral-950 border border-neutral-800/80 rounded-xl flex flex-col justify-between items-center text-center">
                        <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider">Licencia</span>
                        <span className="text-[10px] font-semibold text-neutral-200 mt-1 font-mono">{formatDate(matchedConductor.licencia_vencimiento)}</span>
                        {(() => {
                          const info = getDocumentStatus(matchedConductor.licencia_vencimiento)
                          return (
                            <span className={`mt-1.5 text-[8px] font-bold py-0.5 px-1.5 rounded border leading-none scale-90 ${info.colorClass}`}>
                              {info.text}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Columna Derecha: Estado e Ilustración del Vehículo */}
                  <div className="p-4 bg-neutral-950/40 border border-neutral-850 rounded-2xl flex flex-col justify-between space-y-3 relative overflow-hidden">
                    {currentVehiculo ? (
                      <>
                        <div className="flex justify-between items-start">
                          <div>
                            <h6 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Vehículo Asignado</h6>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm font-bold text-white tracking-wide font-mono bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded shadow-sm">
                                {currentVehiculo.placa}
                              </span>
                              <span className="text-xs text-neutral-400 truncate max-w-[100px] md:max-w-[130px]">
                                {currentVehiculo.marca} {currentVehiculo.modelo}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Odo. Actual</span>
                            <span className="text-xs font-semibold text-neutral-300 font-mono">
                              {currentVehiculo.kilometraje.toLocaleString()} km
                            </span>
                          </div>
                        </div>

                        {/* Blueprint */}
                        <div className="flex-1 flex flex-col justify-center items-center relative min-h-[180px] w-full">
                          {loadingLatestChecklist ? (
                            <div className="flex flex-col items-center justify-center gap-1.5 text-neutral-400 py-8 bg-neutral-950/50 rounded-xl border border-neutral-800/40 w-full">
                              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                              <span className="text-[9px]">Cargando estado...</span>
                            </div>
                          ) : (
                            <>
                              <VehicleBlueprint tipo={currentVehiculo.tipo} checklist={latestChecklist} />
                              
                              <div className="absolute bottom-2 right-3 flex items-center gap-1.5 bg-[#0a1d37]/90 border border-white/10 px-2.5 py-0.5 rounded-full text-[8px] backdrop-blur-sm shadow-md">
                                <span className={`w-1.5 h-1.5 rounded-full ${latestChecklist?.tiene_novedad ? 'bg-rose-500 animate-pulse' : latestChecklist ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
                                <span className="text-neutral-300 font-medium font-mono">
                                  {latestChecklist 
                                    ? `INSPECCIÓN HOY: ${latestChecklist.tiene_novedad ? 'CON FALLAS' : 'COMPLETA'}` 
                                    : 'HOY: SIN INSPECCIÓN'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col justify-center items-center text-center p-3">
                        <AlertTriangle className="w-6 h-6 text-neutral-600 mb-1.5" />
                        <p className="text-xs text-neutral-400 font-semibold">Sin vehículo asignado</p>
                        <p className="text-[9px] text-neutral-500 mt-1 max-w-[180px]">Este colaborador no tiene una placa vinculada.</p>
                      </div>
                    )}
                  </div>

                  {/* Fila de alertas consolidada abajo del grid */}
                  {(() => {
                    const s = getDocumentStatus(matchedConductor.soat_vencimiento)
                    const t = getDocumentStatus(matchedConductor.tecno_vencimiento)
                    const l = getDocumentStatus(matchedConductor.licencia_vencimiento)
                    const isAnyExpired = s.status === 'expired' || t.status === 'expired' || l.status === 'expired'
                    const isAnySoon = s.status === 'expiring_soon' || t.status === 'expiring_soon' || l.status === 'expiring_soon'

                    // Alertas mecánicas previas
                    const hasMechanicalAlert = latestChecklist?.tiene_novedad

                    return (
                      <div className="col-span-1 md:col-span-2 space-y-2">
                        {isAnyExpired && (
                          <div className="flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                            <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5 animate-bounce" />
                            <div>
                              <span className="font-bold">¡ALERTA DE SEGURIDAD!</span> Tiene uno o más documentos de tránsito vencidos. Reporte esto al administrador inmediatamente.
                            </div>
                          </div>
                        )}
                        {!isAnyExpired && isAnySoon && (
                          <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs">
                            <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Aviso preventivo:</span> Uno de sus documentos está próximo a vencer (menos de 30 días). Gestione su renovación.
                            </div>
                          </div>
                        )}
                        {hasMechanicalAlert && (
                          <div className="flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                            <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5 animate-pulse" />
                            <div>
                              <span className="font-bold">¡ALERTA DE VEHÍCULO!</span> La última inspección preoperacional reportó fallas críticas en este vehículo. Verifique los componentes reportados.
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              ) : (
                conductorCedula && conductorCedula.trim().length >= 3 && !loadingMensajeros && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Cédula no registrada en la base de datos de personal. Por favor verifique o contacte a administración.</span>
                  </div>
                )
              )}

              <input type="hidden" {...register('vehiculo_id')} />
              <input type="hidden" {...register('kilometraje')} />
            </div>
          )}

          {/* STEP 2: Documentación y Fluidos */}
          {step === 2 && (
            <div className="space-y-6">
              {CATEGORIES.slice(0, 2).map((cat) => (
                <div key={cat.id} className="space-y-3">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider border-b border-neutral-850 pb-2">{cat.title}</h4>
                  <div className="space-y-2.5">
                    {cat.items.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-neutral-950/20 border border-neutral-800/40 rounded-xl hover:bg-neutral-850/10 transition-all"
                      >
                        <span className="text-sm text-neutral-200">{item.label}</span>
                        <Controller
                          name={`evaluaciones.${item.id}`}
                          control={control}
                          render={({ field }) => (
                            <div className="flex bg-neutral-950 border border-neutral-800 rounded-lg p-0.5 w-full sm:w-auto self-start sm:self-auto">
                              <button
                                type="button"
                                onClick={() => field.onChange('b')}
                                className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  field.value === 'b' ? 'bg-emerald-600 text-white' : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                              >
                                Bien
                              </button>
                              <button
                                type="button"
                                onClick={() => field.onChange('m')}
                                className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  field.value === 'm' ? 'bg-rose-600 text-white' : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                              >
                                Mal
                              </button>
                              <button
                                type="button"
                                onClick={() => field.onChange('na')}
                                className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  field.value === 'na' ? 'bg-neutral-800 text-neutral-300' : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                              >
                                N/A
                              </button>
                            </div>
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 3: Luces y Suspensión & Dirección */}
          {step === 3 && (
            <div className="space-y-6">
              {CATEGORIES.slice(2, 4).map((cat) => (
                <div key={cat.id} className="space-y-3">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider border-b border-neutral-850 pb-2">{cat.title}</h4>
                  <div className="space-y-2.5">
                    {cat.items.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-neutral-950/20 border border-neutral-800/40 rounded-xl hover:bg-neutral-850/10 transition-all"
                      >
                        <span className="text-sm text-neutral-200">{item.label}</span>
                        <Controller
                          name={`evaluaciones.${item.id}`}
                          control={control}
                          render={({ field }) => (
                            <div className="flex bg-neutral-950 border border-neutral-800 rounded-lg p-0.5 w-full sm:w-auto self-start sm:self-auto">
                              <button
                                type="button"
                                onClick={() => field.onChange('b')}
                                className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  field.value === 'b' ? 'bg-emerald-600 text-white' : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                              >
                                Bien
                              </button>
                              <button
                                type="button"
                                onClick={() => field.onChange('m')}
                                className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  field.value === 'm' ? 'bg-rose-600 text-white' : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                              >
                                Mal
                              </button>
                              <button
                                type="button"
                                onClick={() => field.onChange('na')}
                                className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  field.value === 'na' ? 'bg-neutral-800 text-neutral-300' : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                              >
                                N/A
                              </button>
                            </div>
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 4: Carrocería y Frenos */}
          {step === 4 && (
            <div className="space-y-6">
              {CATEGORIES.slice(4, 6).map((cat) => (
                <div key={cat.id} className="space-y-3">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider border-b border-neutral-850 pb-2">{cat.title}</h4>
                  <div className="space-y-2.5">
                    {cat.items.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-neutral-950/20 border border-neutral-800/40 rounded-xl hover:bg-neutral-850/10 transition-all"
                      >
                        <span className="text-sm text-neutral-200">{item.label}</span>
                        <Controller
                          name={`evaluaciones.${item.id}`}
                          control={control}
                          render={({ field }) => (
                            <div className="flex bg-neutral-950 border border-neutral-800 rounded-lg p-0.5 w-full sm:w-auto self-start sm:self-auto">
                              <button
                                type="button"
                                onClick={() => field.onChange('b')}
                                className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  field.value === 'b' ? 'bg-emerald-600 text-white' : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                              >
                                Bien
                              </button>
                              <button
                                type="button"
                                onClick={() => field.onChange('m')}
                                className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  field.value === 'm' ? 'bg-rose-600 text-white' : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                              >
                                Mal
                              </button>
                              <button
                                type="button"
                                onClick={() => field.onChange('na')}
                                className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  field.value === 'na' ? 'bg-neutral-800 text-neutral-300' : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                              >
                                N/A
                              </button>
                            </div>
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 5: Equipo de Prevención y Cierre */}
          {step === 5 && (
            <div className="space-y-6">
              {/* Prevención y EPP */}
              {CATEGORIES.slice(6, 8).map((cat) => (
                <div key={cat.id} className="space-y-3">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider border-b border-neutral-850 pb-2">{cat.title}</h4>
                  <div className="space-y-2.5">
                    {cat.items.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-neutral-950/20 border border-neutral-800/40 rounded-xl hover:bg-neutral-850/10 transition-all"
                      >
                        <span className="text-sm text-neutral-200">{item.label}</span>
                        <Controller
                          name={`evaluaciones.${item.id}`}
                          control={control}
                          render={({ field }) => (
                            <div className="flex bg-neutral-950 border border-neutral-800 rounded-lg p-0.5 w-full sm:w-auto self-start sm:self-auto">
                              <button
                                type="button"
                                onClick={() => field.onChange('b')}
                                className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  field.value === 'b' ? 'bg-emerald-600 text-white' : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                              >
                                Bien
                              </button>
                              
                              {/* Si es de protección personal (cat 8), no tiene opción de Mal */}
                              {!cat.isSpecial && (
                                <button
                                  type="button"
                                  onClick={() => field.onChange('m')}
                                  className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                    field.value === 'm' ? 'bg-rose-600 text-white' : 'text-neutral-500 hover:text-neutral-300'
                                  }`}
                                >
                                  Mal
                                </button>
                              )}
                              
                              <button
                                type="button"
                                onClick={() => field.onChange('na')}
                                className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  field.value === 'na' ? 'bg-neutral-800 text-neutral-300' : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                              >
                                N/A
                              </button>
                            </div>
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Observaciones */}
              <div className="space-y-2.5">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider border-b border-neutral-850 pb-2">Observaciones</h4>
                <div>
                  <label className="block text-xs text-neutral-400 mb-2 leading-relaxed">
                    Si en la inspección reporta un componente como malo debe registrar la observación detallando la falla para su corrección.
                  </label>
                  <textarea
                    {...register('observaciones')}
                    placeholder="Escribe aquí las novedades mecánicas u observaciones de la inspección..."
                    rows={4}
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-sm"
                  />
                </div>
              </div>

              {/* Alerta de fallas críticas */}
              {hasNovelty && (
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs leading-relaxed animate-pulse">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Novedad Reportada en la Inspección</p>
                    <p className="mt-0.5 text-neutral-400">Has calificado uno o más componentes como &quot;Mal&quot;. Al enviar, se creará una alerta inmediata al administrador y deberás describir el problema en las observaciones superiores.</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-neutral-800 bg-neutral-900/50 flex-shrink-0 gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 rounded-xl font-medium transition-all text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
          ) : (
            <button 
              type="button" 
              onClick={onCancel} 
              className="flex-1 sm:flex-none px-5 py-2.5 bg-neutral-850 hover:bg-neutral-800 text-neutral-400 rounded-xl font-medium transition-all text-sm"
            >
              Cancelar
            </button>
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={step === 1 && !matchedConductor}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-600/20 text-sm ml-auto animate-all duration-205"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit(handleFormSubmit)}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-600/20 text-sm ml-auto"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ClipboardCheck className="w-4 h-4" />
              )}
              <span>Enviar Inspección</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}