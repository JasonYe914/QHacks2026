import { useState, useEffect } from 'react'
import { ProofForm } from './ProofForm'
import './NodePanel.css'

const API = '/api'

export function NodePanel({ node, roadmapId, onProofSubmitted, onClose }) {
  const [proofs, setProofs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!node?.id) return
    setLoading(true)
    fetch(`${API}/roadmap/${roadmapId}/nodes/${node.id}/proofs`)
      .then(r => r.json())
      .then(setProofs)
      .finally(() => setLoading(false))
  }, [roadmapId, node?.id])

  if (!node) return null

  const handleProofSubmit = () => {
    setLoading(true)
    fetch(`${API}/roadmap/${roadmapId}/nodes/${node.id}/proofs`)
      .then(r => r.json())
      .then(setProofs)
      .then(onProofSubmitted)
      .finally(() => setLoading(false))
  }

  return (
    <aside className="node-panel">
      <div className="panel-header">
        <h2>{node.title}</h2>
        <button type="button" className="close-btn" onClick={onClose} aria-label="Close">×</button>
      </div>
      <p className="panel-description">{node.description}</p>

      <section className="panel-section">
        <h3>Tasks</h3>
        <ul>
          {node.tasks?.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>

      {!node.completed && (
        <ProofForm
          nodeId={node.id}
          proofType={node.proof_type}
          roadmapId={roadmapId}
          onSubmitted={handleProofSubmit}
        />
      )}

      <section className="panel-section">
        <h3>Proof of completion</h3>
        {loading && proofs.length === 0 ? (
          <p className="muted">Loading…</p>
        ) : proofs.length === 0 ? (
          <p className="muted">No proof submitted yet.</p>
        ) : (
          <ul className="proof-list">
            {proofs.map(p => (
              <li key={p.id} className="proof-item">
                <span className="proof-type">{p.proof_type}</span>
                {p.proof_type === 'link' && (
                  <a href={p.value} target="_blank" rel="noopener noreferrer">{p.value}</a>
                )}
                {p.proof_type === 'reflection' && <span>{p.value}</span>}
                {p.file_path && (
                  <a href={`/api/uploads/${p.file_path}`} target="_blank" rel="noopener noreferrer">View file</a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}
