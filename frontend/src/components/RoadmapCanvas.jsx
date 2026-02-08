import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { RoadmapNode } from './RoadmapNode'
import { GoalInputNode } from './GoalInputNode'

const nodeTypes = { roadmap: RoadmapNode, start: GoalInputNode }

const NODE_WIDTH = 220
const NODE_HEIGHT = 100
const HORIZONTAL_GAP = 280
const VERTICAL_GAP = 180

/** Compute horizontal tree layout with barycenter ordering to minimize edge crossings. */
function computeHorizontalTreeLayout(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, { ...n }]))
  const getLevel = (id) => {
    const n = byId.get(id)
    if (!n) return 0
    if (n._level != null) return n._level
    if (!n.prerequisites?.length) {
      n._level = 0
      return 0
    }
    n._level = 1 + Math.max(...n.prerequisites.map(getLevel))
    return n._level
  }
  nodes.forEach((n) => getLevel(n.id))
  const byLevel = new Map()
  nodes.forEach((n) => {
    const l = byId.get(n.id)._level
    if (!byLevel.has(l)) byLevel.set(l, [])
    byLevel.get(l).push(n.id)
  })
  const levels = [...byLevel.keys()].sort((a, b) => a - b)
  const positions = {}

  levels.forEach((level, levelIdx) => {
    let ids = byLevel.get(level)
    if (levelIdx > 0) {
      ids = [...ids].sort((a, b) => {
        const aPrereqs = byId.get(a)?.prerequisites || []
        const bPrereqs = byId.get(b)?.prerequisites || []
        const aY = aPrereqs.length
          ? aPrereqs.reduce((s, p) => s + (positions[p]?.y ?? 0), 0) / aPrereqs.length
          : 0
        const bY = bPrereqs.length
          ? bPrereqs.reduce((s, p) => s + (positions[p]?.y ?? 0), 0) / bPrereqs.length
          : 0
        return aY - bY
      })
    }
    const x = level * (NODE_WIDTH + HORIZONTAL_GAP)
    const totalH = (ids.length - 1) * VERTICAL_GAP + NODE_HEIGHT
    const startY = -totalH / 2 + NODE_HEIGHT / 2
    ids.forEach((id, i) => {
      positions[id] = {
        x,
        y: startY + i * VERTICAL_GAP,
      }
    })
  })
  return positions
}

function RoadmapCanvasInner({ roadmap, selectedNodeId, onSelectNode, onGenerateGoal, loading, error, preRoadmapMode }) {
  const completedIds = useMemo(() => new Set(roadmap.nodes.filter(n => n.completed).map(n => n.id)), [roadmap.nodes])
  const unlockedIds = useMemo(() => {
    const set = new Set()
    roadmap.nodes.forEach(n => {
      if (n.prerequisites.length === 0) set.add(n.id)
      else if (n.prerequisites.every(pid => completedIds.has(pid))) set.add(n.id)
    })
    return set
  }, [roadmap.nodes, completedIds])

  const layoutPositions = useMemo(() => computeHorizontalTreeLayout(roadmap.nodes), [roadmap.nodes])

  const initialNodes = useMemo(() => {
    return roadmap.nodes.map((n) => {
      const pos = layoutPositions[n.id] ?? { x: 0, y: 0 }
      const isStart = n.id === 'start' || n.id?.endsWith('-start')
      return {
        id: n.id,
        type: isStart ? 'start' : 'roadmap',
        position: pos,
        data: isStart && preRoadmapMode
          ? { isPreRoadmap: true, onGenerate: onGenerateGoal, loading, error }
          : isStart
            ? { title: n.title }
            : {
                title: n.title,
                completed: n.completed,
                locked: !unlockedIds.has(n.id),
              },
      }
    })
  }, [roadmap.nodes, unlockedIds, layoutPositions, onGenerateGoal, loading, error, preRoadmapMode])

  const initialEdges = useMemo(() => {
    return roadmap.nodes.flatMap((n) =>
      (n.prerequisites || []).map((pid) => ({
        id: `${pid}-${n.id}`,
        source: pid,
        target: n.id,
        type: 'smoothstep',
        pathOptions: { borderRadius: 16 },
      }))
    )
  }, [roadmap.nodes])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges])

  const onNodeClick = useCallback((_, node) => {
    if (node.type === 'start' && node.data?.isPreRoadmap) return
    const data = node.data
    if (data?.locked) return
    onSelectNode(node.id)
  }, [onSelectNode])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={1.5}
      defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="var(--border)" gap={16} />
      <Controls />
      <MiniMap nodeColor={(n) => (n.type === 'start' ? 'var(--bg-node)' : n.data.completed ? 'var(--completed)' : n.data.locked ? 'var(--unlocked)' : 'var(--bg-node)')} />
      {/*}
      <Panel position="top-left">
        <span className="canvas-hint">Pan, zoom, drag nodes. Click unlocked node to open details.</span>
      </Panel>*/}
    </ReactFlow>
  )
}

export function RoadmapCanvas({ roadmap, selectedNodeId, onSelectNode, onGenerateGoal, loading, error, preRoadmapMode }) {
  return (
    <ReactFlowProvider>
      <div style={{ width: '100%', height: '100%' }}>
        <RoadmapCanvasInner
          roadmap={roadmap}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onGenerateGoal={onGenerateGoal}
          loading={loading}
          error={error}
          preRoadmapMode={preRoadmapMode}
        />
      </div>
    </ReactFlowProvider>
  )
}
