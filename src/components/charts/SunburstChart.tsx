"use client";

import { useMemo, useState, ReactElement } from "react";

interface SunburstData {
  name: string;
  value: number;
  children?: SunburstData[];
  score?: number;
}

interface SunburstChartProps {
  data: SunburstData[];
  width?: number;
  height?: number;
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

export function SunburstChart({ data, width = 1200, height = 1200 }: SunburstChartProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  
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
  const categoryOuterRadius = maxRadius * 0.50; // Kategorien äußerer Radius (noch breiter gemacht)
  const itemInnerRadius = maxRadius * 0.50; // Items innerer Radius
  const itemOuterRadius = maxRadius * 0.98; // Items äußerer Radius

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
            }}
            onMouseLeave={() => {
              setHoveredItem(null);
              setHoveredScore(null);
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
        const color = getColor(score);
        const isHovered = hoveredItem === `item-${category.name}-${item.name}` || 
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
              setHoveredItem(`item-${category.name}-${item.name}`);
              setHoveredScore(score);
            }}
            onMouseLeave={() => {
              setHoveredItem(null);
              setHoveredScore(null);
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
                {/* Score Badge - am äußersten Rand des Strahls */}
                {itemAngle > 0.02 && (
                  <>
                    <circle
                      cx={centerX + (itemOuterRadius - 8) * Math.cos(itemMidAngle)}
                      cy={centerY + (itemOuterRadius - 8) * Math.sin(itemMidAngle)}
                      r={8}
                      fill="#1e293b"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      opacity={0.95}
                      className="pointer-events-none"
                    />
                    <text
                      x={centerX + (itemOuterRadius - 8) * Math.cos(itemMidAngle)}
                      y={centerY + (itemOuterRadius - 8) * Math.sin(itemMidAngle)}
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

  if (processedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        Keine Daten verfügbar
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <svg width={width} height={height} className="overflow-visible" style={{ overflow: "visible" }}>
        {/* Items Ring (außen) */}
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
        {/* Tooltip für gehoverte Items */}
        {hoveredItem && (() => {
          const isCategory = hoveredItem.startsWith("category-");
          const displayText = isCategory 
            ? hoveredItem.replace("category-", "")
            : hoveredItem.replace("item-", "").replace(/-/g, " ");
          const textLines = displayText.length > 40 
            ? [displayText.substring(0, 37) + "...", ""]
            : displayText.split(" ").reduce((acc: string[], word: string) => {
                const lastLine = acc[acc.length - 1] || "";
                if (lastLine.length + word.length + 1 <= 35) {
                  acc[acc.length - 1] = lastLine ? `${lastLine} ${word}` : word;
                } else {
                  acc.push(word);
                }
                return acc;
              }, []);
          
          const tooltipHeight = Math.max(80, 50 + textLines.length * 18);
          
          return (
            <g>
              <rect
                x={width - 280}
                y={20}
                width={260}
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
                  x={width - 150}
                  y={45 + idx * 18}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={isCategory ? 13 : 11}
                  fontWeight={isCategory ? "bold" : "normal"}
                >
                  {line}
                </text>
              ))}
              {/* Bewertungszahl */}
              {hoveredScore !== null && (
                <>
                  <line
                    x1={width - 280 + 20}
                    y1={tooltipHeight - 30}
                    x2={width - 20}
                    y2={tooltipHeight - 30}
                    stroke="#334155"
                    strokeWidth={1}
                  />
                  <text
                    x={width - 150}
                    y={tooltipHeight - 10}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={12}
                    fontWeight="bold"
                  >
                    Bewertung: {hoveredScore.toFixed(1)} / 10
                  </text>
                  {/* Farbindikator */}
                  <circle
                    cx={width - 250}
                    cy={tooltipHeight - 10}
                    r={6}
                    fill={getColor(hoveredScore)}
                  />
                </>
              )}
            </g>
          );
        })()}
      </svg>
      {/* Legende */}
      <div className="flex gap-4 mt-4 flex-wrap justify-center">
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
    </div>
  );
}
