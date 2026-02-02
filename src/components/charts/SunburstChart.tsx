"use client";

import { useMemo, useState, ReactElement, forwardRef, useImperativeHandle, useRef, useCallback } from "react";

interface SunburstData {
  name: string;
  value: number;
  children?: SunburstData[];
  score?: number;
  priority?: string | null;
  teams?: Array<{
    id: string;
    team: {
      id: string;
      name: string;
    };
  }>;
}

interface SunburstChartProps {
  data: SunburstData[];
  width?: number;
  height?: number;
}

export interface SunburstChartRef {
  exportToPng: (filename?: string) => void;
}

// Farben basierend auf Score
const getColor = (score: number): string => {
  if (score <= 3) return "#ef4444"; // Rot - unausgereift
  if (score <= 5) return "#f59e0b"; // Orange - wenig ausgereift
  if (score <= 7) return "#3b82f6"; // Blau - ausgereift
  return "#10b981"; // Grün - vollständig ausgereift
};

// Helle Variante für Hover
const getLightColor = (score: number): string => {
  if (score <= 3) return "#f87171"; // Hellrot
  if (score <= 5) return "#fbbf24"; // Hellorange
  if (score <= 7) return "#60a5fa"; // Hellblau
  return "#34d399"; // Hellgrün
};

// Farben für Priorität - Weiß und Dunkelgrau statt Ampelsystem
const getPriorityColor = (priority: string | null | undefined): string => {
  if (!priority) return "#475569"; // Dunkelgrau für keine Priorität
  switch (priority.toUpperCase()) {
    case "A":
      return "#ffffff"; // Weiß für höchste Priorität
    case "B":
      return "#e2e8f0"; // Hellgrau
    case "C":
      return "#cbd5e1"; // Mittelgrau
    case "D":
      return "#94a3b8"; // Dunkleres Grau
    default:
      return "#475569"; // Dunkelgrau
  }
};

// Textfarbe für Priorität basierend auf Hintergrundfarbe
const getPriorityTextColor = (priority: string | null | undefined): string => {
  if (!priority) return "#ffffff"; // Weiß auf dunkelgrau
  switch (priority.toUpperCase()) {
    case "A":
      return "#1e293b"; // Dunkelgrau auf weiß
    case "B":
      return "#1e293b"; // Dunkelgrau auf hellgrau
    case "C":
      return "#1e293b"; // Dunkelgrau auf mittelgrau
    case "D":
      return "#ffffff"; // Weiß auf dunklerem grau
    default:
      return "#ffffff";
  }
};

