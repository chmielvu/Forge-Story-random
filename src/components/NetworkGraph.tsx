
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphLink, CharacterId } from '../types';

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
}

const NetworkGraph: React.FC<Props> = ({ nodes, links }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);

    // CRITICAL FIX: Deep clone data to prevent D3 from mutating React props/state
    // This fixes the "node not found" error on re-renders
    const simulationNodes = JSON.parse(JSON.stringify(nodes));
    const simulationLinks = JSON.parse(JSON.stringify(links));

    // Simulation setup
    const simulation = d3.forceSimulation(simulationNodes)
      .force("link", d3.forceLink(simulationLinks).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(30));

    // Render Links
    const link = svg.append("g")
      .attr("stroke", "#44403c")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(simulationLinks)
      .join("line")
      .attr("stroke-width", (d: any) => Math.sqrt(d.weight) * 1.5);

    // Render Nodes
    const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(simulationNodes)
      .join("circle")
      .attr("r", (d: any) => d.group === 'subject' ? 10 : 15)
      .attr("fill", (d: any) => {
        if (d.id === CharacterId.PLAYER) return "#e7e5e4";
        if (d.group === 'faculty') return "#facc15"; // Gold for Faculty (was Crimson)
        return "#b45309"; // Darker Gold for Prefects
      })
      .call(drag(simulation) as any);

    // Render Labels
    const labels = svg.append("g")
      .selectAll("text")
      .data(simulationNodes)
      .join("text")
      .text((d: any) => d.label)
      .attr("font-size", "10px")
      .attr("fill", "#a8a29e")
      .attr("dx", 18)
      .attr("dy", 4)
      .attr("font-family", "JetBrains Mono");

    // Tooltip for edges (simple)
    link.append("title")
      .text((d: any) => d.relation);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);

      labels
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
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

    // Cleanup function
    return () => {
      simulation.stop();
    };

  }, [nodes, links]);

  return (
    <div className="w-full h-64 bg-black border border-stone-800 rounded-lg relative">
       <div className="absolute top-2 left-2 text-xs font-mono text-forge-subtle tracking-widest z-10 pointer-events-none">
        NETWORKX::RELATION_MATRIX
      </div>
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default NetworkGraph;
