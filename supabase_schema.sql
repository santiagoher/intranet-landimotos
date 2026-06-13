-- SCRIPT DE INICIALIZACIÓN ACTUALIZADO - MÓDULO DE INSPECCIÓN PREOPERACIONAL DIARIA DE VEHÍCULOS
-- Instrucciones: Ejecuta este script en el editor SQL de tu panel de Supabase.

-- =========================================================================
-- 1. CREACIÓN DE LA TABLA: vehiculos
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.vehiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placa VARCHAR(20) UNIQUE NOT NULL,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(50),
    tipo VARCHAR(50) NOT NULL, -- 'Moto', 'Carro', 'Camión', 'Otro'
    kilometraje INTEGER DEFAULT 0,
    estado VARCHAR(50) DEFAULT 'activo', -- 'activo', 'mantenimiento', 'inactivo'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Seguridad a Nivel de Fila)
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para vehiculos
CREATE POLICY "Permitir lectura para todos los autenticados" 
    ON public.vehiculos 
    FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Permitir todo para administradores" 
    ON public.vehiculos 
    FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE perfiles.id = auth.uid() AND perfiles.rol = 'Admin'
        )
    );

CREATE POLICY "Permitir actualizar a usuarios autenticados" 
    ON public.vehiculos 
    FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Pre-cargar los vehículos activos proporcionados por la empresa
INSERT INTO public.vehiculos (placa, marca, modelo, tipo, kilometraje, estado) VALUES
('ZYV-86F', 'BOXER', 'Yamaha', 'Moto', 0, 'activo'),
('BLW-58F', 'HERO', 'Hero', 'Moto', 0, 'activo'),
('SWL-86F', 'BOXER', 'Yamaha', 'Moto', 0, 'activo'),
('HEB-92F', 'HONDA', 'Honda', 'Moto', 0, 'activo'),
('IUT-82H', 'NKD', 'NKD', 'Moto', 0, 'activo'),
('TWG-79G', 'BOXER', 'Yamaha', 'Moto', 0, 'activo'),
('FVH-29H', 'BOXER', 'Yamaha', 'Moto', 0, 'activo'),
('728-ADY', 'AKT', 'AKT', 'Moto', 0, 'activo'),
('274-AGV', 'AKT3W', 'AKT', 'Moto', 0, 'activo'),
('WDS-468', 'CHEVROLET', 'Chevrolet', 'Carro', 0, 'activo'),
('ERL-416', 'CHEVROLET', 'Chevrolet', 'Carro', 0, 'activo'),
('UEZ-666', 'NISSAN', 'Nissan', 'Carro', 0, 'activo'),
('WDR-483', 'CHEVROLET', 'Chevrolet', 'Carro', 0, 'activo'),
('LQP-419', 'BOXER', 'Yamaha', 'Moto', 0, 'activo')
ON CONFLICT (placa) DO NOTHING;

-- =========================================================================
-- 2. CREACIÓN DE LA TABLA: vehiculo_checklists (Inspección Preoperacional Diaria)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.vehiculo_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID REFERENCES public.vehiculos(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    conductor_nombre VARCHAR(100),
    conductor_cedula VARCHAR(50),
    conductor_cargo VARCHAR(50),
    kilometraje INTEGER NOT NULL,
    luces VARCHAR(5) DEFAULT 'b', -- 'b' (bien), 'm' (mal), 'na' (no aplica)
    frenos VARCHAR(5) DEFAULT 'b',
    llantas VARCHAR(5) DEFAULT 'b',
    espejos VARCHAR(5) DEFAULT 'b',
    aceite_motor VARCHAR(5) DEFAULT 'b',
    liquido_frenos VARCHAR(5) DEFAULT 'b',
    carroceria VARCHAR(5) DEFAULT 'b',
    documentos VARCHAR(5) DEFAULT 'b',
    tiene_novedad BOOLEAN DEFAULT false,
    observaciones TEXT,
    evaluaciones JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.vehiculo_checklists ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para vehiculo_checklists
CREATE POLICY "Permitir lectura de checklists a usuarios autenticados" 
    ON public.vehiculo_checklists 
    FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Permitir insertar checklist a usuarios autenticados" 
    ON public.vehiculo_checklists 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = usuario_id);

