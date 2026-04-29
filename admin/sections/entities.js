const { useState, useEffect, useRef, useMemo } = React;

// Mock data til at teste UI'et
const MOCK_ENTITIES = [
  // Tech & Work
  { id: 'e1', name: 'Lars Hansen', type: 'person', encounters: 42, lastSeen: 'Today 14:32', tags: ['work', 'engineering'], summary: 'Lead backend engineer. Often discusses Rust, Qdrant, and architecture.' },
  { id: 'e2', name: 'Sofie', type: 'person', encounters: 28, lastSeen: 'Today 14:32', tags: ['work', 'product'], summary: 'Product manager for the mobile app. Focuses on timeline and UX.' },
  { id: 'e3', name: 'Project Lumen', type: 'project', encounters: 56, lastSeen: 'Yesterday 11:00', tags: ['work'], summary: 'Q3 initiative to rewrite the ingestion pipeline.' },
  { id: 'e5', name: 'Rust', type: 'topic', encounters: 85, lastSeen: 'Today 12:18', tags: ['work', 'tech'], summary: 'Primary programming language for the Ombra backend.' },
  { id: 'e6', name: 'Distributed Systems', type: 'topic', encounters: 12, lastSeen: 'Today 12:18', tags: ['reading'], summary: 'Consensus protocols and cluster configuration.' },
  { id: 'e7', name: 'Henrik', type: 'person', encounters: 31, lastSeen: 'Today 14:32', tags: ['work', 'leadership'], summary: 'Engineering manager focusing on Q3 roadmap.' },
  { id: 'e8', name: 'Mia', type: 'person', encounters: 19, lastSeen: 'Monday 09:15', tags: ['work', 'design'], summary: 'Lead designer working on the design system.' },
  { id: 'e9', name: 'Jakob', type: 'person', encounters: 22, lastSeen: 'Yesterday 16:45', tags: ['work', 'frontend'], summary: 'Frontend developer for the Ombra app.' },
  { id: 'e10', name: 'Qdrant', type: 'topic', encounters: 48, lastSeen: 'Today 10:11', tags: ['work', 'database'], summary: 'Vector database used for embedding storage.' },
  { id: 'e11', name: 'Axum', type: 'topic', encounters: 27, lastSeen: 'Yesterday 14:20', tags: ['work', 'tech'], summary: 'Rust web framework used for the backend API.' },
  { id: 'e12', name: 'SQLite', type: 'topic', encounters: 33, lastSeen: 'Today 09:30', tags: ['work', 'database'], summary: 'Embedded database for structured app data.' },
  { id: 'e13', name: 'Ombra App', type: 'project', encounters: 76, lastSeen: 'Today 15:00', tags: ['work', 'product'], summary: 'The main Flutter mobile application.' },
  { id: 'e14', name: 'Llama.cpp', type: 'topic', encounters: 41, lastSeen: 'Tuesday 11:15', tags: ['work', 'ai'], summary: 'Inference engine for local LLMs.' },
  { id: 'e15', name: 'RAG Pipeline', type: 'project', encounters: 38, lastSeen: 'Today 13:45', tags: ['work', 'ai'], summary: 'Retrieval-Augmented Generation implementation.' },
  { id: 'e16', name: 'Embeddings', type: 'topic', encounters: 52, lastSeen: 'Today 10:15', tags: ['work', 'ai'], summary: 'Vector representations of memory clusters.' },
  { id: 'e32', name: 'Investors', type: 'person', encounters: 8, lastSeen: 'Last week', tags: ['work', 'business'], summary: 'Series A discussions and feature demos.' },
  
  // Personal & Social
  { id: 'e17', name: 'Sarah Kim', type: 'person', encounters: 15, lastSeen: 'Sunday 19:30', tags: ['social', 'friends'], summary: 'Close friend, starting new job at Stripe.' },
  { id: 'e18', name: 'Book Club', type: 'topic', encounters: 9, lastSeen: 'Sunday 21:00', tags: ['social', 'hobby'], summary: 'Monthly sci-fi book club.' },
  { id: 'e19', name: 'The Three-Body Problem', type: 'topic', encounters: 4, lastSeen: 'Sunday 21:00', tags: ['reading', 'hobby'], summary: 'Current book club read.' },
  { id: 'e20', name: 'Blindsight', type: 'topic', encounters: 2, lastSeen: 'Sunday 21:30', tags: ['reading', 'hobby'], summary: 'Next book club recommendation.' },
  { id: 'e23', name: 'Dad', type: 'person', encounters: 26, lastSeen: 'Wednesday 18:15', tags: ['family'], summary: 'Visiting Copenhagen in mid-May.' },
  { id: 'e24', name: 'Mom', type: 'person', encounters: 24, lastSeen: 'Last week', tags: ['family'], summary: 'Birthday coming up on May 31st.' },
  { id: 'e25', name: 'Nanna', type: 'person', encounters: 11, lastSeen: 'Wednesday 18:30', tags: ['family'], summary: 'Sister, lives in Copenhagen.' },
  
  // Places & Daily Life
  { id: 'e4', name: 'Prolog Coffee', type: 'place', encounters: 18, lastSeen: 'Thursday 08:45', tags: ['personal', 'routine'], summary: 'Frequent morning deep work spot.' },
  { id: 'e21', name: 'Democratic Coffee', type: 'place', encounters: 7, lastSeen: 'Last month', tags: ['personal', 'routine'], summary: 'Alternative work cafe.' },
  { id: 'e22', name: 'Darcy\'s', type: 'place', encounters: 3, lastSeen: 'Friday 09:00', tags: ['personal', 'food'], summary: 'New coffee place on Gammel Kongevej.' },
  { id: 'e29', name: 'CPH Airport', type: 'place', encounters: 6, lastSeen: '2 months ago', tags: ['travel'], summary: 'Copenhagen Airport, Terminal 2.' },
  { id: 'e30', name: 'LHR Airport', type: 'place', encounters: 4, lastSeen: '2 months ago', tags: ['travel'], summary: 'London Heathrow.' },
  { id: 'e35', name: 'Nørreport', type: 'place', encounters: 45, lastSeen: 'Tuesday 13:30', tags: ['routine', 'transit'], summary: 'Central transit hub and dentist location.' },
  
  // Health & Hobbies
  { id: 'e26', name: 'Half Marathon', type: 'project', encounters: 14, lastSeen: 'Thursday 18:00', tags: ['health', 'fitness'], summary: 'September race target: sub-5:00 pace.' },
  { id: 'e27', name: 'Running', type: 'topic', encounters: 32, lastSeen: 'Thursday 18:00', tags: ['health', 'fitness'], summary: 'Weekly long runs and tempo sessions.' },
  { id: 'e28', name: 'Sleep Optimization', type: 'topic', encounters: 8, lastSeen: 'Monday 22:00', tags: ['health', 'routine'], summary: 'No screens after 22:00 rule.' },
  { id: 'e33', name: 'Acquired Podcast', type: 'topic', encounters: 5, lastSeen: 'Wednesday 08:30', tags: ['learning'], summary: 'Tech history and strategy podcast.' },
  { id: 'e34', name: 'Lenny\'s Newsletter', type: 'topic', encounters: 3, lastSeen: 'Wednesday 08:30', tags: ['learning'], summary: 'Product strategy content.' },
  { id: 'e31', name: 'Stripe', type: 'project', encounters: 2, lastSeen: 'Sunday 19:30', tags: ['work', 'industry'], summary: 'Payment processor, Sarah\'s new employer.' }
];

