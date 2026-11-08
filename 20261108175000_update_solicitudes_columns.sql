DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'solicitudes'
      AND column_name = 'le interesa'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'solicitudes'
      AND column_name = 'interesado_en_crear_pulseras'
  ) THEN
    ALTER TABLE public.solicitudes
      RENAME COLUMN "le interesa" TO interesado_en_crear_pulseras;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'solicitudes'
      AND column_name = 'donde nos ha encontrado'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'solicitudes'
      AND column_name = 'como_nos_encontro'
  ) THEN
    ALTER TABLE public.solicitudes
      RENAME COLUMN "donde nos ha encontrado" TO como_nos_encontro;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'solicitudes'
      AND column_name = 'experiencia'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'solicitudes'
      AND column_name = 'nivel_macrame_anterior'
  ) THEN
    ALTER TABLE public.solicitudes
      RENAME COLUMN experiencia TO nivel_macrame_anterior;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'solicitudes'
      AND column_name = 'motivo'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'solicitudes'
      AND column_name = 'objetivo_anterior'
  ) THEN
    ALTER TABLE public.solicitudes
      RENAME COLUMN motivo TO objetivo_anterior;
  END IF;
END
$$;

ALTER TABLE public.solicitudes
  ADD COLUMN IF NOT EXISTS interesado_en_crear_pulseras text,
  ADD COLUMN IF NOT EXISTS como_nos_encontro text;
