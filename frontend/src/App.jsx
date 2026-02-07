import { useState, useCallback } from 'react'
import { RoadmapCanvas } from './components/RoadmapCanvas'
import { NodePanel } from './components/NodePanel'
import { JourneySlideshow } from './components/JourneySlideshow'
import './App.css'

const API = '/api'

export default function App() {
  const [goal, setGoal] = useState('')
  const [roadmapId, setRoadmapId] = useState(null)
  const [roadmap, setRoadmap] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [showJourney, setShowJourney] = useState(false)

  const generateRoadmap = useCallback(async () => {
    if (!goal.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/roadmap/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'default', goal: goal.trim() }),
      })
      let data
      try {
        data = await res.json()
      } catch {
        throw new Error(res.ok ? 'Invalid response from server' : `Request failed: ${res.status}`)
      }
      if (!res.ok) {
        throw new Error(data?.error || `Request failed: ${res.status}`)
      }
      if (!data.roadmap_id) {
        throw new Error('No roadmap returned from server')
      }
      const getRes = await fetch(`${API}/roadmap/${data.roadmap_id}`)
      let r
      try {
        r = await getRes.json()
      } catch {
        throw new Error(getRes.ok ? 'Invalid response from server' : `Failed to load roadmap: ${getRes.status}`)
      }
      if (!getRes.ok) {
        throw new Error(r?.error || 'Failed to load roadmap')
      }
      if (!r?.nodes?.length) {
        throw new Error('Roadmap has no nodes')
      }
      setRoadmapId(data.roadmap_id)
      setRoadmap(r)
      setSelectedNodeId(null)
      setShowJourney(false)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [goal])

  const refreshRoadmap = useCallback(async () => {
    if (!roadmapId) return
    const r = await fetch(`${API}/roadmap/${roadmapId}`).then(r => r.json())
    setRoadmap(r)
  }, [roadmapId])

  const allComplete = roadmap?.nodes?.every(n => n.completed) ?? false

  return (
    <div className="app">
      <header className="header">
        <h1>Skill Roadmap</h1>
        {!roadmapId ? (
          <div className="goal-form">
            <input
              type="text"
              placeholder="e.g. Become a software engineer"
              value={goal}
              onChange={e => { setGoal(e.target.value); setError(null); }}
              onKeyDown={e => e.key === 'Enter' && generateRoadmap()}
            />
            <button onClick={generateRoadmap} disabled={loading}>
              {loading ? 'Generating…' : 'Generate roadmap'}
            </button>
            {error && <p className="error-message">{error}</p>}
          </div>
        ) : (
          <div className="header-actions">
            <span className="goal-label">{roadmap?.goal}</span>
            <button onClick={() => { setRoadmapId(null); setRoadmap(null); setError(null); setSelectedNodeId(null); setShowJourney(false); }}>New roadmap</button>
            {allComplete && (
              <button className="journey-btn" onClick={() => setShowJourney(true)}>View journey</button>
            )}
          </div>
        )}
      </header>

      {roadmapId && roadmap && roadmap?.nodes?.length > 0 && (
        <>
          {showJourney ? (
            <JourneySlideshow
              roadmapId={roadmapId}
              onClose={() => setShowJourney(false)}
            />
          ) : (
            <main className="main">
              <div className="canvas-wrap">
                <RoadmapCanvas
                  key={`${roadmapId}-${roadmap.nodes?.map(n => `${n.id}:${n.completed ? 1 : 0}`).join(',')}`}
                  roadmap={roadmap}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              </div>
              {selectedNodeId && (
                <NodePanel
                  node={roadmap.nodes.find(n => n.id === selectedNodeId)}
                  roadmapId={roadmapId}
                  roadmap={roadmap}
                  onProofSubmitted={refreshRoadmap}
                  onClose={() => setSelectedNodeId(null)}
                />
              )}
            </main>
          )}
        </>
      )}
    </div>
  )
}