const MOCK_RELATIONSHIPS = [
  // Core Team & Projects
  { source: 'e1', target: 'e3', strength: 0.9 },
  { source: 'e2', target: 'e13', strength: 0.95 },
  { source: 'e7', target: 'e3', strength: 0.85 },
  { source: 'e7', target: 'e1', strength: 0.8 },
  { source: 'e7', target: 'e2', strength: 0.8 },
  { source: 'e8', target: 'e13', strength: 0.85 },
  { source: 'e9', target: 'e13', strength: 0.9 },
  { source: 'e8', target: 'e9', strength: 0.75 },
  { source: 'e2', target: 'e8', strength: 0.7 },
  { source: 'e2', target: 'e9', strength: 0.7 },
  { source: 'e1', target: 'e2', strength: 0.6 },
  
  // Tech Stack
  { source: 'e1', target: 'e5', strength: 1.0 },
  { source: 'e3', target: 'e5', strength: 0.9 },
  { source: 'e5', target: 'e11', strength: 0.85 },
  { source: 'e1', target: 'e11', strength: 0.7 },
  { source: 'e5', target: 'e10', strength: 0.8 },
  { source: 'e1', target: 'e10', strength: 0.75 },
  { source: 'e1', target: 'e12', strength: 0.6 },
  { source: 'e5', target: 'e12', strength: 0.6 },
  { source: 'e3', target: 'e10', strength: 0.7 },
  { source: 'e3', target: 'e11', strength: 0.7 },
  { source: 'e6', target: 'e10', strength: 0.5 },
  
  // AI & Data
  { source: 'e3', target: 'e15', strength: 0.8 },
  { source: 'e15', target: 'e14', strength: 0.9 },
  { source: 'e15', target: 'e16', strength: 0.9 },
  { source: 'e10', target: 'e16', strength: 0.85 },
  { source: 'e1', target: 'e15', strength: 0.8 },
  { source: 'e1', target: 'e14', strength: 0.6 },
  
  // Business & Meta
  { source: 'e7', target: 'e32', strength: 0.8 },
  { source: 'e2', target: 'e32', strength: 0.6 },
  { source: 'e13', target: 'e32', strength: 0.7 },
  { source: 'e8', target: 'e33', strength: 0.5 },
  { source: 'e8', target: 'e34', strength: 0.6 },
  { source: 'e2', target: 'e34', strength: 0.5 },
  
  // Personal & Social
  { source: 'e17', target: 'e18', strength: 0.85 },
  { source: 'e9', target: 'e18', strength: 0.6 },
  { source: 'e18', target: 'e19', strength: 0.9 },
  { source: 'e18', target: 'e20', strength: 0.8 },
  { source: 'e17', target: 'e31', strength: 0.9 },
  
  // Family
  { source: 'e23', target: 'e24', strength: 0.9 },
  { source: 'e23', target: 'e25', strength: 0.75 },
  { source: 'e24', target: 'e25', strength: 0.75 },
  { source: 'e23', target: 'e29', strength: 0.6 },
  
  // Places & Habits
  { source: 'e4', target: 'e1', strength: 0.5 },
  { source: 'e4', target: 'e3', strength: 0.4 },
  { source: 'e21', target: 'e1', strength: 0.3 },
  { source: 'e22', target: 'e1', strength: 0.3 },
  { source: 'e35', target: 'e23', strength: 0.4 },
  { source: 'e29', target: 'e30', strength: 0.8 },
  
  // Health
  { source: 'e26', target: 'e27', strength: 0.95 },
  { source: 'e27', target: 'e28', strength: 0.5 },
  { source: 'e4', target: 'e27', strength: 0.4 },
  { source: 'e35', target: 'e1', strength: 0.2 },
];

