import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Manually parse .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envConfig = {}

envContent.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const parts = trimmed.split('=')
    if (parts.length >= 2) {
      const key = parts[0].trim()
      let val = parts.slice(1).join('=').trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      envConfig[key] = val
    }
  }
})

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Connecting to:', supabaseUrl)
const supabase = createClient(supabaseUrl, supabaseKey)

async function testQuery() {
  try {
    // 1. Check all vehicles
    const { data: vehicles, error: vErr } = await supabase
      .from('vehiculos')
      .select('*')
    if (vErr) console.error('Error fetching vehicles:', vErr.message)
    else console.log(`Vehicles count: ${vehicles?.length}`)

    // 2. Check all checklists
    const { data: checklists, error: cErr } = await supabase
      .from('vehiculo_checklists')
      .select('*')
      .order('created_at', { ascending: false })
    if (cErr) console.error('Error fetching checklists:', cErr.message)
    else {
      console.log(`Checklists count: ${checklists?.length}`)
      checklists.forEach(c => {
        console.log(`- Checklist ID: ${c.id}, Vehiculo: ${c.vehiculo_id}, Novedad: ${c.tiene_novedad}, Creado: ${c.created_at}`)
        console.log(`  Detalles: Luces: ${c.luces}, Frenos: ${c.frenos}, Llantas: ${c.llantas}, Carroceria: ${c.carroceria}, Aceite: ${c.aceite_motor}`)
      })
    }

    // 3. Check all alerts
    const { data: alerts, error: aErr } = await supabase
      .from('vehiculo_alertas')
      .select('*')
    if (aErr) console.error('Error fetching alerts:', aErr.message)
    else {
      console.log(`Alerts count: ${alerts?.length}`)
      alerts.forEach(a => {
        console.log(`- Alert ID: ${a.id}, Checklist: ${a.checklist_id}, Vehiculo: ${a.vehiculo_id}, Estado: ${a.estado}`)
      })
    }
  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

testQuery()
