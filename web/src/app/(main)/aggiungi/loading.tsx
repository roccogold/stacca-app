export default function AggiungiLoading() {
  return (
    <div className="page-loading page-loading--form" aria-busy="true" aria-label="Caricamento">
      <div className="page-loading__pulse" />
    </div>
  );
}
