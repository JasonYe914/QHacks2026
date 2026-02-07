import { useState, useEffect } from 'react'
import './JourneySlideshow.css'

const API = '/api'

export function JourneySlideshow({ roadmapId, onClose }) {
  const [proofs, setProofs] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/roadmap/${roadmapId}/journey`)
      .then(r => r.json())
      .then(setProofs)
      .finally(() => setLoading(false))
  }, [roadmapId])

  useEffect(() => {
    if (proofs.length <= 1) return
    const id = setInterval(() => {
      setIndex(i => (i + 1) % proofs.length)
    }, 4000)
    return () => clearInterval(id)
  }, [proofs.length])

  if (loading) return <div className="journey-overlay"><p>Loading your journey…</p></div>

  return (
    <div className="journey-overlay">
      <div className="journey-modal">
        <div className="journey-header">
          <h2>Your journey</h2>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        {proofs.length === 0 ? (
          <p className="journey-empty">No proof entries yet.</p>
        ) : (
          <>
            <div className="journey-slide">
              <span className="journey-counter">{index + 1} / {proofs.length}</span>
              <div className="journey-content">
                <span className="proof-type-badge">{proofs[index]?.proof_type}</span>
                {proofs[index]?.proof_type === 'link' && (
                  <a href={proofs[index].value} target="_blank" rel="noopener noreferrer">{proofs[index].value}</a>
                )}
                {proofs[index]?.proof_type === 'reflection' && <p>{proofs[index].value}</p>}
                {proofs[index]?.file_path && (
                  <img
                    src={`/api/uploads/${proofs[index].file_path}`}
                    alt="Proof"
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling?.classList.remove('hidden'); }}
                  />
                )}
                {proofs[index]?.file_path && (
                  <a className="hidden file-fallback" href={`/api/uploads/${proofs[index].file_path}`} target="_blank" rel="noopener noreferrer">View file</a>
                )}
              </div>
            </div>
            <div className="journey-dots">
              {proofs.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`dot ${i === index ? 'active' : ''}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
