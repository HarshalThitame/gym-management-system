# DashboardHeroSection Component

## Overview
A cinematic hero section component for dashboard pages with animated gradient titles, CTA buttons, and smooth entrance animations.

## Features
- ✅ Animated gradient title with `bg-clip-text text-transparent`
- ✅ Subtitle with smooth fade-in animation
- ✅ 2-3 CTA buttons with gradient backgrounds and glow on hover
- ✅ Optional animated background patterns (dots, lines, or none)
- ✅ Full-width responsive design
- ✅ TypeScript with full type safety

## Animation Specifications
- **Title**: Fade-in + slide-up on mount (0.5s)
- **Subtitle**: Fade-in delayed (0.7s total)
- **Buttons**: Cascade entrance with 0.1s stagger starting at 0.9s

## Usage Example

```tsx
'use client';

import DashboardHeroSection from '@/features/organization-owner/components/dashboard/DashboardHeroSection';

export default function DashboardPage() {
  const handleGetStarted = () => {
    console.log('Get Started clicked');
  };

  const handleLearnMore = () => {
    console.log('Learn More clicked');
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeroSection
        title="Welcome to Your Fitness Empire"
        subtitle="Manage your gym operations with advanced analytics, member engagement tools, and comprehensive business insights—all in one powerful platform."
        backgroundPattern="dots"
        ctaButtons={[
          {
            label: 'Get Started',
            onClick: handleGetStarted,
            variant: 'primary',
          },
          {
            label: 'Learn More',
            onClick: handleLearnMore,
            variant: 'secondary',
          },
        ]}
        className="border-b border-border"
      />
      {/* Rest of dashboard content */}
    </div>
  );
}
```

## Props

```typescript
interface DashboardHeroSectionProps {
  title: string;
  subtitle: string;
  ctaButtons?: Array<{
    label: string;
    onClick?: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  backgroundPattern?: 'dots' | 'lines' | 'none';
  className?: string;
}
```

## Props Description

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | Required | Main heading text with gradient effect |
| `subtitle` | `string` | Required | Supporting subtitle text |
| `ctaButtons` | `Array` | `[]` | Array of call-to-action buttons |
| `backgroundPattern` | `'dots' \| 'lines' \| 'none'` | `'dots'` | Background pattern style |
| `className` | `string` | `''` | Additional CSS classes |

## Button Variant Details

### Primary Button
- Gradient background: `from-blue-500 to-purple-600`
- White text
- Glow effect on hover: `purple-500/50`
- Enhanced shadow animation

### Secondary Button
- Transparent background with border
- Border color: `purple-500`
- Text color: `purple-300` (hovers to white)
- Border changes to pink on hover
- Glow effect: `pink-500/30`

## Animation Components Used

- `FadeInUp`: Simple fade-in with upward movement
- `AnimatedButton`: Button with scale and tap animations
- `staggerContainer`: Container for coordinated stagger animations
- `staggerItem`: Individual item animation preset

## CSS Variables Used

From `app/globals.css`:
- `--gradient-blue-purple`: `linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)`
- `--glow-purple`: `0 0 20px rgba(139, 92, 246, 0.5)`
- `--shadow-glow-lg`: `0 8px 32px rgba(139, 92, 246, 0.2)`

## Responsive Behavior

- **Mobile**: Stacked layout, smaller font sizes, reduced padding
- **Tablet**: Medium spacing and font sizes
- **Desktop**: Full-width with enhanced spacing

## Customization

You can customize colors by modifying the gradient classes:

```tsx
// Custom gradient for title
className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600"

// Custom button styles by modifying the component or wrapping it
```

## Integration with Phase 2 Dashboard

This component is ready for integration with:
- Dashboard overview pages
- Onboarding flows
- Feature announcement sections
- Call-to-action landing zones

## Features Ready for Phase 2

✅ Motion components fully integrated
✅ CSS variables from updated globals.css
✅ Full TypeScript support
✅ Responsive design implemented
✅ Animation timings specified
✅ Glassmorphic styling applied
✅ Glow effects on hover
✅ Decorative blur elements included
