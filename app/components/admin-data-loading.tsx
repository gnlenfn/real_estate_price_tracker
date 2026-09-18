export function AdminDataLoading({ label = "운영 데이터" }: { label?: string }) {
  return (
    <section
      className="panel admin-data-loading"
      role="status"
      aria-live="polite"
      aria-label={`${label} 불러오는 중`}
    >
      <div className="admin-loading-line wide" />
      <div className="admin-loading-line" />
      <div className="admin-loading-line medium" />
      <span>{label}를 불러오는 중입니다.</span>
    </section>
  );
}
