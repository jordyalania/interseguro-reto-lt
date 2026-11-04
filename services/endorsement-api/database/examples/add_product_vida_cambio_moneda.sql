-- Demuestra la extensibilidad: un producto y un endoso nuevos, con otra
-- estructura de salida, usando solo SQL. No requiere cambios de código.
INSERT INTO products (code, name)
VALUES ('VidaAhorro', 'Vida Ahorro')
ON CONFLICT (code) DO NOTHING;

INSERT INTO endorsement_types (code, name)
VALUES ('CambioMoneda', 'Cambio de moneda')
ON CONFLICT (code) DO NOTHING;

WITH new_template AS (
  INSERT INTO templates (product_id, endorsement_type_id, version, status, output_skeleton)
  SELECT p.id, t.id, 1, 'ACTIVE', $json$
  {
    "policyNumber": { "$input": "policyNumber" },
    "currency": { "description": { "$input": "monedaNueva" } },
    "productEntity": { "description": "Vida Ahorro" },
    "eventEntity": {
      "description": { "$primaryEvent": true },
      "dynamicData": { "$dynamicData": true }
    },
    "eventAppliedEntities": { "$eventAppliedEntities": true }
  }
  $json$::json
  FROM products p, endorsement_types t
  WHERE p.code = 'VidaAhorro' AND t.code = 'CambioMoneda'
  ON CONFLICT (product_id, endorsement_type_id, version) DO NOTHING
  RETURNING id
),
new_fields AS (
  INSERT INTO template_dynamic_fields (template_id, sort_order, label, source_field, default_value, required)
  SELECT nt.id, f.sort_order, f.label, f.source_field, f.default_value, f.required
  FROM new_template nt
  CROSS JOIN (VALUES
    (1, 'NumeroPolizaEndoso', 'policyNumber', NULL,      TRUE),
    (2, 'MonedaAnterior',     'monedaActual', NULL,      TRUE),
    (3, 'MonedaNueva',        'monedaNueva',  NULL,      TRUE),
    (4, 'CanalAtencion',      'canal',        'Digital', FALSE)
  ) AS f(sort_order, label, source_field, default_value, required)
  RETURNING template_id
)
INSERT INTO template_events (template_id, order_event, description)
SELECT nt.id, e.order_event, e.description
FROM new_template nt
CROSS JOIN (VALUES
  (1, 'SolicitarCambioMoneda'),
  (2, 'ValidarTipoCambio'),
  (3, 'AprobarEndoso')
) AS e(order_event, description);
