import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import './RoadmapNode.css'

export const RoadmapNode = memo(function RoadmapNode({ data, selected }) {
  const { title, completed, locked } = data
  return (
    <div className={`roadmap-node ${locked ? 'locked' : ''} ${completed ? 'completed' : ''} ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-title">{title}</div>
      {completed && <span className="node-badge">✓</span>}
      {locked && !completed && <span className="node-badge lock">🔒</span>}
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  )
})
