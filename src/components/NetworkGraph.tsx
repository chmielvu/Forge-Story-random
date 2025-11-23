import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphLink, CharacterId, YandereLedger } from '../types';

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  ledger?: YandereLedger; // Made optional for backward compatibility but logic uses it
}

const NetworkGraph: React.FC<Props> = ({ nodes, links, ledger }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Default values if ledger is missing
  const trauma = ledger?.traumaLevel || 0;
  const shame = ledger?.shamePainAbyssLevel || 0;
  const hope = ledger?.hopeLevel || 50;

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);

    // CRITICAL FIX: Deep clone data to prevent D3 from mutating React props/state
    const simulationNodes = JSON.parse(JSON.stringify(nodes));
    const simulationLinks = JSON.parse(JSON.stringify(links));

    // Simulation setup
    const simulation = d3.forceSimulation(simulationNodes)
      .force("link", d3.forceLink(simulationLinks).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(40));

    // --- RENDER LINKS ---
    // Semantic coloring for links
    const getLinkColor = (relation: string) => {
        const r = relation.toLowerCase();
        if (r.includes('hate') || r.includes('hurt') || r.includes('hunt')) return "#ef4444"; // Red
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
    link.append("title").text((d: any) => `${d.source.label} → ${d.target.label}: ${d.relation}`);
    node.append("title").text((d: any) => `${d.label} [Val: ${d.val}]`);

    // --- TICK FUNCTION with TRAUMA JITTER ---
    simulation.on("tick", () => {
      
      // Jitter intensity based on trauma
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

    function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
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

      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    return () => {
      simulation.stop();
    };

  }, [nodes, links, trauma, shame, hope]);

  return (
    <div className={`w-full h-64 bg-black border border-stone-800 rounded-sm relative transition-all duration-500 ${trauma > 80 ? 'border-forge-crimson/30' : ''}`}>
       <div className="absolute top-2 left-2 text-xs font-mono text-forge-subtle tracking-widest z-10 pointer-events-none">
        RELATION_MATRIX_V4 {trauma > 90 && <span className="text-red-600 animate-pulse">:: UNSTABLE</span>}
      </div>
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default NetworkGraph;