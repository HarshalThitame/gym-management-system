"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function WeightTrendChart({ data }: { data: Array<{ date: string; weight: number | null; bodyFat: number | null; muscleMass: number | null; bmi: number | null }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip />
          <Line dataKey="weight" dot={false} name="Weight kg" stroke="#111315" strokeWidth={2.5} type="monotone" />
          <Line dataKey="bodyFat" dot={false} name="Body fat %" stroke="#d92d20" strokeWidth={2.5} type="monotone" />
          <Line dataKey="muscleMass" dot={false} name="Muscle kg" stroke="#527853" strokeWidth={2.5} type="monotone" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function NutritionMacroChart({ data }: { data: Array<{ date: string; calories: number; protein: number; carbs: number; fat: number; water: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip />
          <Bar dataKey="protein" fill="#111315" name="Protein g" radius={[6, 6, 0, 0]} />
          <Bar dataKey="carbs" fill="#527853" name="Carbs g" radius={[6, 6, 0, 0]} />
          <Bar dataKey="fat" fill="#d2a85a" name="Fat g" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WorkoutAdherenceChart({ data }: { data: Array<{ week: string; planned: number; completed: number; skipped: number; adherenceRate: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} tickLine={false} />
          <Tooltip formatter={(value, name) => [name === "adherenceRate" ? `${value}%` : value, name === "adherenceRate" ? "Adherence" : name]} />
          <Area dataKey="adherenceRate" fill="#eef1ea" stroke="#111315" strokeWidth={2.5} type="monotone" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
