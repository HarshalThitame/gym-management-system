# CinematicMetricsGrid Component

## Overview

A responsive grid component for displaying animated metric cards with glassmorphic styling, trend indicators, and sparkline charts. Perfect for dashboard overview sections showing key performance indicators (KPIs).

## Features

- ✅ Responsive grid layout (4 columns desktop, 2 tablet, 1 mobile)
- ✅ Glassmorphic card design with backdrop blur and gradient borders
- ✅ Animated trend indicators with color-coded arrows (green/red)
- ✅ Mini sparkline charts with gradient fill animation
- ✅ Gradient accent bars with animated fill on card bottom
- ✅ Staggered entrance animations (0.1s between items)
- ✅ Hover effects with scale (1.05) and glow transitions (0.3s)
- ✅ Icon backgrounds with gradient overlays
- ✅ Full TypeScript support with comprehensive types

## Animation Specifications

- **List Entrance**: Staggered cascade with 0.1s delay between items
- **Card Hover**: Scale 1.05 with spring physics (stiffness: 300) and enhanced shadow
- **Accent Bar**: Fill animation on mount (1.5s, easeOut)
- **Sparkline**: Draw animation on mount (1s, easeInOut)

## Components

### CinematicStatCard

Individual stat card component that displays:
- Icon with gradient background
- Metric label (small uppercase)
- Large value number
- Trend indicator (arrow + percentage)
- Sparkline chart
- Gradient accent bar

### CinematicMetricsGrid

Container component that arranges stat cards in a responsive grid with staggered animations.

## Usage Example

```tsx
'use client';

import { DollarSign, Users, Activity } from 'lucide-react';
import { CinematicMetricsGrid } from '@/features/organization-owner/components/dashboard';

export default function DashboardPage() {
  const metricsData = [
    {
      icon: DollarSign,
      label: "Total Revenue",
      value: "$48,500",
      trend: { value: 12.5, isPositive: true },
      gradient: { from: "from-blue-500", to: "to-cyan-500" },
      accentColor: "bg-blue-500",
      sparklineData: [20, 35, 30, 45, 40, 55, 50],
    },
    {
      icon: Users,
      label: "Active Members",
      value: "2,847",
      trend: { value: 8.2, isPositive: true },
      gradient: { from: "from-purple-500", to: "to-pink-500" },
      accentColor: "bg-purple-500",
      sparklineData: [25, 32, 28, 42, 38, 52, 48],
    },
    {
      icon: Activity,
      label: "Check-Ins",
      value: "15,234",
      trend: { value: 5.1, isPositive: true },
      gradient: { from: "from-green-500", to: "to-emerald-500" },
      accentColor: "bg-green-500",
      sparklineData: [18, 30, 25, 40, 35, 50, 45],
    },
  ];

  return (
    <div className="space-y-8 p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Dashboard Metrics</h1>
        <p className="text-white/60">Real-time metrics with animated cards</p>
      </div>

      <CinematicMetricsGrid metrics={metricsData} className="w-full" />
    </div>
  );
}
```

## Props

### CinematicMetricsGrid

```typescript
interface CinematicMetricsGridProps {
  metrics: CinematicStatCardProps[];
  className?: string;
}
```

### CinematicStatCard

```typescript
interface CinematicStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  gradient?: {
    from: string;
    to: string;
  };
  accentColor?: string;
  sparklineData?: number[];
}
```

## Props Description

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `LucideIcon` | Required | Lucide icon component for the card |
| `label` | `string` | Required | Uppercase metric label |
| `value` | `string \| number` | Required | Main value to display |
| `trend` | `{value: number; isPositive: boolean}` | Optional | Trend indicator with direction |
| `gradient` | `{from: string; to: string}` | `{from: "from-blue-500", to: "to-purple-500"}` | Tailwind gradient classes |
| `accentColor` | `string` | `"bg-purple-500"` | Background color for accent bar |
| `sparklineData` | `number[]` | `[20, 40, 30, 50, 45, 60, 55]` | Data points for sparkline |
| `className` | `string` | `''` | Additional CSS classes for grid |

