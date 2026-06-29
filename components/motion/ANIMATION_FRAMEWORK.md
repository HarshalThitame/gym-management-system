# Framer Motion Animation Framework

Complete, reusable animation utilities and components for the gym management SaaS platform.

## Overview

This framework provides:
- **Animation Presets**: Pre-configured Framer Motion variants for common animations
- **React Components**: Ready-to-use animated UI components
- **Custom Hooks**: Advanced animation logic and utilities
- **TypeScript Support**: Full type safety across all exports

## Files

### 1. `animation-presets.ts`

Pre-configured animation variants and transitions for Framer Motion.

#### Available Presets

**Entrance Animations:**
- `fadeInUp` - Fade in with upward movement
- `bounceIn` - Scale up with bounce effect
- `slideInLeft` - Slide in from left
- `slideInRight` - Slide in from right
- `rotateIn` - Rotate while fading in
- `flipCard` - 3D flip effect

**Container & Item Animations:**
- `staggerContainer` - Container for staggered child animations
- `staggerItem` - Individual item within stagger container (0.1s delay between items)

**Hover & Interactive:**
- `hoverLift` - Lifts element on hover with shadow glow
- `scaleHover` - Scales element on hover (1.05x)
- `gradientBorderGlow` - Adds glow shadow on hover
- `slideDrawer` - Drawer/sidebar slide animation

**Continuous & Special:**
- `pulseBadge` - Continuous pulse animation (scale 1 → 1.05 → 1)
- `fade` - Simple fade in/out

**Utility Functions:**
- `createCountUpVariants(from, to, duration)` - Generate number counter animation

## 2. `animation-helpers.tsx`

React components that wrap Framer Motion with pre-configured animations.

### Components

#### `AnimatedContainer`
Wrapper for staggered animations of multiple children.

```tsx
import { AnimatedContainer, AnimatedItem } from "@/components/motion";

export function MyComponent() {
  return (
    <AnimatedContainer stagger={true}>
      <AnimatedItem index={0}>Item 1</AnimatedItem>
      <AnimatedItem index={1}>Item 2</AnimatedItem>
      <AnimatedItem index={2}>Item 3</AnimatedItem>
    </AnimatedContainer>
  );
}
```

**Props:**
- `children: ReactNode` - Child elements
- `stagger?: boolean` - Enable stagger animation (default: true)
- `className?: string` - Tailwind classes

#### `AnimatedItem`
Individual item for stagger animations.

**Props:**
- `children: ReactNode` - Item content
- `index?: number` - Animation order (default: 0)
- `className?: string` - Tailwind classes
- `delay?: number` - Additional delay in seconds

#### `AnimatedCard`
Card component with hover lift effect.

```tsx
import { AnimatedCard } from "@/components/motion";

export function DashboardCard() {
  return (
    <AnimatedCard hoverable={true} className="p-6 bg-white rounded-lg">
      <h3>Gym Stats</h3>
      <p>Members: 250</p>
    </AnimatedCard>
  );
}
```

**Props:**
- `children: ReactNode` - Card content
- `className?: string` - Tailwind classes
- `hoverable?: boolean` - Enable hover lift (default: true)
- `onClick?: () => void` - Click handler

#### `AnimatedDrawer`
Sidebar/drawer component with slide animation.

```tsx
import { AnimatedDrawer } from "@/components/motion";

export function Sidebar({ isOpen, onClose }) {
  return (
    <AnimatedDrawer isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2>Menu</h2>
        {/* Sidebar content */}
      </div>
    </AnimatedDrawer>
  );
}
```

**Props:**
- `children: ReactNode` - Drawer content
- `isOpen: boolean` - Drawer visibility
- `onClose?: () => void` - Close handler
- `className?: string` - Tailwind classes
- `backdrop?: boolean` - Show backdrop (default: true)

#### `AnimatedBadge`
Badge with glow effect on hover.

