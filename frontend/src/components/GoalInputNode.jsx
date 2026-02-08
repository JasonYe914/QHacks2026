import { memo, useState } from 'react'
import { Handle, Position } from 'reactflow'
import './GoalInputNode.css'

export const GoalInputNode = memo(function GoalInputNode({ data }) {
  const [goal, setGoal] = useState('')
  const isPreRoadmap = data?.isPreRoadmap

  const handleGenerate = () => {
    if (!goal.trim()) return
    data?.onGenerate?.(goal.trim())
  }

  if (isPreRoadmap) {
    return (
      <div className="goal-input-node pre-roadmap">
        <div className="goal-input-label">Enter your goal</div>
        <input
          type="text"
          className="goal-input-field"
          placeholder="e.g. Become a software engineer"
          value={goal}
          onChange={e => setGoal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleGenerate()}
        />
        <button
          type="button"
          className="goal-generate-btn"
          onClick={handleGenerate}
          disabled={!goal.trim() || data?.loading}
        >
          {data?.loading ? 'Generating…' : 'Generate Roadmap'}
        </button>
        {data?.error && <p className="goal-error">{data.error}</p>}
      </div>
    )
  }

  return (
    <div className="goal-input-node display">
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="goal-display">{data?.title || 'Your goal'}</div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  )
})