export const SunburstChart = forwardRef<SunburstChartRef, SunburstChartProps>(
  function SunburstChart({ data, width = 1200, height = 1200 }, ref) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [hoveredPriority, setHoveredPriority] = useState<string | null>(null);
  const [hoveredTeams, setHoveredTeams] = useState<Array<{ id: string; name: string }> | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Mouse-Position tracken relativ zum SVG
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

  // Export-Funktion für PNG
  const exportToPng = useCallback((filename: string = "seo-reifegrad-chart.png") => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    
    // SVG-Daten für bessere Kompatibilität aufbereiten
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      // Canvas mit höherer Auflösung für bessere Qualität
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        // Hintergrund zeichnen
        ctx.fillStyle = "#0f172a"; // slate-900 Hintergrund
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // SVG skaliert zeichnen
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        
        // Als PNG herunterladen
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      
      URL.revokeObjectURL(url);
    };
    
    img.src = url;
  }, [width, height]);

  // Ref-Methoden exponieren
  useImperativeHandle(ref, () => ({
    exportToPng,
  }), [exportToPng]);

  // Die Daten sollten bereits in der richtigen hierarchischen Struktur vorliegen
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Wenn die Daten bereits children haben, verwende sie direkt
    if (data[0]?.children) {
      return data;
    }
    
    // Sonst transformiere die Daten
    const categories = new Map<string, SunburstData>();
    
    data.forEach((item) => {
      const category = item.name.split(":")[0] || "Allgemein";
      if (!categories.has(category)) {
        categories.set(category, {
          name: category,
          value: 0,
          children: [],
        });
      }
      const cat = categories.get(category)!;
      cat.children!.push(item);
      cat.value += item.value || item.score || 0;
    });

    return Array.from(categories.values());
  }, [data]);

  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) / 2 - 40;
  
  // Ring-Radien definieren
  const centerRadius = maxRadius * 0.12; // Zentrum
  const categoryInnerRadius = maxRadius * 0.15; // Kategorien innerer Radius
  const categoryOuterRadius = maxRadius * 0.50; // Kategorien äußerer Radius
  const itemInnerRadius = maxRadius * 0.50; // Items innerer Radius
  const itemOuterRadius = maxRadius * 0.90; // Items äußerer Radius (reduziert für Prioritäts-Ring)
  const priorityInnerRadius = maxRadius * 0.90; // Prioritäten innerer Radius
  const priorityOuterRadius = maxRadius * 0.98; // Prioritäten äußerer Radius

  // Berechne Winkel für jeden Segment
  const calculatePath = (
    startAngle: number,
    endAngle: number,
    innerRadius: number,
    outerRadius: number
  ): string => {
    const startX = centerX + innerRadius * Math.cos(startAngle);
    const startY = centerY + innerRadius * Math.sin(startAngle);
    const endX = centerX + outerRadius * Math.cos(endAngle);
    const endY = centerY + outerRadius * Math.sin(endAngle);
    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

    return [
      `M ${centerX + innerRadius * Math.cos(startAngle)} ${centerY + innerRadius * Math.sin(startAngle)}`,
      `L ${centerX + outerRadius * Math.cos(startAngle)} ${centerY + outerRadius * Math.sin(startAngle)}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      `L ${centerX + innerRadius * Math.cos(endAngle)} ${centerY + innerRadius * Math.sin(endAngle)}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${startX} ${startY}`,
      "Z",
    ].join(" ");
  };

  // Render Kategorien (Ring 1)
  const renderCategories = (categories: SunburstData[]): ReactElement[] => {
    const segments: ReactElement[] = [];
    let currentAngle = -Math.PI / 2;
    const totalItems = categories.reduce((sum, cat) => sum + (cat.children?.length || 0), 0);

    if (totalItems === 0) return segments;

    categories.forEach((category, catIndex) => {
      const itemCount = category.children?.length || 0;
      const angle = (itemCount / totalItems) * (2 * Math.PI);
      const endAngle = currentAngle + angle;
      const midAngle = currentAngle + angle / 2;

      // Durchschnittlicher Score der Kategorie
      const avgScore = category.children
        ? category.children.reduce((sum, item) => sum + (item.score || item.value || 0), 0) / category.children.length
        : 0;
      const color = getColor(avgScore);
      
      const path = calculatePath(currentAngle, endAngle, categoryInnerRadius, categoryOuterRadius);

      segments.push(
        <g key={`category-${catIndex}-${category.name}`}>
          <path
            d={path}
            fill={color}
            stroke="#1e293b"
            strokeWidth={2}
            opacity={0.8}
            className="transition-opacity cursor-pointer"
            onMouseEnter={() => {
              setHoveredItem(`category-${category.name}`);
              setHoveredScore(Math.round(avgScore * 10) / 10);
              setHoveredPriority(null);
              setHoveredTeams(null);
            }}
            onMouseLeave={() => {
              setHoveredItem(null);
              setHoveredScore(null);
              setHoveredPriority(null);
              setHoveredTeams(null);
            }}
          />
          {angle > 0.05 && (
            <text
              x={centerX + (categoryInnerRadius + categoryOuterRadius) / 2 * Math.cos(midAngle)}
              y={centerY + (categoryInnerRadius + categoryOuterRadius) / 2 * Math.sin(midAngle)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              fontSize={Math.max(10, Math.min(13, angle * 50))}
              fontWeight="bold"
              className="pointer-events-none"
              style={{
                textShadow: "1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8)",
              }}
              transform={`rotate(${(midAngle * 180) / Math.PI}, ${centerX + (categoryInnerRadius + categoryOuterRadius) / 2 * Math.cos(midAngle)}, ${centerY + (categoryInnerRadius + categoryOuterRadius) / 2 * Math.sin(midAngle)})`}
            >
              {category.name}
            </text>
          )}
        </g>
      );

      currentAngle = endAngle;
    });

    return segments;
  };

  // Render Items strahlenförmig (Ring 2)
  const renderItems = (categories: SunburstData[]): ReactElement[] => {
    const segments: ReactElement[] = [];
    let categoryStartAngle = -Math.PI / 2;
    const totalItems = categories.reduce((sum, cat) => sum + (cat.children?.length || 0), 0);

    if (totalItems === 0) return segments;

    categories.forEach((category, catIndex) => {
      const items = category.children || [];
      const categoryItemCount = items.length;
      const categoryAngle = (categoryItemCount / totalItems) * (2 * Math.PI);
      const categoryEndAngle = categoryStartAngle + categoryAngle;

      // Items innerhalb dieser Kategorie
      items.forEach((item, itemIndex) => {
        const itemAngle = categoryAngle / categoryItemCount;
        const itemStartAngle = categoryStartAngle + (itemIndex * itemAngle);
        const itemEndAngle = itemStartAngle + itemAngle;
        const itemMidAngle = itemStartAngle + itemAngle / 2;

        const score = item.score !== undefined ? item.score : item.value || 0;
        const priority = item.priority || null;
        const color = getColor(score);
        const itemKey = `item-${category.name}-${item.name}`;
        const isHovered = hoveredItem === itemKey || 
                         hoveredItem === `category-${category.name}`;
        
        const path = calculatePath(itemStartAngle, itemEndAngle, itemInnerRadius, itemOuterRadius);

        segments.push(
          <g key={`item-${catIndex}-${itemIndex}-${item.name}`}>
            <path
              d={path}
              fill={color}
              stroke="#1e293b"
              strokeWidth={1}
              opacity={isHovered ? 1 : 0.85}
            className="transition-all cursor-pointer"
            onMouseEnter={() => {
              setHoveredItem(itemKey);
              setHoveredScore(score);
              setHoveredPriority(priority);
              setHoveredTeams(item.teams?.map(t => t.team) || null);
            }}
            onMouseLeave={() => {
              setHoveredItem(null);
              setHoveredScore(null);
              setHoveredPriority(null);
              setHoveredTeams(null);
            }}
            />
            {/* Item Text und Score */}
            {itemAngle > 0.01 && (
              <>
                {/* Text - rotiert entlang des Strahls */}
                <text
                  x={centerX + (itemInnerRadius + itemOuterRadius) / 2 * Math.cos(itemMidAngle)}
                  y={centerY + (itemInnerRadius + itemOuterRadius) / 2 * Math.sin(itemMidAngle)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize={Math.max(7, Math.min(10, itemAngle * 200))}
                  fontWeight="normal"
                  className="pointer-events-none"
                  style={{
                    textShadow: "1px 1px 3px rgba(0,0,0,0.9), -1px -1px 3px rgba(0,0,0,0.9)",
                  }}
                  transform={`rotate(${(itemMidAngle * 180) / Math.PI}, ${centerX + (itemInnerRadius + itemOuterRadius) / 2 * Math.cos(itemMidAngle)}, ${centerY + (itemInnerRadius + itemOuterRadius) / 2 * Math.sin(itemMidAngle)})`}
                >
                  {(() => {
                    const maxLength = Math.floor(itemAngle * 400);
                    return item.name.length > maxLength
                      ? item.name.substring(0, maxLength - 3) + "..."
                      : item.name;
                  })()}
                </text>
                {/* Score Badge - am äußersten Rand des Strahls mit 5px Padding zum äußeren Ring */}
                {itemAngle > 0.02 && (
                  <>
                    <circle
                      cx={centerX + (itemOuterRadius - 13) * Math.cos(itemMidAngle)}
                      cy={centerY + (itemOuterRadius - 13) * Math.sin(itemMidAngle)}
                      r={8}
                      fill="#1e293b"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      opacity={0.95}
                      className="pointer-events-none"
                    />
                    <text
                      x={centerX + (itemOuterRadius - 13) * Math.cos(itemMidAngle)}
                      y={centerY + (itemOuterRadius - 13) * Math.sin(itemMidAngle)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#ffffff"
                      fontSize={9}
                      fontWeight="bold"
                      className="pointer-events-none"
                    >
                      {score}
                    </text>
                  </>
                )}
              </>
            )}
          </g>
        );
      });

      categoryStartAngle = categoryEndAngle;
    });

    return segments;
  };

  // Render Prioritäten Ring (außen)
  const renderPriorities = (categories: SunburstData[]): ReactElement[] => {
    const segments: ReactElement[] = [];
    let categoryStartAngle = -Math.PI / 2;
    const totalItems = categories.reduce((sum, cat) => sum + (cat.children?.length || 0), 0);

    if (totalItems === 0) return segments;

    categories.forEach((category, catIndex) => {
      const items = category.children || [];
      const categoryItemCount = items.length;
      const categoryAngle = (categoryItemCount / totalItems) * (2 * Math.PI);
      const categoryEndAngle = categoryStartAngle + categoryAngle;

      // Items innerhalb dieser Kategorie
      items.forEach((item, itemIndex) => {
        const itemAngle = categoryAngle / categoryItemCount;
        const itemStartAngle = categoryStartAngle + (itemIndex * itemAngle);
        const itemEndAngle = itemStartAngle + itemAngle;
        const itemMidAngle = itemStartAngle + itemAngle / 2;

        const priority = item.priority || null;
        const score = item.score !== undefined ? item.score : item.value || 0;
        
        // Nur rendern wenn Priorität vorhanden
        if (priority && itemAngle > 0.01) {
          const priorityPath = calculatePath(itemStartAngle, itemEndAngle, priorityInnerRadius, priorityOuterRadius);
          const itemKey = `item-${category.name}-${item.name}`;
          const isHovered = hoveredItem === itemKey;
          
          segments.push(
            <g key={`priority-${catIndex}-${itemIndex}-${item.name}`}>
              <path
                d={priorityPath}
                fill={getPriorityColor(priority)}
                stroke="#1e293b"
                strokeWidth={1}
                opacity={isHovered ? 1 : 0.9}
                className="transition-opacity cursor-pointer"
                onMouseEnter={() => {
                  setHoveredItem(itemKey);
                  setHoveredScore(score);
                  setHoveredPriority(priority);
                  setHoveredTeams(item.teams?.map(t => t.team) || null);
                }}
                onMouseLeave={() => {
                  setHoveredItem(null);
                  setHoveredScore(null);
                  setHoveredPriority(null);
                  setHoveredTeams(null);
                }}
              />
              {/* Prioritäts-Badge */}
              {itemAngle > 0.02 && (
                <>
                  <circle
                    cx={centerX + (priorityInnerRadius + priorityOuterRadius) / 2 * Math.cos(itemMidAngle)}
                    cy={centerY + (priorityInnerRadius + priorityOuterRadius) / 2 * Math.sin(itemMidAngle)}
                    r={12}
                    fill={getPriorityColor(priority)}
                    stroke="#1e293b"
                    strokeWidth={2}
                    opacity={0.95}
                    className="pointer-events-none"
                  />
                  <text
                    x={centerX + (priorityInnerRadius + priorityOuterRadius) / 2 * Math.cos(itemMidAngle)}
                    y={centerY + (priorityInnerRadius + priorityOuterRadius) / 2 * Math.sin(itemMidAngle)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={getPriorityTextColor(priority)}
                    fontSize={12}
                    fontWeight="bold"
                    className="pointer-events-none"
                  >
                    {priority.toUpperCase()}
                  </text>
                </>
              )}
            </g>
          );
        }
      });

      categoryStartAngle = categoryEndAngle;
    });

    return segments;
  };

  if (processedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        Keine Daten verfügbar
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <svg ref={svgRef} width={width} height={height} className="overflow-visible" style={{ overflow: "visible" }} onMouseMove={handleMouseMove}>
        {/* Prioritäten Ring (ganz außen) */}
        <g>{renderPriorities(processedData)}</g>
        {/* Items Ring */}
        <g>{renderItems(processedData)}</g>
        {/* Kategorien Ring (innen) */}
        <g>{renderCategories(processedData)}</g>
        {/* Zentrum */}
        <circle
          cx={centerX}
          cy={centerY}
          r={centerRadius}
          fill="#1e293b"
          stroke="#334155"
          strokeWidth={3}
        />
        <text
          x={centerX}
          y={centerY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={18}
          fontWeight="bold"
        >
          SEO
        </text>
        {/* Tooltip für gehoverte Items - folgt der Mausposition */}
        {hoveredItem && (() => {
          const isCategory = hoveredItem.startsWith("category-");
          // Item-Key Format: "item-KategorieName-ItemName" - nur den ItemName extrahieren
          let displayText: string;
          if (isCategory) {
            displayText = hoveredItem.replace("category-", "");
          } else {
            // Entferne "item-" Prefix und dann den ersten Teil bis zum ersten "-" (Kategorienamen)
            const withoutPrefix = hoveredItem.replace("item-", "");
            const firstDashIndex = withoutPrefix.indexOf("-");
            displayText = firstDashIndex >= 0 
              ? withoutPrefix.substring(firstDashIndex + 1) 
              : withoutPrefix;
          }
          
          // Text in Zeilen aufteilen (max 35 Zeichen pro Zeile)
          const wrapText = (text: string, maxWidth: number): string[] => {
            const words = text.split(" ");
            const lines: string[] = [];
            let currentLine = "";
            
            for (const word of words) {
              if (currentLine.length === 0) {
                currentLine = word;
              } else if (currentLine.length + 1 + word.length <= maxWidth) {
                currentLine += " " + word;
              } else {
                lines.push(currentLine);
                currentLine = word;
              }
            }
            if (currentLine.length > 0) {
              lines.push(currentLine);
            }
            return lines;
          };
          
          const textLines = wrapText(displayText, 35);
          
          // Tooltip-Dimensionen
          const tooltipWidth = 260;
          const paddingTop = 25;
          const textLineHeight = 18;
          const textBlockHeight = textLines.length * textLineHeight;
          const separatorGap = 20;
          const scoreLineHeight = 22;
          const priorityLineHeight = hoveredPriority ? 22 : 0;
          const teamsHeaderHeight = hoveredTeams && hoveredTeams.length > 0 ? 30 : 0;
          const teamsListHeight = hoveredTeams && hoveredTeams.length > 0 ? hoveredTeams.length * 18 : 0;
          const tooltipHeight = paddingTop + textBlockHeight + separatorGap + scoreLineHeight + priorityLineHeight + teamsHeaderHeight + teamsListHeight + 15;
          
          // Intelligente Positionierung: Tooltip erscheint neben der Maus
          const offset = 15; // Abstand zur Maus
          let tooltipX = mousePos.x + offset;
          let tooltipY = mousePos.y - tooltipHeight / 2;
          
          // Wenn Tooltip rechts nicht passt, links anzeigen
          if (tooltipX + tooltipWidth > width - 10) {
            tooltipX = mousePos.x - tooltipWidth - offset;
          }
          // Wenn links auch nicht passt, mindestens bei 10 starten
          if (tooltipX < 10) {
            tooltipX = 10;
          }
          
          // Vertikale Begrenzung
          if (tooltipY < 10) {
            tooltipY = 10;
          }
          if (tooltipY + tooltipHeight > height - 10) {
            tooltipY = height - tooltipHeight - 10;
          }
          
          // Relative Positionen innerhalb des Tooltips
          const textStartY = tooltipY + paddingTop;
          const separatorY = textStartY + textBlockHeight + 10;
          const scoreY = separatorY + 18;
          const priorityY = scoreY + 22;
          const teamsY = hoveredPriority ? priorityY + 22 : scoreY + 22;
          
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect
                x={tooltipX}
                y={tooltipY}
                width={tooltipWidth}
                height={tooltipHeight}
                fill="#1e293b"
                stroke="#334155"
                strokeWidth={2}
                rx={8}
                opacity={0.95}
              />
              {textLines.map((line, idx) => (
                <text
                  key={idx}
                  x={tooltipX + tooltipWidth / 2}
                  y={textStartY + idx * textLineHeight}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={isCategory ? 13 : 11}
                  fontWeight={isCategory ? "bold" : "normal"}
                >
                  {line}
                </text>
              ))}
              {/* Bewertungszahl und Priorität */}
              {hoveredScore !== null && (
                <>
                  <line
                    x1={tooltipX + 20}
                    y1={separatorY}
                    x2={tooltipX + tooltipWidth - 20}
                    y2={separatorY}
                    stroke="#334155"
                    strokeWidth={1}
                  />
                  {/* Farbindikator für Score */}
                  <circle
                    cx={tooltipX + 35}
                    cy={scoreY}
                    r={6}
                    fill={getColor(hoveredScore)}
                  />
                  <text
                    x={tooltipX + tooltipWidth / 2}
                    y={scoreY + 4}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={12}
                    fontWeight="bold"
                  >
                    Bewertung: {hoveredScore.toFixed(1)} / 10
                  </text>
                  {/* Priorität */}
                  {hoveredPriority && (
                    <>
                      <circle
                        cx={tooltipX + 35}
                        cy={priorityY}
                        r={6}
                        fill={getPriorityColor(hoveredPriority)}
                      />
                      <text
                        x={tooltipX + tooltipWidth / 2}
                        y={priorityY + 4}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={12}
                        fontWeight="bold"
                      >
                        Priorität: {hoveredPriority.toUpperCase()}
                      </text>
                    </>
                  )}
                  {/* Teams / Involvement */}
                  {hoveredTeams && hoveredTeams.length > 0 && (
                    <>
                      <line
                        x1={tooltipX + 20}
                        y1={teamsY - 10}
                        x2={tooltipX + tooltipWidth - 20}
                        y2={teamsY - 10}
                        stroke="#334155"
                        strokeWidth={1}
                      />
                      <text
                        x={tooltipX + tooltipWidth / 2}
                        y={teamsY + 4}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize={11}
                        fontWeight="bold"
                      >
                        Zuständige Teams:
                      </text>
                      {hoveredTeams.map((team, idx) => (
                        <text
                          key={team.id}
                          x={tooltipX + tooltipWidth / 2}
                          y={teamsY + 20 + (idx * 18)}
                          textAnchor="middle"
                          fill="#cbd5e1"
                          fontSize={11}
                        >
                          • {team.name}
                        </text>
                      ))}
                    </>
                  )}
                </>
              )}
            </g>
          );
        })()}
      </svg>
      {/* Legende */}
      <div className="flex flex-col gap-3 mt-4">
        <div className="flex gap-4 flex-wrap justify-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span className="text-sm text-slate-300">1-3: Unausgereift</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500"></div>
            <span className="text-sm text-slate-300">4-5: Wenig ausgereift</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500"></div>
            <span className="text-sm text-slate-300">6-7: Ausgereift</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-sm text-slate-300">8-10: Vollständig ausgereift</span>
          </div>
        </div>
        <div className="flex gap-4 flex-wrap justify-center">
          <span className="text-xs text-slate-400">Priorität:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getPriorityColor("A") }}></div>
            <span className="text-sm text-slate-300">A: Höchste Priorität</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getPriorityColor("B") }}></div>
            <span className="text-sm text-slate-300">B: Hohe Priorität</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getPriorityColor("C") }}></div>
            <span className="text-sm text-slate-300">C: Mittlere Priorität</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getPriorityColor("D") }}></div>
            <span className="text-sm text-slate-300">D: Niedrige Priorität</span>
          </div>
        </div>
      </div>
    </div>
  );
});
