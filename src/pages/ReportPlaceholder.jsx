import '../styles/pages/PageStyles.css'

export default function ReportPlaceholder({ title }) {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p className="page-subtitle">This report type is under development.</p>
        </div>
      </header>
    </div>
  )
}
