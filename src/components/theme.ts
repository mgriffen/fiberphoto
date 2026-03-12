export const colors = {
  bg:            '#f0f2f5',
  surface:       '#ffffff',
  primary:       '#1a2332',   // dark navy — MCN brand feel
  accent:        '#2563eb',   // bright blue for interactive elements
  accentLight:   '#dbeafe',
  danger:        '#dc2626',
  dangerLight:   '#fee2e2',
  warning:       '#d97706',
  warningLight:  '#fef3c7',
  success:       '#16a34a',
  successLight:  '#dcfce7',
  text:          '#111827',
  textSecondary: '#6b7280',
  border:        '#e5e7eb',
  inputBg:       '#f9fafb',
};

/** Color scheme per structure type abbreviation */
export const structureColors: Record<string, { bg: string; text: string; border: string }> = {
  FP: { bg: '#ecfdf5', text: '#059669', border: '#6ee7b7' },  // green — Flower Pot
  HH: { bg: '#eff6ff', text: '#2563eb', border: '#93c5fd' },  // blue  — Hand Hole
  BP: { bg: '#fff7ed', text: '#ea580c', border: '#fdba74' },  // orange — Bore Pit
};

export const fonts = {
  mono: 'Courier New',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
};
