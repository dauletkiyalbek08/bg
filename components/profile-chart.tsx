"use client";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { scales, labels } from "@/lib/content";
export default function Chart({
  scores,
  family,
}: {
  scores: Record<string, number>;
  family: "riasec" | "klimov";
}) {
  const data = scales[family].map((key) => ({
    name: labels[key],
    value: Math.round(scores[key]),
    max: 100,
  }));
  return (
    <>
      <div className="radar-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data} outerRadius="65%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "var(--muted)" }}
            />
            <Radar
              name="Қызығушылықтар"
              dataKey="max"
              stroke="transparent"
              fill="transparent"
            />
            <Radar
              name="Сенің жауаптарың"
              dataKey="value"
              stroke="#6C3BFF"
              fill="#6C3BFF"
              fillOpacity={0.2}
              strokeWidth={2.5}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-details">
        <summary>Сандармен көру</summary>
        <dl>
          {data.map((d) => (
            <div key={d.name}>
              <dt>{d.name}</dt>
              <dd>{d.value} / 100</dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  );
}
