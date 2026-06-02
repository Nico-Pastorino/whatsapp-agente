-- 024_response_tone.sql
-- Agrega un campo explícito de "tono de respuesta" del asistente.
-- ADITIVO Y SEGURO: solo agrega una columna nullable, no borra ni modifica datos.
-- El asistente la usa como una preferencia más de estilo; si está vacía,
-- se comporta exactamente como antes.

alter table business_settings
  add column if not exists response_tone text not null default '';

-- Valores esperados (códigos cortos): 'cercano' | 'profesional' | 'divertido' | 'directo' | ''
-- No se aplica un CHECK para no bloquear futuros tonos; la validación vive en la app.
