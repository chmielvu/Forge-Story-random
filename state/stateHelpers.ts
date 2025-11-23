import { YandereLedger, GraphNode, GraphLink, DirectorOutput } from '../types';

/**
 * Safely updates the ledger with clamping logic for 0-100 ranges
 */
export const updateLedgerHelper = (current: YandereLedger, updates: Partial<YandereLedger>): YandereLedger => {
  const next = { ...current, ...updates };
  
  // Deep merge traumaBonds
  if (updates.traumaBonds) {
    next.traumaBonds = {
      ...current.traumaBonds,
      ...updates.traumaBonds
    };
  }

  // Clamp vital stats 0-100
  next.physicalIntegrity = Math.max(0, Math.min(100, next.physicalIntegrity || 100));
  next.traumaLevel = Math.max(0, Math.min(100, next.traumaLevel || 0));
  next.shamePainAbyssLevel = Math.max(0, Math.min(100, next.shamePainAbyssLevel || 0));
  next.hopeLevel = Math.max(0, Math.min(100, next.hopeLevel || 0));
  next.complianceScore = Math.max(0, Math.min(100, next.complianceScore || 0));
  
  return next;
};

/**
 * Reconciles graph updates (add/remove nodes and edges) without duplicates
 */
export const reconcileGraphHelper = (
  currentNodes: GraphNode[], 
  currentLinks: GraphLink[], 
  updates?: DirectorOutput['graph_updates']
) => {
  if (!updates) return { nodes: currentNodes, links: currentLinks };

  let nextNodes = [...currentNodes];
  let nextLinks = [...currentLinks];

  // 1. Node Additions/Updates
  if (updates.nodes_added) {
    updates.nodes_added.forEach(newNode => {
      const index = nextNodes.findIndex(n => n.id === newNode.id);
      if (index > -1) {
        nextNodes[index] = { ...nextNodes[index], ...newNode };
      } else {
        nextNodes.push(newNode);
      }
    });
  }

  // 2. Node Removals
  if (updates.nodes_removed) {
    const removedIds = new Set(updates.nodes_removed);
    nextNodes = nextNodes.filter(n => !removedIds.has(n.id));
    // Remove links connected to removed nodes
    nextLinks = nextLinks.filter(l => {
      const s = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const t = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      return !removedIds.has(s) && !removedIds.has(t);
    });
  }

  // 3. Edge Additions/Updates
  if (updates.edges_added) {
    updates.edges_added.forEach(newEdge => {
      const index = nextLinks.findIndex(l => {
          const s = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
          const t = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
          return s === newEdge.source && t === newEdge.target;
      });

      if (index > -1) {
          nextLinks[index] = { ...nextLinks[index], ...newEdge };
      } else {
          nextLinks.push(newEdge);
      }
    });
  }

  // 4. Edge Removals
  if (updates.edges_removed) {
     updates.edges_removed.forEach(rem => {
        nextLinks = nextLinks.filter(l => {
          const s = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
          const t = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
          return !(s === rem.source && t === rem.target);
        });
     });
  }

  return { nodes: nextNodes, links: nextLinks };
};