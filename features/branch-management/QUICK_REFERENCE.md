# Branch Management Components - Quick Reference

## 🚀 Quick Start

```typescript
import {
  BranchesGrid,
  BranchDetailsDrawer,
  BranchStatisticsGrid,
} from "@/features/branch-management/components";

export function MyBranchPage() {
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="space-y-8">
      {/* Statistics Overview */}
      <BranchStatisticsGrid
        statistics={[
          {
            title: "Total Members",
            value: 1500,
            maxValue: 2000,
            showProgressBar: true,
            icon: <Users className="w-8 h-8" />,
          },
          // ... more stats
        ]}
      />

      {/* Branches Grid */}
      <BranchesGrid
        branches={branches}
        onViewBranch={(branch) => {
          setSelectedBranch(branch);
          setIsDrawerOpen(true);
        }}
        onAddBranch={handleAddBranch}
      />

      {/* Details Drawer */}
      <BranchDetailsDrawer
        isOpen={isDrawerOpen}
        branch={selectedBranch}
        onClose={() => setIsDrawerOpen(false)}
        onSave={handleSaveBranch}
      />
    </div>
  );
}
```

## 📦 Component Overview

| Component | Purpose | Animations |
|-----------|---------|-----------|
| **BranchListHeader** | Search & filter UI | Input glow (0.3s), button scale |
| **BranchCard** | Individual branch card | Hover lift (0.3s), badge pulse |
| **BranchesGrid** | Grid layout + integration | Cascade stagger (0.1s) |
| **BranchDetailsDrawer** | Drawer panel | Slide-in (0.4s) |
| **BranchStatisticsCard** | Stat display with animations | Count-up (2s), progress fill (1.5s) |

## 🎨 Styling

All components use the cinematic design system:
- **Base**: `CinematicCard` with glassmorphic effect
- **Colors**: Purple-Pink gradient with glows
- **Responsive**: Mobile-first (1 → 2 → 3 columns)

## ⚙️ Configuration

### BranchCard Status Variants
```typescript
status: "active" | "inactive" | "new"
```
- **Active**: Green badge with pulse
- **Inactive**: Gray badge
- **New**: Blue badge with continuous pulse

### BranchStatisticsCard
```typescript
{
  title: string,
  value: number,
  unit?: string,
  maxValue?: number,
  showProgressBar?: boolean,
  variant?: "default" | "gradient-border" | "glow",
  animationDuration?: number,
  trend?: { value: number, direction: "up" | "down" },
  icon?: React.ReactNode,
}
```

## 🎬 Animation Timings

| Feature | Duration | Type |
|---------|----------|------|
| Input Focus Glow | 0.3s | Ease-out |
| Button Hover | 0.2-0.3s | Spring |
| Card Hover | 0.3s | Ease-out |
| Grid Stagger | 0.1s | Between items |
| Drawer Slide | 0.4s | Ease-out |
| Count-up | 2s (default) | Ease-out |
| Progress Fill | 1.5s | Smooth |
| Icon Spin | 0.4s | Spring |

## 🔧 Advanced Usage

### Custom Animation Duration
```typescript
<BranchStatisticsCard
  title="Revenue"
  value={85000}
  animationDuration={3} // 3 seconds instead of default 2
  showProgressBar
  maxValue={100000}
/>
```

### Grid with Custom Callbacks
```typescript
<BranchesGrid
  branches={branches}
  onSearch={(query) => {
    // Handle search
    setSearchQuery(query);
  }}
  onFilterChange={(filter) => {
    // Handle filter
    setActiveFilter(filter);
  }}
  onAddBranch={() => {
    // Open add dialog
  }}
  onEditBranch={(branch) => {
    // Show edit drawer
  }}
  onDeleteBranch={(id) => {
    // Delete branch
  }}
  onViewBranch={(branch) => {
    // Show details
  }}
/>
```

### Edit Form in Drawer
```typescript
<BranchDetailsDrawer
  isOpen={isOpen}
  branch={selectedBranch}
  onClose={handleClose}
  onSave={(updatedBranch) => {
    // Make API call to update
    updateBranchAPI(updatedBranch);
  }}
  onDelete={(branchId) => {
    // Make API call to delete
    deleteBranchAPI(branchId);
  }}
/>
```

## 🎯 Type Definitions

```typescript
// Branch Data
interface BranchData {
  id: string;
  name: string;
  location: string;
  memberCount: number;
  revenue: number;
  status: "active" | "inactive" | "new";
}

// Extended Branch Details
interface BranchDetails extends BranchData {
  phone?: string;
  email?: string;
  website?: string;
  managerName?: string;
  classCount?: number;
  equipmentCount?: number;
}

// Statistics Card Props
export interface BranchStatisticsCardProps {
  title: string;
  value: number;
  unit?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  maxValue?: number;
  showProgressBar?: boolean;
  variant?: "default" | "gradient-border" | "glow";
  animationDuration?: number;
}
```

## 📱 Responsive Breakpoints

- **Mobile** (< 768px): 1 column grid
- **Tablet** (768px - 1024px): 2 column grid
- **Desktop** (> 1024px): 3 column grid

## 🎨 Color Palette

```css
Active:     text-green-400, bg-green-500/20
Inactive:   text-gray-400, bg-gray-500/20
New:        text-blue-400, bg-blue-500/20
Trending↑:  text-green-400
Trending↓:  text-red-400
Primary:    from-purple-500 to-pink-500
Glow:       shadow-purple-500/30
```

## ⚡ Performance Tips

1. **Memoize branch list** for large datasets
2. **Use pagination** if > 100 branches
3. **Lazy load** branch details on drawer open
4. **Debounce search** queries
5. **Virtualize grid** for 500+ items

## 🐛 Common Issues

**Cards not animating?**
- Ensure `"use client"` directive is present
- Check Framer Motion is installed
- Verify CSS classes are applied

**Drawer not opening?**
- Pass `isOpen={true}` and valid `branch` object
- Check `onClose` is defined
- Verify z-index doesn't conflict (drawer z-50)

**Search/Filter not working?**
- Ensure `onSearch` and `onFilterChange` callbacks are defined
- Check filtered state is being updated
- Verify filter values match status enum

## 📚 Further Documentation

See `COMPONENTS_SUMMARY.md` for:
- Detailed component specifications
- Complete animation timeline
- Integration examples
- File structure

## 🔗 Related Components

- `CinematicCard` - Base card component
- `AnimatedContainer` - Stagger animation wrapper
- `AnimatedItem` - Individual item animation
- `Badge` - Status badges
