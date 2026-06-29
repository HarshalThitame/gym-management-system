"use client";

import React, { useState } from "react";
import {
  BranchesGrid,
  BranchDetailsDrawer,
  BranchStatisticsGrid,
  BranchListHeader,
} from "./index";
import { Users, DollarSign, Zap, TrendingUp } from "lucide-react";

// Sample data for demonstration
const SAMPLE_BRANCHES = [
  {
    id: "branch-1",
    name: "Downtown Fitness",
    location: "123 Main St, Downtown",
    memberCount: 450,
    revenue: 85000,
    status: "active" as const,
    phone: "+1 (555) 123-4567",
    email: "downtown@gymfit.com",
    website: "www.gymfit-downtown.com",
    managerName: "John Smith",
    classCount: 24,
    equipmentCount: 120,
  },
  {
    id: "branch-2",
    name: "Westside Gym",
    location: "456 West Ave, Westside",
    memberCount: 320,
    revenue: 62000,
    status: "active" as const,
    phone: "+1 (555) 234-5678",
    email: "westside@gymfit.com",
    classCount: 18,
    equipmentCount: 90,
  },
  {
    id: "branch-3",
    name: "East Hub Fitness",
    location: "789 East Blvd, East",
    memberCount: 180,
    revenue: 35000,
    status: "new" as const,
    phone: "+1 (555) 345-6789",
    email: "east@gymfit.com",
    classCount: 12,
    equipmentCount: 60,
  },
  {
    id: "branch-4",
    name: "North Square Gym",
    location: "321 North Ln, North",
    memberCount: 200,
    revenue: 42000,
    status: "inactive" as const,
  },
  {
    id: "branch-5",
    name: "Central Wellness",
    location: "654 Central Dr, Center",
    memberCount: 550,
    revenue: 105000,
    status: "active" as const,
    classCount: 30,
    equipmentCount: 150,
  },
  {
    id: "branch-6",
    name: "South District Fitness",
    location: "987 South Rd, South",
    memberCount: 280,
    revenue: 54000,
    status: "active" as const,
    classCount: 16,
    equipmentCount: 75,
  },
];

/**
 * Branch Management Demo Component
 * Showcases all branch management components with cinematic design
 */
export function BranchManagementDemo() {
  const [selectedBranch, setSelectedBranch] = useState<typeof SAMPLE_BRANCHES[number] | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const statistics = [
    {
      title: "Total Members",
      value: 1980,
      unit: "",
      icon: <Users className="w-8 h-8 text-cyan-400" />,
      maxValue: 2500,
      showProgressBar: true,
      trend: { value: 12, direction: "up" as const },
    },
    {
      title: "Monthly Revenue",
      value: 383000,
      unit: "$",
      icon: <DollarSign className="w-8 h-8 text-lime-400" />,
      maxValue: 500000,
      showProgressBar: true,
      trend: { value: 8, direction: "up" as const },
    },
    {
      title: "Active Classes",
      value: 100,
      unit: "",
      icon: <Zap className="w-8 h-8 text-pink-400" />,
      maxValue: 150,
      showProgressBar: true,
      trend: { value: 5, direction: "up" as const },
    },
    {
      title: "Avg Members/Branch",
      value: 330,
      unit: "",
      icon: <TrendingUp className="w-8 h-8 text-purple-400" />,
      trend: { value: 3, direction: "down" as const },
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Branch Management</h1>
          <p className="text-muted-foreground">
            Manage all your gym branches with cinematic design and smooth animations
          </p>
        </div>

        {/* Statistics Grid */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Network Overview</h2>
          <BranchStatisticsGrid statistics={statistics} columns={4} />
        </section>

        {/* Branches Grid */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Your Branches</h2>
          <BranchesGrid
            branches={SAMPLE_BRANCHES}
            onAddBranch={() => console.log("Add branch")}
            onViewBranch={(branch) => {
              setSelectedBranch(branch);
              setIsDrawerOpen(true);
            }}
            onEditBranch={(branch) => {
              setSelectedBranch(branch);
              setIsDrawerOpen(true);
            }}
            onDeleteBranch={(id) => console.log("Delete branch:", id)}
            onSearch={(query) => console.log("Search:", query)}
            onFilterChange={(filter) => console.log("Filter:", filter)}
          />
        </section>

        {/* Details Drawer */}
        <BranchDetailsDrawer
          isOpen={isDrawerOpen}
          branch={selectedBranch}
          onClose={() => setIsDrawerOpen(false)}
          onSave={(branch) => {
            console.log("Save branch:", branch);
            setIsDrawerOpen(false);
          }}
          onDelete={(id) => {
            console.log("Delete branch:", id);
            setIsDrawerOpen(false);
          }}
        />
      </div>
    </div>
  );
}

export default BranchManagementDemo;
