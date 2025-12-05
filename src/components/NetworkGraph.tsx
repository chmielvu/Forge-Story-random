
import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphLink, CharacterId, YandereLedger } from '../types';

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  ledger?: YandereLedger; 
  executedCode?: string; // New prop to show code execution status
}

// Strict typing for D3 Simulation
interface SimulationNode extends d3.SimulationNodeDatum, GraphNode {}

const NetworkGraph: React.FC<Props> = ({ nodes, links, ledger, executedCode }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Default values if ledger is missing
  const trauma = ledger?.traumaLevel || 0;
  const hope = ledger?.hopeLevel || 50;

  // 1. Stable References: Prevent simulation restart unless data *actually* changes
  // We map to new objects to allow D3 to mutate x/y/vx/vy without polluting the Zustand store props
  // Using useMemo ensures this only happens when nodes/links prop arrays actually change reference
  const simulationNodes = useMemo(() => 
    nodes.map(n => ({ ...n })) as SimulationNode[], 
  [nodes]);

  const simulationLinks = useMemo(() => 
    links.map(l => ({ ...l, source: typeof l.source === 'string' ? l.source : (l.source as any).id, target: typeof l.target === 'string' ? l.target : (l.target as any).id })) as d3.SimulationLinkDatum<SimulationNode>, 
  [links]);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);

    // Simulation setup
    const simulation = d3.forceSimulation<SimulationNode>(simulationNodes)
      .force("link", d3.forceLink<SimulationNode, d3.SimulationLinkDatum<SimulationNode>>(simulationLinks).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(40))
      .alphaDecay(0.05); // Stabilize faster

    // --- RENDER LINKS ---
    const getLinkColor = (relation: string) => {
        const r = relation.toLowerCase();
        if (r.includes('hate') || r.includes('hurt') || r.includes('hunt')) return "#be123c"; // Crimson
        if (r.includes('love') || r.includes('bond') || r.includes('protect')) return "#facc15"; // Gold
        return "#44403c"; // Stone/Neutral
    };

    const link = svg.append("g")
      .selectAll("line")
      .data(simulationLinks)
      .join("line")
      .attr("stroke", (d: any) => getLinkColor(d.relation))
      .attr("stroke-opacity", (d: any) => 0.4 + (d.weight / 20))
      .attr("stroke-width", (d: any) => Math.sqrt(d.weight) * 1.5);

    // --- RENDER NODES ---
    const node = svg.append("g")
      .selectAll("circle")
      .data(simulationNodes)
      .join("circle")
      .attr("r", (d: any) => {
          let base = d.group === 'subject' ? 8 : 14;
          // Player node pulses with hope
          if (d.id === CharacterId.PLAYER) base += (hope / 20);
          return base;
      })
      .attr("fill", (d: any) => {
        if (d.id === CharacterId.PLAYER) return "#e7e5e4";
        if (d.group === 'faculty') return "#881337"; // Crimson
        return "#ca8a04"; // Darker Gold
      })
      .attr("stroke", "#000")
      .attr("stroke-width", 1.5)
      .call(drag(simulation) as any);

    // --- RENDER LABELS ---
    const labels = svg.append("g")
      .selectAll("text")
      .data(simulationNodes)
      .join("text")
      .text((d: any) => d.label)
      .attr("font-size", "10px")
      .attr("fill", (d: any) => d.group === 'faculty' ? "#facc15" : "#a8a29e")
      .attr("dx", 18)
      .attr("dy", 4)
      .attr("font-family", "JetBrains Mono")
      .style("text-transform", "uppercase")
      .style("letter-spacing", "0.1em");

    // --- TOOLTIPS ---
    link.append("title").text((d: any) => `${d.source.label || d.source} → ${d.target.label || d.target}: ${d.relation}`);
    node.append("title").text((d: any) => `${d.label} [Val: ${d.val}]`);

    // --- TICK FUNCTION with TRAUMA JITTER ---
    simulation.on("tick", () => {
      const jitter = trauma > 70 ? (trauma - 70) * 0.05 : 0;
      link
        .attr("x1", (d: any) => d.source.x + (Math.random() - 0.5) * jitter)
        .attr("y1", (d: any) => d.source.y + (Math.random() - 0.5) * jitter)
        .attr("x2", (d: any) => d.target.x + (Math.random() - 0.5) * jitter)
        .attr("y2", (d: any) => d.target.y + (Math.random() - 0.5) * jitter);
      node
        .attr("cx", (d: any) => d.x + (Math.random() - 0.5) * jitter)
        .attr("cy", (d: any) => d.y + (Math.random() - 0.5) * jitter);
      labels
        .attr("x", (d: any) => d.x + (Math.random() - 0.5) * jitter)
        .attr("y", (d: any) => d.y + (Math.random() - 0.5) * jitter);
    });

    function drag(simulation: d3.Simulation<SimulationNode, undefined>) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    return () => {
      simulation.stop();
    };

  }, [simulationNodes, simulationLinks, trauma, hope]); // Only re-run if topology or key metrics change

  return (
    <div className={`w-full h-full min-h-[300px] flex flex-col bg-forge-black border border-stone-800 rounded-sm relative transition-all duration-500 ${trauma > 80 ? 'border-forge-crimson/30' : ''}`}>
       <div className="absolute top-2 left-2 text-xs font-mono text-forge-subtle tracking-widest z-10 pointer-events-none">
        RELATION_MATRIX_V4 {trauma > 90 && <span className="text-red-600 animate-pulse">:: UNSTABLE</span>}
      </div>
      <svg ref={svgRef} className="w-full flex-1" />
      
      {/* Code Execution Overlay */}
      {executedCode && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-2 border-t border-stone-800 max-h-24 overflow-y-auto">
           <div className="font-mono text-[9px] text-green-500 mb-1">$ executing_graph_logic.py</div>
           <pre className="font-mono text-[8px] text-stone-400 whitespace-pre-wrap">{executedCode}</pre>
        </div>
      )}
    </div>
  );
};

export default NetworkGraph;