-- =========================================================================
-- 3. CREACIÓN DE LA TABLA: vehiculo_alertas (Notificación de novedades a admins)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.vehiculo_alertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID REFERENCES public.vehiculo_checklists(id) ON DELETE CASCADE,
    vehiculo_id UUID REFERENCES public.vehiculos(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    estado VARCHAR(50) DEFAULT 'pendiente', -- 'pendiente', 'solucionado'
    comentarios_admin TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- Habilitar RLS
ALTER TABLE public.vehiculo_alertas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para vehiculo_alertas
CREATE POLICY "Permitir lectura de alertas a usuarios autenticados" 
    ON public.vehiculo_alertas 
    FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Permitir todo de alertas para administradores" 
    ON public.vehiculo_alertas 
    FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE perfiles.id = auth.uid() AND perfiles.rol = 'Admin'
        )
    );

CREATE POLICY "Permitir insertar alertas a usuarios autenticados" 
    ON public.vehiculo_alertas 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = usuario_id);

-- =========================================================================
-- 4. ÍNDICES DE RENDIMIENTO
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_vehiculo_checklists_created_at ON public.vehiculo_checklists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehiculo_checklists_vehiculo_id ON public.vehiculo_checklists(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_vehiculo_alertas_estado ON public.vehiculo_alertas(estado) WHERE estado = 'pendiente';

-- =========================================================================
-- 5. AJUSTES TABLA MENSAJEROS (Identificación Conductor y Documentación)
-- =========================================================================
ALTER TABLE public.mensajeros ADD COLUMN IF NOT EXISTS cedula VARCHAR(50);
ALTER TABLE public.mensajeros ADD COLUMN IF NOT EXISTS cargo VARCHAR(50) DEFAULT 'Mensajero';
ALTER TABLE public.mensajeros ADD COLUMN IF NOT EXISTS soat_vencimiento DATE;
ALTER TABLE public.mensajeros ADD COLUMN IF NOT EXISTS tecno_vencimiento DATE;
ALTER TABLE public.mensajeros ADD COLUMN IF NOT EXISTS licencia_vencimiento DATE;
ALTER TABLE public.mensajeros ADD COLUMN IF NOT EXISTS licencia_categoria VARCHAR(20);

-- Asegurar restricción UNIQUE en cédula para poder usar ON CONFLICT (ignora si ya existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_mensajeros_cedula'
    ) THEN
        ALTER TABLE public.mensajeros ADD CONSTRAINT unique_mensajeros_cedula UNIQUE (cedula);
    END IF;
END $$;

-- Pre-cargar los 15 conductores y mensajeros de la empresa con sus respectivos vencimientos
INSERT INTO public.mensajeros (
    nombre_conductor, 
    placa_conductor, 
    cedula, 
    cargo, 
    soat_vencimiento, 
    tecno_vencimiento, 
    licencia_vencimiento, 
    licencia_categoria, 
    estado
) VALUES
('Jefersson Mauricio Garcia Murcia', 'ZYV-86F', '1020304001', 'Mensajero', '2026-12-22', '2026-12-17', '2030-06-29', 'A2', 'disponible'),
('Kevin Felipe Rojas Conde', 'BLW-58F', '1020304002', 'Mensajero', '2027-03-08', '2027-04-14', '2035-09-04', 'A2', 'disponible'),
('Carlos Andres Mora Rodriguez', 'SWL-86F', '1020304003', 'Mensajero', '2027-06-01', '2026-06-27', '2029-11-15', 'A2', 'disponible'),
('Mario Alberto Beltran Angarita', 'HEB-92F', '1020304004', 'Mensajero', '2026-09-17', '2026-09-30', '2033-06-06', 'A2', 'disponible'),
('Bairon Farid Quevedo Narvaez', 'IUT-82H', '1020304005', 'Mensajero', '2027-01-14', NULL, '2026-12-05', 'A2', 'disponible'),
('Rafael Ricardo Sanchez Parra', 'TWG-79G', '1020304006', 'Mensajero', '2027-01-11', '2027-01-09', '2033-11-01', 'A2', 'disponible'),
('Juan David Gonzalez Mayor', 'FVH-29H', '1020304007', 'Mensajero', '2026-11-20', NULL, '2032-09-26', 'A2', 'disponible'),
('Cristian Adrian Betancourth Bejarano', '728-ADY', '1020304008', 'Conductor', '2026-09-09', '2026-09-18', '2032-01-26', 'B2', 'disponible'),
('Holman Jesid Rojas Gomez', '', '1020304009', 'Conductor', NULL, NULL, '2030-10-20', 'B1', 'disponible'),
('Deison Alexander Sierra Ortega', '274-AGV', '1020304010', 'Conductor', '2026-08-11', NULL, '2033-03-06', 'B1', 'disponible'),
('Jhon Fredy Ospina Hernandez', 'WDS-468', '1020304011', 'Conductor', '2027-05-24', '2027-06-01', '2028-11-28', 'C2', 'disponible'),
('Luis Eduardo Jaramillo Pinzón', 'ERL-416', '1020304012', 'Conductor', '2026-09-13', '2027-01-26', '2027-03-18', 'C2', 'disponible'),
('Jose Gonzalo Valenzuela Mendez', '', '1020304013', 'Conductor', NULL, NULL, '2026-09-25', 'C2', 'disponible'),
('Alan Leonardo Cardenas Solaque', 'UEZ-666', '1020304014', 'Conductor', '2027-05-24', '2026-06-24', '2028-03-10', 'C2', 'disponible'),
('Jhoan Steven Hipuja Rojas', 'WDR-483', '1020304015', 'Conductor', '2026-06-17', '2026-06-13', '2027-07-08', 'C2', 'disponible')
ON CONFLICT (cedula) DO UPDATE SET
    nombre_conductor = EXCLUDED.nombre_conductor,
    placa_conductor = EXCLUDED.placa_conductor,
    cargo = EXCLUDED.cargo,
    soat_vencimiento = EXCLUDED.soat_vencimiento,
    tecno_vencimiento = EXCLUDED.tecno_vencimiento,
    licencia_vencimiento = EXCLUDED.licencia_vencimiento,
    licencia_categoria = EXCLUDED.licencia_categoria,
    estado = EXCLUDED.estado;

-- =========================================================================
-- 6. MIGRACIONES ADICIONALES (Compatibilidad con bases de datos existentes)
-- =========================================================================
ALTER TABLE public.vehiculo_checklists ADD COLUMN IF NOT EXISTS conductor_nombre VARCHAR(100);
ALTER TABLE public.vehiculo_checklists ADD COLUMN IF NOT EXISTS conductor_cedula VARCHAR(50);
ALTER TABLE public.vehiculo_checklists ADD COLUMN IF NOT EXISTS conductor_cargo VARCHAR(50);
ALTER TABLE public.vehiculo_checklists ADD COLUMN IF NOT EXISTS evaluaciones JSONB DEFAULT '{}'::jsonb;

-- =========================================================================
-- 7. POLÍTICAS DE RLS PARA LA TABLA DE MENSAJEROS
-- =========================================================================
ALTER TABLE public.mensajeros ENABLE ROW LEVEL SECURITY;

-- Permitir leer mensajeros a cualquier usuario autenticado
CREATE POLICY "Permitir lectura de mensajeros a autenticados" 
    ON public.mensajeros 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Permitir crear, actualizar y borrar mensajeros únicamente a administradores
CREATE POLICY "Permitir gestion de mensajeros para administradores" 
    ON public.mensajeros 
    FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE perfiles.id = auth.uid() AND perfiles.rol = 'Admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE perfiles.id = auth.uid() AND perfiles.rol = 'Admin'
        )
    );

