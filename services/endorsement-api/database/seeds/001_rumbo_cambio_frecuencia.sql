-- Plantilla del ejemplo del PDF. Idempotente: no pisa cambios hechos después.
INSERT INTO products (code, name)
VALUES ('Rumbo', 'Rumbo')
ON CONFLICT (code) DO NOTHING;

INSERT INTO endorsement_types (code, name)
VALUES ('CambioFrecuencia', 'Cambio de frecuencia de pago')
ON CONFLICT (code) DO NOTHING;

WITH new_template AS (
  INSERT INTO templates (product_id, endorsement_type_id, version, status, output_skeleton)
  SELECT p.id, t.id, 1, 'ACTIVE', $json$
  {
    "policyNumber": { "$input": "policyNumber" },
    "idEnvio": { "$input": "idEnvio" },
    "financialPlansEntity": { "description": { "$input": "frecuencia" } },
    "currency": { "description": { "$input": "moneda" } },
    "productEntity": { "description": { "$input": "producto" } },
    "eventEntity": {
      "description": { "$primaryEvent": true },
      "dynamicData": { "$dynamicData": true }
    },
    "eventAppliedEntities": { "$eventAppliedEntities": true },
    "riskUnitEntities": [
      {
        "insuranceObjectEntities": [
          {
            "insuranceObjectNumber": "1",
            "coverageEntities": [],
            "participationEntities": []
          }
        ],
        "plansEntity": { "description": { "$input": "plan" } },
        "riskUnitNumber": "1"
      }
    ],
    "participationEntities": []
  }
  $json$::json
  FROM products p, endorsement_types t
  WHERE p.code = 'Rumbo' AND t.code = 'CambioFrecuencia'
  ON CONFLICT (product_id, endorsement_type_id, version) DO NOTHING
  RETURNING id
),
new_fields AS (
  INSERT INTO template_dynamic_fields (template_id, sort_order, label, source_field, default_value, required)
  SELECT nt.id, f.sort_order, f.label, f.source_field, f.default_value, f.required
  FROM new_template nt
  CROSS JOIN (VALUES
    (1,  'ProductosVida',           'producto',       NULL,            TRUE),
    (2,  'NombreUsuario',           'usuario',        'sistema',       FALSE),
    (3,  'NumeroPolizaEndoso',      'policyNumber',   NULL,            TRUE),
    (4,  'TipoEndosoPol',           NULL,             'Endoso Simple', FALSE),
    (5,  'ResponsableAtencion',     NULL,             'SAC',           FALSE),
    (6,  'EndosoModifPrima',        NULL,             'Si',            FALSE),
    (7,  'InicioVigenciaEndoso',    NULL,             'Default',       FALSE),
    (8,  'TipoVigenciaEndoso',      NULL,             '',              FALSE),
    (9,  'EndososSimplesSACRumbo',  NULL,             'TES008',        FALSE),
    (10, 'FechaSolicitud',          'fechaSolicitud', NULL,            TRUE),
    (11, 'FechaCliente',            'fechaCliente',   NULL,            TRUE),
    (12, 'FechaEfectiva',           'fechaEfectiva',  NULL,            TRUE)
  ) AS f(sort_order, label, source_field, default_value, required)
  RETURNING template_id
)
INSERT INTO template_events (template_id, order_event, description)
SELECT nt.id, e.order_event, e.description
FROM new_template nt
CROSS JOIN (VALUES
  (1, 'SolicitarEndoso'),
  (2, 'AprobarEndoso')
) AS e(order_event, description);
