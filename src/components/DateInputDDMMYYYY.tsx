import React from 'react';
import { DateInput, DateInputProps } from './common/DateInput';

export interface DateInputDDMMYYYYProps extends Omit<DateInputProps, 'onChange'> {
  value: string;
  onChange: (isoOrFormatted: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const DateInputDDMMYYYY: React.FC<DateInputDDMMYYYYProps> = ({
  value,
  onChange,
  className,
  required = false,
  disabled,
  placeholder = 'DD/MM/YYYY',
}) => {
  return (
    <DateInput
      value={value}
      onChange={onChange}
      className={className}
      required={false}
      disabled={disabled}
      placeholder={placeholder}
      size="sm"
    />
  );
};
