import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { api, ApiError, type TemplateSummary } from '../api';
import { JsonOutput } from '../components/JsonOutput';
import { buildPayload, parseJsonPayload, PDF_EXAMPLE } from '../lib/endorsement-form';

interface Props {
  token: string;
  onUnauthorized: () => void;
}

type Mode = 'form' | 'json';

const templateKey = (template: TemplateSummary) =>
  `${template.productCode}/${template.endorsementTypeCode}`;

function initialValues(template: TemplateSummary): Record<string, string> {
  const isPdfTemplate =
    template.productCode === PDF_EXAMPLE.producto &&
    template.endorsementTypeCode === PDF_EXAMPLE.tipoEndoso;
  return Object.fromEntries(
    template.inputs.map(({ name }) => [
      name,
      isPdfTemplate && PDF_EXAMPLE[name] != null ? String(PDF_EXAMPLE[name]) : '',
    ]),
  );
}

export function EndorsementsPage({ token, onUnauthorized }: Props) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Mode>('form');
  const [jsonText, setJsonText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [output, setOutput] = useState<unknown>(null);
  const [outputVersion, setOutputVersion] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const selectTemplate = (template: TemplateSummary) => {
    const nextValues = initialValues(template);
    setSelectedKey(templateKey(template));
    setValues(nextValues);
    setJsonText(
      JSON.stringify(
        buildPayload(template.productCode, template.endorsementTypeCode, nextValues),
        null,
        2,
      ),
    );
    setOutput(null);
    setError(null);
  };

  useEffect(() => {
    let cancelled = false;
    api
      .templates(token)
      .then(({ data }) => {
        if (cancelled) return;
        setTemplates(data.templates);
        if (data.templates[0]) selectTemplate(data.templates[0]);
      })
      .catch((caught: ApiError) => {
        if (cancelled) return;
        if (caught.status === 401) onUnauthorized();
        else setLoadError(caught.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const selected = useMemo(
    () => templates.find((template) => templateKey(template) === selectedKey),
    [templates, selectedKey],
  );

  const changeMode = (next: Mode) => {
    if (next === 'json' && selected) {
      setJsonText(
        JSON.stringify(
          buildPayload(selected.productCode, selected.endorsementTypeCode, values),
          null,
          2,
        ),
      );
    }
    setMode(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;

    let payload;
    if (mode === 'json') {
      const parsed = parseJsonPayload(jsonText);
      if ('error' in parsed) {
        setOutput(null);
        setError(new ApiError(400, 'INVALID_JSON', parsed.error));
        return;
      }
      payload = parsed.payload;
    } else {
      payload = buildPayload(selected.productCode, selected.endorsementTypeCode, values);
    }

    setSubmitting(true);
    setError(null);
    try {
      const { data, headers } = await api.translate(token, payload);
      setOutput(data);
      setOutputVersion(headers.get('x-template-version'));
    } catch (caught) {
      setOutput(null);
      if (caught instanceof ApiError && caught.status === 401) {
        onUnauthorized();
      } else {
        setError(caught as ApiError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const editableInputs =
    selected?.inputs.filter(({ name }) => name !== 'producto' && name !== 'tipoEndoso') ?? [];

  return (
    <div className="split">
      <form className="card" onSubmit={submit}>
        <div className="card-header">
          <div>
            <h2>Datos del endoso</h2>
            <p className="muted">Los campos los define la plantilla guardada en la base de datos.</p>
          </div>
          <div className="segmented" role="group" aria-label="Modo de edición">
            <button
              type="button"
              className={mode === 'form' ? 'active' : ''}
              aria-pressed={mode === 'form'}
              onClick={() => changeMode('form')}
            >
              Formulario
            </button>
            <button
              type="button"
              className={mode === 'json' ? 'active' : ''}
              aria-pressed={mode === 'json'}
              onClick={() => changeMode('json')}
            >
              JSON
            </button>
          </div>
        </div>

        {loadError && (
          <p className="alert error" role="alert">
            {loadError}
          </p>
        )}

        <label className="field">
          <span>Plantilla (producto / tipo de endoso)</span>
          <select
            value={selectedKey}
            onChange={(event) => {
              const template = templates.find((item) => templateKey(item) === event.target.value);
              if (template) selectTemplate(template);
            }}
          >
            {templates.map((template) => (
              <option key={templateKey(template)} value={templateKey(template)}>
                {template.productCode} / {template.endorsementTypeCode} (v{template.version})
              </option>
            ))}
          </select>
        </label>

        {mode === 'form' ? (
          <div className="form-grid">
            {editableInputs.map((input) => (
              <label className="field" key={input.name}>
                <span>
                  {input.name}
                  {input.required && (
                    <span className="required" aria-label="obligatorio">
                      {' '}
                      *
                    </span>
                  )}
                </span>
                <input
                  value={values[input.name] ?? ''}
                  placeholder={input.defaultValue ? `Default: ${input.defaultValue}` : ''}
                  onChange={(event) =>
                    setValues({ ...values, [input.name]: event.target.value })
                  }
                />
              </label>
            ))}
          </div>
        ) : (
          <label className="field">
            <span>JSON de entrada</span>
            <textarea
              className="code"
              rows={16}
              spellCheck={false}
              value={jsonText}
              onChange={(event) => setJsonText(event.target.value)}
            />
          </label>
        )}

        <button className="button primary" disabled={submitting || !selected}>
          {submitting ? 'Traduciendo…' : 'Traducir'}
        </button>
      </form>

      <section className="card output-card" aria-live="polite">
        <div className="card-header">
          <h2>JSON para el core</h2>
          {output !== null && outputVersion && (
            <span className="badge success">Plantilla v{outputVersion}</span>
          )}
        </div>
        {error && (
          <div className="alert error" role="alert">
            <strong>{error.message}</strong>
            {error.details?.missing && (
              <ul>
                {error.details.missing.map((item) => (
                  <li key={`${item.field}-${item.target}`}>
                    <code>{item.field}</code> → {item.target}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {output !== null && <JsonOutput value={output} />}
        {output === null && !error && (
          <p className="empty">El resultado aparecerá aquí, con el orden que define la plantilla.</p>
        )}
      </section>
    </div>
  );
}
