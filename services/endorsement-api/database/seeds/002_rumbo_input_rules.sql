-- Tipos esperados en la entrada de Rumbo / CambioFrecuencia. Idempotente.
INSERT INTO template_input_rules (template_id, field, data_type)
SELECT t.id, r.field, r.data_type
FROM templates t
JOIN products p ON p.id = t.product_id
JOIN endorsement_types e ON e.id = t.endorsement_type_id
CROSS JOIN (VALUES
  ('policyNumber',   'string'),
  ('idEnvio',        'integer'),
  ('frecuencia',     'string'),
  ('moneda',         'string'),
  ('plan',           'string'),
  ('usuario',        'string'),
  ('fechaSolicitud', 'date'),
  ('fechaCliente',   'date'),
  ('fechaEfectiva',  'date')
) AS r(field, data_type)
WHERE p.code = 'Rumbo' AND e.code = 'CambioFrecuencia' AND t.version = 1
ON CONFLICT (template_id, field) DO NOTHING;
