import { useState } from 'react'

const API = '/api'

export function ProofForm({ nodeId, proofType, roadmapId, onSubmitted }) {
  const [value, setValue] = useState('')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (proofType === 'photo' || proofType === 'file') {
      if (!file && !value.trim()) return
    } else if (!value.trim()) return

    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('proof_type', proofType)
      form.append('value', value || file?.name || '')
      if (file) form.append('file', file)

      const res = await fetch(`/api/roadmap/${roadmapId}/nodes/${nodeId}/proof`, {
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

  return (
    <section className="panel-section proof-form">
      <h3>Submit proof</h3>
      <form onSubmit={handleSubmit}>
        {(proofType === 'link' || proofType === 'reflection') && (
          proofType === 'link' ? (
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
        {(proofType === 'photo' || proofType === 'file') && (
          <>
            <input
              type="file"
              accept={proofType === 'photo' ? 'image/*' : '*/*'}
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
        <button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit proof'}
        </button>
      </form>
    </section>
  )
}
