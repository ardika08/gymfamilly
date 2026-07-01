export const formatInputDate = (date: Date) => date.toISOString().slice(0, 10);

export const formatDisplayDate = (value?: string | null) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatDisplayTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDisplayDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }

  return `${formatDisplayDate(value)}, ${formatDisplayTime(value)}`;
};

export const formatDisplayDayMonth = (value: Date) => {
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};