-- =========================================================================
-- 8. CREACIÓN DE TABLAS PARA MÓDULO DE ATENCIÓN AL CLIENTE Y PROGRAMACIÓN
-- =========================================================================

-- Tabla de Asesores de Atención
CREATE TABLE IF NOT EXISTS public.atencion_asesores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Etiquetas de Atención
CREATE TABLE IF NOT EXISTS public.atencion_etiquetas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(50) DEFAULT '#3b82f6',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Atención Diaria (Registro de Clientes)
CREATE TABLE IF NOT EXISTS public.atencion_diaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    asesor_id UUID REFERENCES public.atencion_asesores(id) ON DELETE CASCADE,
    etiquetas JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"tag-id-1": 12, "tag-id-2": 5}
    total_clientes INTEGER NOT NULL DEFAULT 0,
    observaciones TEXT,
    usuario_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_fecha_asesor UNIQUE (fecha, asesor_id)
);

-- Tabla de Programación de Estados de WhatsApp
CREATE TABLE IF NOT EXISTS public.atencion_estados_whatsapp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL,
    asesor_id UUID REFERENCES public.atencion_asesores(id) ON DELETE CASCADE,
    tematica VARCHAR(255) NOT NULL,
    cantidad_requerida INTEGER DEFAULT 1,
    estado VARCHAR(50) DEFAULT 'pendiente', -- 'pendiente', 'cumplido', 'incumplido'
    observaciones TEXT,
    usuario_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================================================================