const TYPE_COLORS = {
  person: '#8B7CF6',  // accent
  place: '#6BA98F',   // success
  project: '#D4956A', // warning
  topic: '#A09A94'    // muted
};

// --- Komponenter ---

function EntityGraph({ entities, relationships, tok, onSelectEntity, selectedId }) {
  const canvasRef = useRef(null);
  const graphData = useRef({ nodes: [], edges: [] });
  const cam = useRef({ x: 0, y: 0, k: 1 });
  const drag = useRef({ active: false, node: null, startX: 0, startY: 0, camStartX: 0, camStartY: 0 });
  const hover = useRef({ node: null });
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    // Synkroniser entities til persistent graphData (bevarer positioner ved rerender)
    const existingNodes = new Map(graphData.current.nodes.map(n => [n.id, n]));
    graphData.current.nodes = entities.map(e => {
      const radius = 5 + Math.min(e.encounters, 30) * 0.4;
      const existing = existingNodes.get(e.id);
      if (existing) return { ...existing, ...e, radius };
      return {
        ...e,
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 800,
        vx: 0, vy: 0,
        radius
      };
    });
    
    graphData.current.edges = relationships
      .filter(r => entities.find(n => n.id === r.source) && entities.find(n => n.id === r.target))
      .map(r => ({
        source: graphData.current.nodes.find(n => n.id === r.source),
        target: graphData.current.nodes.find(n => n.id === r.target),
        strength: r.strength
      }));
      
    // Forudberegn naboer for "Obsidian-style" hover effekt
    const neighbors = new Map();
    graphData.current.nodes.forEach(n => neighbors.set(n.id, new Set()));
    graphData.current.edges.forEach(e => {
      neighbors.get(e.source.id).add(e.target.id);
      neighbors.get(e.target.id).add(e.source.id);
    });

    const tick = () => {
      // Skaler efter devicePixelRatio for skarp tekst
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      const nodes = graphData.current.nodes;
      const edges = graphData.current.edges;
      
      // Simpel physics engine (Force-directed)
      const repulsion = 3000;
      const stiffness = 0.02;
      const damping = 0.75;
      
      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          let distSq = dx*dx + dy*dy;
          if (distSq === 0) distSq = 0.1;
          if (distSq < 100000) {
            const force = repulsion / distSq;
            const dist = Math.sqrt(distSq);
            nodes[i].vx += (dx / dist) * force;
            nodes[i].vy += (dy / dist) * force;
            nodes[j].vx -= (dx / dist) * force;
            nodes[j].vy -= (dy / dist) * force;
          }
        }
      }
      
      // Spring (edges)
      edges.forEach(edge => {
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const targetDist = 80;
        const force = (dist - targetDist) * stiffness * edge.strength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        edge.source.vx += fx; edge.source.vy += fy;
        edge.target.vx -= fx; edge.target.vy -= fy;
      });
      
      // Center gravity & update
      nodes.forEach(node => {
        node.vx += (0 - node.x) * 0.0005;
        node.vy += (0 - node.y) * 0.0005;
        
        if (drag.current.node === node) {
          node.vx = 0; node.vy = 0;
        } else {
          node.x += node.vx;
          node.y += node.vy;
          node.vx *= damping;
          node.vy *= damping;
        }
      });
      
      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(width / 2 + cam.current.x, height / 2 + cam.current.y);
      ctx.scale(cam.current.k, cam.current.k);

      const hoveredNode = hover.current.node;
      const selectedNodeId = selectedId;
      const hasHighlight = !!hoveredNode || !!selectedNodeId;
      const highlightId = hoveredNode?.id || selectedNodeId;
      const activeSet = highlightId ? neighbors.get(highlightId) : null;

      // Tegn linjer (edges)
      edges.forEach(edge => {
        let alpha = 0.15;
        if (hasHighlight) {
          if (edge.source.id === highlightId || edge.target.id === highlightId) alpha = 0.6;
          else alpha = 0.03;
        }
        ctx.beginPath();
        ctx.moveTo(edge.source.x, edge.source.y);
        ctx.lineTo(edge.target.x, edge.target.y);
        ctx.strokeStyle = `${tok.textMuted}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = (1 / cam.current.k) + (edge.strength * 2);
        ctx.stroke();
      });
      
      // Tegn cirkler (nodes)
      nodes.forEach(node => {
        const isHighlight = node.id === highlightId;
        const isNeighbor = activeSet && activeSet.has(node.id);
        let opacity = 0.9;
        if (hasHighlight) opacity = (isHighlight || isNeighbor) ? 1.0 : 0.15;
        
        const hexColor = TYPE_COLORS[node.type] || tok.textMuted;
        const r = parseInt(hexColor.slice(1,3), 16);
        const g = parseInt(hexColor.slice(3,5), 16);
        const b = parseInt(hexColor.slice(5,7), 16);

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        ctx.fill();
        
        if (isHighlight) {
          ctx.lineWidth = 2 / cam.current.k;
          ctx.strokeStyle = tok.textPrimary;
          ctx.stroke();
          ctx.shadowColor = hexColor;
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        
        // Label
        const showLabel = cam.current.k > 0.8 || node.radius > 6 || isHighlight || isNeighbor;
        if (showLabel) {
          const labelOpacity = hasHighlight ? ((isHighlight || isNeighbor) ? 1.0 : 0.1) : Math.min(1, cam.current.k * opacity);
          ctx.font = `${Math.max(10, 11 / cam.current.k)}px ${SANS}`;
          const rTxt = parseInt(tok.textSecondary.slice(1,3), 16) || 107;
          const gTxt = parseInt(tok.textSecondary.slice(3,5), 16) || 101;
          const bTxt = parseInt(tok.textSecondary.slice(5,7), 16) || 96;
          ctx.fillStyle = `rgba(${rTxt}, ${gTxt}, ${bTxt}, ${labelOpacity})`;
          ctx.textAlign = 'center';
          ctx.fillText(node.name, node.x, node.y + node.radius + (14 / cam.current.k));
        }
      });
      
      ctx.restore();
      animationFrameId = requestAnimationFrame(tick);
    };
    
    tick();
    
    // Interaktivitet (Drag, Zoom, Pan, Hover)
    let pointers = [];

    const getPointerPos = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const wx = (clickX - width / 2 - cam.current.x) / cam.current.k;
      const wy = (clickY - height / 2 - cam.current.y) / cam.current.k;
      return { x: clickX, y: clickY, wx, wy };
    };
    
    const handlePointerDown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.push({ id: e.pointerId, x: e.clientX, y: e.clientY });

      if (pointers.length === 1) {
        const { x, y, wx, wy } = getPointerPos(e.clientX, e.clientY);
        const clicked = graphData.current.nodes.find(n => {
          const dx = n.x - wx; const dy = n.y - wy;
          return Math.sqrt(dx*dx + dy*dy) <= n.radius + 8 / cam.current.k;
        });
        if (clicked) {
          drag.current = { active: true, node: clicked, startX: x, startY: y };
          onSelectEntity(clicked.id);
        } else {
          // Trykker på baggrund = vi panner. Ingen onSelectEntity(null) her.
          drag.current = { active: true, node: null, startX: x, startY: y, camStartX: cam.current.x, camStartY: cam.current.y };
        }
      } else if (pointers.length === 2) {
        const p1 = pointers[0];
        const p2 = pointers[1];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        drag.current.pinchDist = Math.sqrt(dx*dx + dy*dy);
        drag.current.camStartK = cam.current.k;
        drag.current.active = false; // Slå panning fra under zoom
      }
    };

    const handlePointerMove = (e) => {
      const ptr = pointers.find(p => p.id === e.pointerId);
      if (ptr) { ptr.x = e.clientX; ptr.y = e.clientY; }

      if (pointers.length === 2) {
        const p1 = pointers[0];
        const p2 = pointers[1];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (drag.current.pinchDist) {
          const scale = dist / drag.current.pinchDist;
          cam.current.k = Math.max(0.1, Math.min(5, drag.current.camStartK * scale));
        }
        return;
      }

      if (pointers.length === 1) {
        const p1 = pointers[0];
        const { x, y, wx, wy } = getPointerPos(p1.x, p1.y);
        
        if (drag.current.active) {
          if (drag.current.node) {
            drag.current.node.x = wx;
            drag.current.node.y = wy;
          } else {
            cam.current.x = drag.current.camStartX + (x - drag.current.startX);
            cam.current.y = drag.current.camStartY + (y - drag.current.startY);
          }
        } else {
          const hovered = graphData.current.nodes.find(n => {
            const dx = n.x - wx; const dy = n.y - wy;
            return Math.sqrt(dx*dx + dy*dy) <= n.radius + 6 / cam.current.k;
          });
          hover.current.node = hovered || null;
        }
      }
    };

    const handlePointerUp = (e) => {
      pointers = pointers.filter(p => p.id !== e.pointerId);
      if (pointers.length === 0) {
        drag.current.active = false;
        drag.current.node = null;
      } else if (pointers.length === 1) {
        const ptr = pointers[0];
        const { x, y } = getPointerPos(ptr.x, ptr.y);
        drag.current = { active: true, node: null, startX: x, startY: y, camStartX: cam.current.x, camStartY: cam.current.y };
      }
    };

    const handleWheel = (e) => {
      e.preventDefault();
      const { x, y, wx, wy } = getPointerPos(e.clientX, e.clientY);
      const delta = -e.deltaY * 0.002;
      const newK = Math.max(0.1, Math.min(5, cam.current.k * Math.exp(delta)));
      cam.current.k = newK;
      cam.current.x = x - canvas.clientWidth / 2 - wx * newK;
      cam.current.y = y - canvas.clientHeight / 2 - wy * newK;
    };
    
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [entities, relationships, tok, selectedId]);

  return (
    <div style={{ background: tok.surface, borderRadius: 16, border: `1px solid ${tok.border}`, overflow: 'hidden', height: '100%', minHeight: 0, minWidth: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
    </div>
  );
}

function EntityDetailPanel({ entity, tok, onClose, isMobile }) {
  if (!entity) return null;
  const color = TYPE_COLORS[entity.type] || tok.textMuted;

  return (
    <div style={{
      width: isMobile ? '100%' : 320, 
      maxHeight: isMobile ? '40vh' : '100%',
      flexShrink: 0,
      background: tok.surfaceElevated, border: `1px solid ${tok.border}`,
      borderRadius: 16, padding: 24, boxShadow: tok.shadow2,
      display: 'flex', flexDirection: 'column', gap: 16,
      overflowY: 'auto',
      animation: isMobile ? 'slide-up 250ms ease-out' : 'slide-left 250ms ease-out'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: color, background: `${color}18`, borderRadius: 6, padding: '4px 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {entity.type}
        </div>
        <div onClick={onClose} style={{ cursor: 'pointer', fontFamily: SANS, color: tok.textMuted, fontSize: 12 }}>Close ✕</div>
      </div>
      
      <div>
        <h2 style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontSize: 28, margin: '0 0 4px 0', color: tok.textPrimary, fontWeight: 300 }}>{entity.name}</h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: tok.textMuted }}>Last seen: {entity.lastSeen}</div>
      </div>
      
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {entity.tags.map(tag => (
          <div key={tag} style={{ border: `1px solid ${tok.borderSubtle}`, borderRadius: 100, padding: '3px 10px', fontFamily: SANS, fontSize: 11, color: tok.textSecondary }}>
            {tag}
          </div>
        ))}
      </div>
      
      <div style={{ height: 1, background: tok.borderSubtle, margin: '4px 0' }} />
      
      <div>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: tok.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Profile Summary</div>
        <div style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.5, color: tok.textPrimary }}>{entity.summary}</div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: tok.surface, padding: '12px 16px', borderRadius: 12 }}>
        <div style={{ fontFamily: SANS, fontSize: 12, color: tok.textSecondary }}>Total Encounters</div>
        <div style={{ fontFamily: MONO, fontSize: 16, color: tok.accent }}>{entity.encounters}</div>
      </div>
    </div>
  );
}

function EntitiesContent({ tok }) {
  const width = useWindowWidth();
  const isMobile = width < 768;
  const isStacked = width < 990; // Stack layoutet pænt når vi er under de 990px
  
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('ombra_entities_viewMode') || 'graph');
  const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem('ombra_entities_searchQuery') || '');
  const [selectedId, setSelectedId] = useState(() => {
    const saved = localStorage.getItem('ombra_entities_selectedId');
    if (saved === 'null') return null;
    return saved || MOCK_ENTITIES[0]?.id || null;
  });

  useEffect(() => localStorage.setItem('ombra_entities_viewMode', viewMode), [viewMode]);
  useEffect(() => localStorage.setItem('ombra_entities_searchQuery', searchQuery), [searchQuery]);
  useEffect(() => localStorage.setItem('ombra_entities_selectedId', selectedId === null ? 'null' : selectedId), [selectedId]);

  // Filtrer entiteter baseret på search string
  const filteredEntities = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return MOCK_ENTITIES;
    return MOCK_ENTITIES.filter(e => 
      e.name.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.tags.some(tag => tag.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const selectedEntity = MOCK_ENTITIES.find(e => e.id === selectedId);

  const totalEntities = MOCK_ENTITIES.length;
  const totalEncounters = MOCK_ENTITIES.reduce((s, e) => s + e.encounters, 0);
  const totalRelationships = MOCK_RELATIONSHIPS.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', animation: 'slide-up 200ms ease' }}>
      
      {/* ── Stats strip ── */}
      <div style={{
        display: 'flex', gap: 20, flexWrap: 'wrap',
        padding: '10px 16px',
        background: tok.surface, border: `1px solid ${tok.border}`,
        borderRadius: 12, flexShrink: 0
      }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: tok.textPrimary, letterSpacing: -0.5 }}>
            {totalEntities}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            entities
          </div>
        </div>
        <div style={{ width: 1, background: tok.borderSubtle, alignSelf: 'stretch' }} />
        <div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: tok.textPrimary, letterSpacing: -0.5 }}>
            {totalRelationships}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            relationships
          </div>
        </div>
        <div style={{ width: 1, background: tok.borderSubtle, alignSelf: 'stretch' }} />
        <div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: tok.textPrimary, letterSpacing: -0.5 }}>
            {totalEncounters}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: tok.textDisabled, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            encounters
          </div>
        </div>
      </div>
      
      {/* Header & Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'stretch', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', minWidth: 160 }}>
          <input 
            type="text" 
            placeholder="search entities…" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              fontFamily: MONO, fontSize: 11.5, color: tok.textSecondary,
              background: tok.surface, border: `1px solid ${tok.border}`,
              borderRadius: 9, padding: '7px 14px', outline: 'none',
              flex: 1, width: '100%',
              paddingRight: searchQuery ? 30 : 14
            }}
          />
          {searchQuery && (
            <div 
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute', right: 6, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: tok.textMuted,
                padding: 4
              }}
            >
              <Icon name="x" size={14} color="currentColor" />
            </div>
          )}
        </div>
        
        <div style={{
          display: 'flex', gap: 2,
          background: tok.surface, border: `1px solid ${tok.border}`, alignItems: 'center',
          borderRadius: 9, padding: 3,
        }}>
          <button onClick={() => setViewMode('graph')} style={{
            fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.7,
            padding: '4px 9px', borderRadius: 7, border: 'none', cursor: 'pointer', outline: 'none',
            background: viewMode === 'graph' ? tok.accentLight : 'transparent',
            color:      viewMode === 'graph' ? tok.accent : tok.textMuted,
            transition: 'background 100ms, color 100ms',
          }}>GRAPH</button>
          <button onClick={() => setViewMode('table')} style={{
            fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.7,
            padding: '4px 9px', borderRadius: 7, border: 'none', cursor: 'pointer', outline: 'none',
            background: viewMode === 'table' ? tok.accentLight : 'transparent',
            color:      viewMode === 'table' ? tok.accent : tok.textMuted,
            transition: 'background 100ms, color 100ms',
          }}>TABLE</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flexDirection: isStacked ? 'column' : 'row', gap: 20, flex: 1, minHeight: 0, minWidth: 0 }}>
        
        {/* Graph or Table View */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: isStacked ? 300 : 0, minWidth: 0 }}>
          {viewMode === 'graph' ? (
            <EntityGraph 
              entities={filteredEntities} 
              relationships={MOCK_RELATIONSHIPS} 
              tok={tok} 
              selectedId={selectedId}
              onSelectEntity={setSelectedId}
            />
          ) : (
            <div style={{ background: tok.surfaceElevated, borderRadius: 16, border: `1px solid ${tok.border}`, overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
              <div style={{ minWidth: 500, padding: '10px 0' }}>
                <div style={{ display: 'flex', padding: '12px 24px', borderBottom: `1px solid ${tok.borderSubtle}`, fontFamily: SANS, fontSize: 11, fontWeight: 600, color: tok.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <div style={{ flex: 2 }}>Entity Name</div>
                  <div style={{ flex: 1 }}>Type</div>
                  <div style={{ flex: 1 }}>Encounters</div>
                  <div style={{ flex: 1, textAlign: 'right' }}>Last Seen</div>
                </div>
                {filteredEntities.map(entity => {
                  const color = TYPE_COLORS[entity.type] || tok.textMuted;
                  const isSelected = selectedId === entity.id;
                  return (
                    <div key={entity.id} onClick={() => setSelectedId(isSelected ? null : entity.id)} 
                         style={{ display: 'flex', alignItems: 'center', padding: '14px 24px', borderBottom: `1px solid ${tok.borderSubtle}`, cursor: 'pointer', background: isSelected ? tok.surface : 'transparent', transition: 'background 150ms' }}>
                      <div style={{ flex: 2, fontFamily: SANS, fontSize: 14, fontWeight: 500, color: tok.textPrimary }}>{entity.name}</div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontFamily: MONO, fontSize: 10, color: color, background: `${color}18`, borderRadius: 6, padding: '3px 8px' }}>{entity.type}</span>
                      </div>
                      <div style={{ flex: 1, fontFamily: MONO, fontSize: 12, color: tok.textSecondary }}>{entity.encounters}</div>
                      <div style={{ flex: 1, textAlign: 'right', fontFamily: MONO, fontSize: 11, color: tok.textMuted }}>{entity.lastSeen}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Slide-in Detail Panel */}
        {selectedEntity && (
          <EntityDetailPanel 
            entity={selectedEntity} 
            tok={tok} 
            onClose={() => setSelectedId(null)}
            isMobile={isStacked}
          />
        )}
        
      </div>

      {/* ── Footer count ── */}
      <div style={{ fontFamily: MONO, fontSize: 10, color: tok.textDisabled, letterSpacing: 0.3, textAlign: 'center', paddingBottom: 4, flexShrink: 0 }}>
        {filteredEntities.length !== MOCK_ENTITIES.length
          ? `showing ${filteredEntities.length} of ${MOCK_ENTITIES.length} entities`
          : `showing ${filteredEntities.length} entities`}
      </div>

    </div>
  );
}

Object.assign(window, { EntitiesContent, EntityGraph, EntityDetailPanel });