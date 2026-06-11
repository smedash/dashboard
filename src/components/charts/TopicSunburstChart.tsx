"use client";

import { useMemo, useState, useCallback, useRef, ReactElement } from "react";

interface TopicNode {
  label: string;
  children: TopicNode[];
}

interface TopicSunburstChartProps {
  data: TopicNode;
  width?: number;
  height?: number;
}

const DEPTH_COLORS = [
  { fill: "#3b82f6", hover: "#60a5fa" },
  { fill: "#10b981", hover: "#34d399" },
  { fill: "#f59e0b", hover: "#fbbf24" },
  { fill: "#8b5cf6", hover: "#a78bfa" },
  { fill: "#ef4444", hover: "#f87171" },
  { fill: "#06b6d4", hover: "#22d3ee" },
];

function countLeaves(node: TopicNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

export function TopicSunburstChart({ data, width = 700, height = 700 }: TopicSunburstChartProps) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    setMousePos({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    });
  }, [width, height]);

  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) / 2 - 30;

  const maxDepth = useMemo(() => {
    function getDepth(node: TopicNode, d: number): number {
      if (!node.children || node.children.length === 0) return d;
      return Math.max(...node.children.map((c) => getDepth(c, d + 1)));
    }
    return getDepth(data, 0);
  }, [data]);

  const centerRadius = maxRadius * 0.12;
  const ringWidth = (maxRadius - centerRadius) / Math.max(maxDepth, 1);

  const calculatePath = useCallback(
    (startAngle: number, endAngle: number, innerR: number, outerR: number): string => {
      const gap = 0.005;
      const sa = startAngle + gap;
      const ea = endAngle - gap;
      if (ea <= sa) return "";

      const x1 = centerX + innerR * Math.cos(sa);
      const y1 = centerY + innerR * Math.sin(sa);
      const x2 = centerX + outerR * Math.cos(sa);
      const y2 = centerY + outerR * Math.sin(sa);
      const x3 = centerX + outerR * Math.cos(ea);
      const y3 = centerY + outerR * Math.sin(ea);
      const x4 = centerX + innerR * Math.cos(ea);
      const y4 = centerY + innerR * Math.sin(ea);
      const largeArc = ea - sa > Math.PI ? 1 : 0;

      return [
        `M ${x1} ${y1}`,
        `L ${x2} ${y2}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x3} ${y3}`,
        `L ${x4} ${y4}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1} ${y1}`,
        "Z",
      ].join(" ");
    },
    [centerX, centerY]
  );

  const segments = useMemo(() => {
    const result: ReactElement[] = [];
    const totalLeaves = countLeaves(data);
    if (totalLeaves === 0) return result;

    function render(node: TopicNode, depth: number, startAngle: number, angleSpan: number) {
      if (!node.children || node.children.length === 0) return;

      const innerR = centerRadius + depth * ringWidth;
      const outerR = centerRadius + (depth + 1) * ringWidth;
      const color = DEPTH_COLORS[depth % DEPTH_COLORS.length];
      let currentAngle = startAngle;

      node.children.forEach((child, i) => {
        const leaves = countLeaves(child);
        const childAngle = (leaves / totalLeaves) * (2 * Math.PI);
        const key = `${depth}-${i}-${startAngle.toFixed(4)}`;
        const midAngle = currentAngle + childAngle / 2;
        const path = calculatePath(currentAngle, currentAngle + childAngle, innerR, outerR);

        if (path) {
          const textR = (innerR + outerR) / 2;
          const textX = centerX + textR * Math.cos(midAngle);
          const textY = centerY + textR * Math.sin(midAngle);
          const rotDeg = (midAngle * 180) / Math.PI;
          const flip = rotDeg > 90 && rotDeg < 270;
          const textRotation = flip ? rotDeg + 180 : rotDeg;
          const arcLength = childAngle * textR;
          const segmentWidth = outerR - innerR;
          const maxChars = Math.floor(segmentWidth / 7);
          const fontSize = Math.max(9, Math.min(13, segmentWidth / 6));

          result.push(
            <g key={key}>
              <path
                d={path}
                fill={hoveredLabel === child.label ? color.hover : color.fill}
                stroke="#1e293b"
                strokeWidth={1}
                opacity={hoveredLabel && hoveredLabel !== child.label ? 0.5 : 0.85}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoveredLabel(child.label)}
                onMouseLeave={() => setHoveredLabel(null)}
              />
              {arcLength > 20 && maxChars >= 3 && (
                <text
                  x={textX}
                  y={textY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize={fontSize}
                  fontWeight={depth === 0 ? "bold" : "normal"}
                  className="pointer-events-none"
                  style={{ textShadow: "1px 1px 3px rgba(0,0,0,1), -1px -1px 3px rgba(0,0,0,1)" }}
                  transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                >
                  {child.label.length > maxChars
                    ? child.label.slice(0, maxChars - 1) + "…"
                    : child.label}
                </text>
              )}
            </g>
          );
        }

        render(child, depth + 1, currentAngle, childAngle);
        currentAngle += childAngle;
      });
    }

    render(data, 0, -Math.PI / 2, 2 * Math.PI);
    return result;
  }, [data, centerRadius, ringWidth, calculatePath, centerX, centerY, hoveredLabel]);

  return (
    <div className="flex justify-center">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="overflow-visible"
        onMouseMove={handleMouseMove}
      >
        {segments}

        {/* Zentrum */}
        <circle cx={centerX} cy={centerY} r={centerRadius} fill="#1e293b" stroke="#334155" strokeWidth={2} />
        <text
          x={centerX}
          y={centerY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={Math.max(10, Math.min(14, centerRadius / 3))}
          fontWeight="bold"
        >
          {data.label.length > 15 ? data.label.slice(0, 13) + "…" : data.label}
        </text>

        {/* Tooltip */}
        {hoveredLabel && (() => {
          const tooltipWidth = Math.min(250, hoveredLabel.length * 9 + 40);
          const tooltipHeight = 36;
          let tx = mousePos.x + 15;
          let ty = mousePos.y - tooltipHeight / 2;
          if (tx + tooltipWidth > width - 10) tx = mousePos.x - tooltipWidth - 15;
          if (tx < 10) tx = 10;
          if (ty < 10) ty = 10;
          if (ty + tooltipHeight > height - 10) ty = height - tooltipHeight - 10;

          return (
            <g style={{ pointerEvents: "none" }}>
              <rect
                x={tx}
                y={ty}
                width={tooltipWidth}
                height={tooltipHeight}
                fill="#1e293b"
                stroke="#334155"
                strokeWidth={2}
                rx={6}
                opacity={0.95}
              />
              <text
                x={tx + tooltipWidth / 2}
                y={ty + tooltipHeight / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize={12}
                fontWeight="bold"
              >
                {hoveredLabel}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
