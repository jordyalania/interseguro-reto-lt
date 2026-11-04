import { useState } from 'react';

export function JsonOutput({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value, null, 2);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="json-output">
      <button type="button" className="button ghost copy" onClick={() => void copy()}>
        {copied ? 'Copiado' : 'Copiar'}
      </button>
      <pre tabIndex={0}>{text}</pre>
    </div>
  );
}
