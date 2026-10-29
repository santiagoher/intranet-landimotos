# Esquema aportado previamente por el usuario

Fuente: `C:/Users/compu/.codex/attachments/ac0c6916-a838-4136-a909-e12348556702/Texto pegado.txt`. Es un esquema de contexto, no un respaldo de filas ni un script ejecutable. Describe `public.perfiles`, no `public.profiles`. La FK actual incluye ON DELETE CASCADE; este texto anterior no lo indica.

```sql
CREATE TABLE public.perfiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  nombre text,
  rol text DEFAULT 'Operativo'::text CHECK (rol = ANY (ARRAY['Admin'::text, 'Operativo'::text])),
  estado text DEFAULT 'activo'::text CHECK (estado = ANY (ARRAY['activo'::text, 'inactivo'::text])),
  created_at timestamp with time zone DEFAULT now(),
  modulos_permitidos ARRAY DEFAULT '{}'::text[],
  CONSTRAINT perfiles_pkey PRIMARY KEY (id),
  CONSTRAINT perfiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
```