**Props:**
- `children: ReactNode` - Badge content
- `className?: string` - Tailwind classes
- `hoverable?: boolean` - Enable glow (default: true)

#### `AnimatedButton`
Button with scale animation on hover/tap.

**Props:**
- All standard `<button>` attributes
- `hoverable?: boolean` - Enable animation (default: true)

#### `FadeInUp`
Simple fade-in with upward movement.

```tsx
import { FadeInUp } from "@/components/motion";

export function PageTitle() {
  return <FadeInUp delay={0.2}>Welcome to Gym Dashboard</FadeInUp>;
}
```

**Props:**
- `children: ReactNode` - Content
- `className?: string` - Tailwind classes
- `delay?: number` - Animation delay in seconds

## 3. `useStaggerChildren.ts`

Custom hooks for advanced animation logic.

### Hooks

#### `useStaggerChildren()`
Trigger stagger animations when element enters viewport.

```tsx
import { useStaggerChildren, AnimatedItem } from "@/components/motion";

export function GymClassList({ classes }) {
  const { ref, isVisible } = useStaggerChildren();

  return (
    <div ref={ref} className="grid gap-4">
      {isVisible && classes.map((cls, i) => (
        <AnimatedItem key={cls.id} index={i}>
          <ClassCard {...cls} />
        </AnimatedItem>
      ))}
    </div>
  );
}
```

**Returns:**
- `ref: RefObject<HTMLDivElement>` - Attach to container
- `isVisible: boolean` - Animation trigger state

#### `useCountUp(options)`
Animate number counters smoothly.

```tsx
import { useCountUp } from "@/components/motion";

export function MemberCounter() {
  const count = useCountUp({ from: 0, to: 250, duration: 2, decimals: 0 });

  return <div className="text-4xl font-bold">{count}</div>;
}
```

**Options:**
- `from?: number` - Starting number (default: 0)
- `to: number` - Target number (required)
- `duration?: number` - Animation duration in seconds (default: 2)
- `decimals?: number` - Decimal places (default: 0)

**Returns:** `number` - Current animated count

#### `useAnimatedValue(options)`
Generic animation value for custom animations.

```tsx
import { useAnimatedValue } from "@/components/motion";
import { motion } from "framer-motion";

export function CustomAnimation() {
  const { motionValue, animateTo, setValue, getValue } = useAnimatedValue({
    initialValue: 0,
    duration: 1,
  });

  return (
    <>
      <motion.div style={{ opacity: motionValue }} className="box" />
      <button onClick={() => animateTo(1)}>Animate</button>
    </>
  );
}
```

**Options:**
- `initialValue?: number` - Start value (default: 0)
- `duration?: number` - Animation duration (default: 0.5)

**Returns:**
- `motionValue` - Framer Motion value
- `animateTo(target)` - Animate to value
- `setValue(value)` - Set immediately
- `getValue()` - Get current value

#### `useScrollAnimation(options)`
Trigger animations when element scrolls into view.

```tsx
import { useScrollAnimation } from "@/components/motion";

export function ScrollTriggeredSection() {
  const { ref, isInView } = useScrollAnimation({ threshold: 0.2 });

  return (
    <motion.div
      ref={ref}
      animate={isInView ? "visible" : "hidden"}
      variants={containerVariants}
    >
      Content appears when scrolled into view
    </motion.div>
  );
}
```

**Options:**
- `threshold?: number` - Visibility threshold (0-1, default: 0.1)
- `rootMargin?: string` - Margin around viewport
- `once?: boolean` - Trigger only once (default: true)

**Returns:**
- `ref` - Attach to element
- `isInView` - Visibility state

#### `usePulse(options)`
Pulse animation effect for badges/notifications.

**Options:**
- `scale?: number` - Max scale value (default: 1.05)
- `duration?: number` - Full pulse cycle duration (default: 2)

**Returns:** Motion value for pulse animation

