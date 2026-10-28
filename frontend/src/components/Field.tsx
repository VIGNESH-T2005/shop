import { forwardRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, useId } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> { label: string; error?: string; hint?: ReactNode }
export const Field = forwardRef<HTMLInputElement, Props>(({ label, error, hint, className = '', ...rest }, ref) => {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} ref={ref} className="input" aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} {...rest} />
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-e`} className="field-error" role="alert">{error}</p>}
    </div>
  );
});
Field.displayName = 'Field';

interface SelProps extends SelectHTMLAttributes<HTMLSelectElement> { label: string; error?: string }
export const SelectField = forwardRef<HTMLSelectElement, SelProps>(({ label, error, children, className = '', ...rest }, ref) => {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} ref={ref} className="input" aria-invalid={!!error} {...rest}>{children}</select>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
});
SelectField.displayName = 'SelectField';
