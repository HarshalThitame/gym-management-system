# Quick Start: Animation Framework

## Installation
Already installed! Just import from `@/components/motion`

## Basic Usage Patterns

### 1. Animated Grid (Most Common)
```tsx
import { AnimatedContainer, AnimatedItem, AnimatedCard } from "@/components/motion";

export function Classes() {
  return (
    <AnimatedContainer className="grid grid-cols-3 gap-4">
      {classes.map((cls, i) => (
        <AnimatedItem key={cls.id} index={i}>
          <AnimatedCard className="p-4 bg-white rounded-lg">
            {cls.name}
          </AnimatedCard>
        </AnimatedItem>
      ))}
    </AnimatedContainer>
  );
}
```

### 2. Page Entrance
```tsx
import { FadeInUp } from "@/components/motion";

export function Dashboard() {
  return (
    <div>
      <FadeInUp delay={0}>
        <h1>Dashboard</h1>
      </FadeInUp>
      <FadeInUp delay={0.1}>
        <p>Welcome back</p>
      </FadeInUp>
    </div>
  );
}
```

### 3. Stats Counter
```tsx
import { useCountUp } from "@/components/motion";

export function Stats() {
  const members = useCountUp({ to: 250, duration: 2 });
  const revenue = useCountUp({ to: 50000, duration: 2, decimals: 0 });

  return (
    <div>
      <div>{members} Members</div>
      <div>₹{revenue} Revenue</div>
    </div>
  );
}
```

### 4. Drawer/Sidebar
```tsx
import { AnimatedDrawer, AnimatedButton } from "@/components/motion";
import { useState } from "react";

export function Navigation() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AnimatedButton onClick={() => setOpen(true)}>Menu</AnimatedButton>
      <AnimatedDrawer isOpen={open} onClose={() => setOpen(false)}>
        <nav className="p-6">Menu items here</nav>
      </AnimatedDrawer>
    </>
  );
}
```

### 5. Scroll Trigger
```tsx
import { useScrollAnimation } from "@/components/motion";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/components/motion";

export function ScrollSection() {
  const { ref, isInView } = useScrollAnimation();

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={staggerContainer}
    >
      <motion.div variants={staggerItem}>Item 1</motion.div>
      <motion.div variants={staggerItem}>Item 2</motion.div>
    </motion.div>
  );
}
```

## Common Props

### AnimatedContainer
```tsx
<AnimatedContainer 
  stagger={true}              // Enable stagger (default)
  className="grid gap-4"       // Tailwind classes
>
```

### AnimatedItem
```tsx
<AnimatedItem 
  index={0}                    // Order (used for delay)
  delay={0.1}                  // Additional delay
  className="p-4"              // Tailwind classes
>
```

### AnimatedCard
```tsx
<AnimatedCard
  hoverable={true}             // Enable lift on hover (default)
  onClick={() => {}}           // Click handler
  className="p-4 bg-white"     // Tailwind classes
>
```

### AnimatedDrawer
```tsx
<AnimatedDrawer
  isOpen={true}                // Show/hide
  onClose={() => {}}           // Close handler
  backdrop={true}              // Show backdrop (default)
  className="w-80"             // Tailwind classes
>
```

### AnimatedButton
```tsx
<AnimatedButton
  hoverable={true}             // Enable animation (default)
  onClick={() => {}}           // Any button props
  className="px-4 py-2 bg-blue"
>
  Click Me
</AnimatedButton>
```

## Hook Examples

### useStaggerChildren
```tsx
const { ref, isVisible } = useStaggerChildren();

return (
  <div ref={ref}>
    {isVisible && items.map((item, i) => (
      <AnimatedItem index={i}>{item}</AnimatedItem>
    ))}
  </div>
);
```

### useCountUp
```tsx
const count = useCountUp({ 
  from: 0,
  to: 1000,
  duration: 2,
  decimals: 0
});
```

### useScrollAnimation
```tsx
const { ref, isInView } = useScrollAnimation({ 
  threshold: 0.2,
  once: true
});
```

### useAnimatedValue
```tsx
const { motionValue, animateTo, setValue, getValue } = useAnimatedValue({
  initialValue: 0,
  duration: 1
});

animateTo(100);  // Animate to value
setValue(50);    // Set immediately
```

## Presets Direct Usage

```tsx
import { fadeInUp, staggerContainer, staggerItem } from "@/components/motion";
import { motion } from "framer-motion";

export function Custom() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div variants={staggerItem}>Item 1</motion.div>
      <motion.div variants={staggerItem}>Item 2</motion.div>
    </motion.div>
  );
}
```

## Available Presets
- `fadeInUp` - Fade in with upward slide
- `bounceIn` - Scale bounce entrance
- `slideInLeft` - Slide from left
- `slideInRight` - Slide from right
- `rotateIn` - Rotation entrance
- `flipCard` - 3D flip
- `hoverLift` - Lift on hover
- `scaleHover` - Scale on hover
- `gradientBorderGlow` - Glow on hover
- `slideDrawer` - Drawer entrance
- `pulseBadge` - Continuous pulse
- `staggerContainer` - Parent animation
- `staggerItem` - Child animation
- `fade` - Simple fade
- `createCountUpVariants(from, to, duration)` - Counter animation

## Performance Tips
1. Use `useScrollAnimation` for off-screen elements
2. Limit stagger items to 10-15 per container
3. Use `once: true` to prevent re-animations
4. Hover effects use CSS (no JS overhead)
5. Memoize components for fast re-renders

## Files Location
- `/components/motion/animation-presets.ts` - Variants
- `/components/motion/animation-helpers.tsx` - Components
- `/components/motion/useStaggerChildren.ts` - Hooks
- `/components/motion/index.ts` - All exports
- `/components/motion/ANIMATION_FRAMEWORK.md` - Full docs

---

That's it! Start building beautiful, animated experiences.
