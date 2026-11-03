import { useId } from 'react';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

interface ChoiceFieldProps<T extends string> {
  label: string;
  value: T | '';
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  error?: string;
  /** Hide the visible label, e.g. in a filter row (the group keeps its accessible name). */
  hideLabel?: boolean;
  size?: 'small' | 'medium';
}

/**
 * One choice out of a few, as a labelled toggle button group. A pressed button cannot be
 * un-pressed, so a required choice stays set once made.
 */
export function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
  hideLabel,
  size = 'medium',
}: ChoiceFieldProps<T>) {
  const id = useId();
  return (
    <FormControl error={Boolean(error)}>
      {!hideLabel && (
        <FormLabel id={`${id}-label`} sx={{ mb: 0.75, fontSize: '0.875rem' }}>
          {label}
        </FormLabel>
      )}
      <ToggleButtonGroup
        exclusive
        size={size}
        color="primary"
        value={value}
        onChange={(_, next: T | null) => next !== null && onChange(next)}
        aria-label={hideLabel ? label : undefined}
        aria-labelledby={hideLabel ? undefined : `${id}-label`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        sx={{ flexWrap: 'wrap' }}
      >
        {options.map((option) => (
          <ToggleButton
            key={option.value}
            value={option.value}
            sx={{ px: 2, ...(error && { borderColor: 'error.main' }) }}
          >
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {error && <FormHelperText id={`${id}-error`}>{error}</FormHelperText>}
    </FormControl>
  );
}