## Card Styling

### Default State
```css
backdrop-blur-xl
bg-white/5
border border-white/20
rounded-2xl
transition-all duration-300
```

### Hover State
```css
scale: 1.05
bg-white/10
border-purple-500/40
shadow: enhanced glow
```

### Icon Background
```css
bg-gradient-to-br
{gradient.from} {gradient.to}
bg-opacity-20
group-hover:bg-opacity-30
rounded-xl
```

### Trend Indicator Colors
- **Positive**: `text-green-400` with `bg-green-500/10` background
- **Negative**: `text-red-400` with `bg-red-500/10` background

## Responsive Behavior

| Breakpoint | Columns | Gap | Font Size |
|------------|---------|-----|-----------|
| Mobile | 1 | 1rem | sm |
| Tablet (md) | 2 | 1rem | base |
| Desktop (lg) | 4 | 1rem | lg |

## Animation Components Used

- `AnimatedContainer`: Stagger container for coordinated animations
- `AnimatedItem`: Individual item with stagger delay
- `motion.div` (Framer Motion): For custom hover and path animations

## Sparkline Chart

The sparkline chart is rendered as SVG with:
- Gradient fill area under the line
- Smooth line stroke with rounded ends
- Draw animation on mount (1s duration)
- Fill area animation synchronized with stroke

```tsx
<svg viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
  {/* Gradient fill area */}
  <motion.path fill={gradient} ... />
  
  {/* Line stroke */}
  <motion.path stroke="rgba(168, 85, 247, 0.8)" ... />
</svg>
```

## Gradient Accent Bar

An animated bar at the bottom of each card:
- Gradient from color defined in `gradient` prop
- Fills from left to right on mount (1.5s)
- Opacity animation from 0 to 1

## Integration with EnterpriseDashboard

This component can be integrated into the EnterpriseDashboard to replace or enhance the existing KPI grid:

```tsx
// In enterprise-dashboard.tsx
import { CinematicMetricsGrid } from '@/features/organization-owner/components/dashboard';

// Convert existing KPI data to CinematicStatCardProps
const metricsData: CinematicStatCardProps[] = [
  {
    icon: CreditCard,
    label: "Revenue",
    value: kpis.revenue.value,
    trend: kpis.revenue.trend,
    // ... other props
  },
  // ... more metrics
];

// Use in render
<CinematicMetricsGrid metrics={metricsData} />
```

## Customization

### Custom Gradients
```tsx
gradient={{ from: "from-cyan-500", to: "to-blue-500" }}
```

### Custom Sparkline Data
```tsx
sparklineData={[10, 15, 12, 20, 18, 25, 22]}
```

### Custom Trend Colors
Modify the trend color logic in `CinematicStatCard`:
```tsx
const trendColor = trendIsPositive 
  ? "text-emerald-400"  // Custom positive color
  : "text-amber-400";   // Custom negative color
```

## Features Ready for Phase 2

✅ Motion components fully integrated
✅ Glassmorphic styling with backdrop blur
✅ Full TypeScript support
✅ Responsive design implemented
✅ Animation timings specified
✅ SVG sparkline charts
✅ Gradient accent bars
✅ Hover effects with glow
✅ Staggered entrance animations
✅ Trend indicators with color coding

## Example Use Cases

1. **Executive Dashboard**: Display company-wide KPIs
2. **Gym Management**: Show member count, revenue, attendance, capacity
3. **Sales Dashboard**: Revenue, deals, pipeline, conversion rate
4. **Analytics Dashboard**: Traffic, engagement, conversion, retention
5. **Health Metrics**: Steps, calories, distance, heart rate

## Performance Considerations

- Cards use CSS transitions for hover effects
- SVG sparklines are optimized with `viewBox` and `preserveAspectRatio`
- Stagger animations use hardware-accelerated `transform` and `opacity`
- Gradient fills use SVG `<defs>` for efficient rendering
- No heavy computations in render path