#### `useHoverAnimation(options)`
Manage hover animation state.

**Options:**
- `scale?: number` - Hover scale (default: 1.05)
- `duration?: number` - Transition duration (default: 0.2)

**Returns:**
- `scaleValue` - Motion value
- `isHovered` - Hover state
- `handleHoverStart()` - Start hover animation
- `handleHoverEnd()` - End hover animation

#### `useDebounceAnimation(callback, options)`
Debounce animation callbacks to prevent excessive triggers.

**Options:**
- `delay?: number` - Debounce delay in ms (default: 300)

## Usage Examples

### Example 1: Animated Grid of Cards
```tsx
import {
  AnimatedContainer,
  AnimatedCard,
  AnimatedItem,
} from "@/components/motion";

export function ClassesGrid() {
  return (
    <AnimatedContainer className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {classes.map((cls, i) => (
        <AnimatedItem key={cls.id} index={i}>
          <AnimatedCard className="p-6 bg-gradient-to-br from-purple-500 to-blue-500">
            <h3 className="text-white font-bold">{cls.name}</h3>
            <p className="text-white/80">{cls.trainer}</p>
          </AnimatedCard>
        </AnimatedItem>
      ))}
    </AnimatedContainer>
  );
}
```

### Example 2: Dashboard with Counters
```tsx
import { FadeInUp, useCountUp } from "@/components/motion";

export function StatsSection() {
  const members = useCountUp({ to: 250, duration: 2 });
  const revenue = useCountUp({ to: 50000, duration: 2 });

  return (
    <div className="grid grid-cols-2 gap-6">
      <FadeInUp delay={0} className="p-6 bg-white rounded-lg">
        <h3 className="text-gray-600">Members</h3>
        <p className="text-4xl font-bold">{members}</p>
      </FadeInUp>
      <FadeInUp delay={0.2} className="p-6 bg-white rounded-lg">
        <h3 className="text-gray-600">Revenue</h3>
        <p className="text-4xl font-bold">₹{revenue}</p>
      </FadeInUp>
    </div>
  );
}
```

### Example 3: Responsive Navigation with Drawer
```tsx
import { useState } from "react";
import { AnimatedDrawer, AnimatedButton } from "@/components/motion";

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <AnimatedButton onClick={() => setIsOpen(true)}>Menu</AnimatedButton>
      <AnimatedDrawer isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <nav className="p-6">
          <a href="/dashboard">Dashboard</a>
          <a href="/members">Members</a>
          <a href="/classes">Classes</a>
        </nav>
      </AnimatedDrawer>
    </>
  );
}
```

## Performance Best Practices

1. **Use `useStaggerChildren` for scroll-triggered animations**
   - Prevents unnecessary animations outside viewport
   - Reduces JavaScript execution

2. **Leverage CSS transitions where possible**
   - Hover effects use CSS for 60fps performance
   - Complex animations use Framer Motion

3. **Memoize components**
   ```tsx
   export const MemoizedCard = memo(AnimatedCard);
   ```

4. **Limit stagger delays**
   - Default 0.1s between items is optimal
   - Adjust based on number of items

5. **Use `once: true` for scroll animations**
   - Prevents re-animations on scroll up
   - Saves CPU/GPU resources

## TypeScript Support

All exports include full TypeScript definitions:

```tsx
import type {
  AnimatedContainerProps,
  UseCountUpOptions,
  UseScrollAnimationOptions,
} from "@/components/motion";
```

## Export Summary

**From `components/motion/index.ts`:**
- Animation presets (20+ variants)
- 7 React components
- 7 custom hooks
- Complete TypeScript types
- Ready for Phase 2 implementation

## Integration with Phase 2

This framework is designed for:
- Dashboard sections
- Class/membership cards
- Navigation & drawers
- Stats & counters
- Modals & overlays
- Loading states
- Form animations

All components support Tailwind CSS and work with Next.js 15.
