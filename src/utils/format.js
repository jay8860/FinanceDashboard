import { format, parse } from 'date-fns';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const preciseCurrency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat('en-IN');

export const formatCurrency = (value, precise = false) => {
  const amount = Number(value || 0);
  return precise ? preciseCurrency.format(amount) : currency.format(amount);
};

export const formatSignedCurrency = (value) => {
  const amount = Number(value || 0);
  if (amount === 0) return formatCurrency(0);
  return `${amount > 0 ? '+' : '-'}${formatCurrency(Math.abs(amount))}`;
};

export const formatInteger = (value) => integer.format(Number(value || 0));

export const formatDateLabel = (value) => {
  if (!value) return 'Unknown';
  return format(new Date(`${value}T00:00:00`), 'dd MMM yyyy');
};

export const monthLabelFromKey = (monthKey) => {
  if (!monthKey) return 'Unknown';
  return format(parse(monthKey, 'yyyy-MM', new Date()), 'MMM yyyy');
};

export const yearLabelFromDate = (value) => new Date(`${value}T00:00:00`).getFullYear();

export const titleCaseLoose = (value) => (
  String(value || '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
);

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
