import { useState } from 'react'

const API = '/api'

export function ProofForm({ nodeId, roadmapId, onSubmitted, proofs = [] }) {
  const [value, setValue] = useState('')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [extraType, setExtraType] = useState('link')

  const hasPhoto = proofs.some(p => p.proof_type === 'photo')
  const isStartNode = nodeId?.endsWith('-start')

  const handleSubmit = async (e, proofType) => {
    e.preventDefault()
    const usePhoto = proofType === 'photo'
    if (usePhoto) {
      if (!file) return
    } else if (proofType === 'link' || proofType === 'reflection') {
      if (!value.trim()) return
    } else if (proofType === 'file') {
      if (!file && !value.trim()) return
    }

    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('proof_type', proofType)
      form.append('value', value || file?.name || '')
      if (file) form.append('file', file)

      const res = await fetch(`${API}/roadmap/${roadmapId}/nodes/${nodeId}/proof`, {
        method: 'POST',
        body: form,
      })
      if (res.ok) {
        setValue('')
        setFile(null)
        onSubmitted()
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (isStartNode) return null

  return (
    <section className="panel-section proof-form">
      <h3>Submit proof</h3>
      {!hasPhoto && (
        <form onSubmit={e => handleSubmit(e, 'photo')} className="proof-block">
          <p className="proof-required">Photo (required)</p>
          <input
            type="file"
            accept="image/*"
            required
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          <textarea
            placeholder="Optional note"
            value={value}
            onChange={e => setValue(e.target.value)}
            rows={2}
          />
          <button type="submit" disabled={submitting || !file}>
            {submitting ? 'Submitting…' : 'Submit photo'}
          </button>
        </form>
      )}
      {hasPhoto && (
        <form onSubmit={e => handleSubmit(e, extraType)} className="proof-block extra-proof">
          <p className="proof-optional">Add optional proof</p>
          <select value={extraType} onChange={e => setExtraType(e.target.value)}>
            <option value="link">Link</option>
            <option value="reflection">Reflection</option>
            <option value="file">File</option>
          </select>
          {(extraType === 'link' || extraType === 'reflection') && (
            extraType === 'link' ? (
              <input
                type="url"
                placeholder="Paste link to your work"
                value={value}
                onChange={e => setValue(e.target.value)}
              />
            ) : (
              <textarea
                placeholder="Write a short reflection"
                value={value}
                onChange={e => setValue(e.target.value)}
                rows={4}
              />
            )
          )}
          {extraType === 'file' && (
            <>
              <input
                type="file"
                accept="*/*"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              <textarea
                placeholder="Optional note"
                value={value}
                onChange={e => setValue(e.target.value)}
                rows={2}
              />
            </>
          )}
          {(extraType === 'link' || extraType === 'reflection') ? (
            <button type="submit" disabled={submitting || !value.trim()}>
              {submitting ? 'Submitting…' : 'Add proof'}
            </button>
          ) : (
            <button type="submit" disabled={submitting || !file}>
              {submitting ? 'Submitting…' : 'Add file'}
            </button>
          )}
        </form>
      )}
    </section>
  )
}
