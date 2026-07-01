interface StatCardProps {
  label: string;
  value: string;
  hint: string;
}

export const StatCard = ({ label, value, hint }: StatCardProps) => (
  <article className="stat-card">
    <span>{label}</span>
    <strong>{value}</strong>
    <p>{hint}</p>
  </article>
);