-- 9. HABILITAR RLS Y DEFINIR POLÍTICAS
-- =========================================================================

ALTER TABLE public.atencion_asesores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atencion_etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atencion_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atencion_estados_whatsapp ENABLE ROW LEVEL SECURITY;

-- Políticas para atencion_asesores
CREATE POLICY "Permitir lectura de asesores a autenticados" 
    ON public.atencion_asesores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir gestion de asesores a admins" 
    ON public.atencion_asesores FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE perfiles.id = auth.uid() AND perfiles.rol = 'Admin'
        )
    );

-- Políticas para atencion_etiquetas
CREATE POLICY "Permitir lectura de etiquetas a autenticados" 
    ON public.atencion_etiquetas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir gestion de etiquetas a admins" 
    ON public.atencion_etiquetas FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE perfiles.id = auth.uid() AND perfiles.rol = 'Admin'
        )
    );

-- Políticas para atencion_diaria
CREATE POLICY "Permitir lectura de atencion diaria a autenticados" 
    ON public.atencion_diaria FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir insertar atencion diaria a autenticados" 
    ON public.atencion_diaria FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir gestion de atencion diaria a admins" 
    ON public.atencion_diaria FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE perfiles.id = auth.uid() AND perfiles.rol = 'Admin'
        )
    );

-- Políticas para atencion_estados_whatsapp
CREATE POLICY "Permitir lectura de estados a autenticados" 
    ON public.atencion_estados_whatsapp FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir actualizar estados a autenticados" 
    ON public.atencion_estados_whatsapp FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Permitir gestion de estados a admins" 
    ON public.atencion_estados_whatsapp FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles 
            WHERE perfiles.id = auth.uid() AND perfiles.rol = 'Admin'
        )
    );

-- =========================================================================
-- 10. CARGA DE REGISTROS INICIALES (SEMILLAS)
-- =========================================================================

-- Asesores predeterminados
INSERT INTO public.atencion_asesores (nombre, activo) VALUES
('Carolina Rojas', true),
('Sebastián Gómez', true),
('Marcela Silva', true) 
ON CONFLICT (nombre) DO NOTHING;

-- Etiquetas predeterminadas con colores premium
INSERT INTO public.atencion_etiquetas (nombre, color, activo) VALUES
('Ventas', '#f59e0b', true),          -- Amber
('Soporte Técnico', '#3b82f6', true), -- Blue
('Garantías', '#ef4444', true),       -- Red
('Información General', '#10b981', true), -- Emerald
('Quejas y Reclamos', '#8b5cf6', true),   -- Purple
('Otros', '#6b7280', true)            -- Gray
ON CONFLICT (nombre) DO NOTHING;
