/**
 * Showcase of all new Cinematic Components
 * This file demonstrates all the new glassmorphic variants added in Phase 1
 * Not meant for production, but as a reference for developers
 */

import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CinematicCard } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";

export function CinematicComponentShowcase() {
  return (
    <div className="space-y-12 p-8">
      {/* Cards Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Cinematic Cards</h2>
        <div className="grid grid-cols-3 gap-4">
          <CinematicCard variant="default" className="p-6">
            <h3 className="text-white font-semibold">Default Glass</h3>
            <p className="text-white/70 text-sm mt-2">Base frosted glass effect</p>
          </CinematicCard>
          
          <CinematicCard variant="gradient-border" className="p-6">
            <h3 className="text-white font-semibold">Gradient Border</h3>
            <p className="text-white/70 text-sm mt-2">Subtle gradient background</p>
          </CinematicCard>
          
          <CinematicCard variant="glow" className="p-6">
            <h3 className="text-white font-semibold">Purple Glow</h3>
            <p className="text-white/70 text-sm mt-2">With shadow glow effect</p>
          </CinematicCard>
        </div>
      </section>

      {/* Buttons Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Cinematic Buttons</h2>
        <div className="flex gap-4 flex-wrap">
          <Button variant="cinematic" size="lg">
            Cinematic Primary
          </Button>
          
          <Button variant="outline-cinematic" size="lg">
            Outline Cinematic
          </Button>

          <Button variant="cinematic" size="md">
            Medium Button
          </Button>

          <Button variant="outline-cinematic" size="sm">
            Small Button
          </Button>
        </div>
      </section>

      {/* Loading Button */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Loading State</h2>
        <div className="flex gap-4">
          <Button variant="cinematic" loading={true}>
            Loading...
          </Button>
          
          <Button variant="outline-cinematic" loading={true}>
            Processing
          </Button>
        </div>
      </section>

      {/* Badges Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Cinematic Badges</h2>
        <div className="flex gap-4 flex-wrap">
          <Badge variant="gradient">Premium Gradient</Badge>
          <Badge variant="pulse">Live Pulse</Badge>
          <Badge variant="success-glow">✓ Success Glow</Badge>
          <Badge variant="warning-glow">⚠ Warning Glow</Badge>
          <Badge variant="danger-glow">✕ Danger Glow</Badge>
        </div>
      </section>

      {/* Input Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Cinematic Inputs</h2>
        <div className="space-y-4 max-w-md">
          <Input 
            variant="cinematic"
            type="text"
            placeholder="Cinematic input field"
          />
          
          <Input 
            variant="cinematic"
            type="email"
            placeholder="Email address"
          />

          <Input 
            variant="cinematic"
            type="text"
            placeholder="Error state"
            error={true}
          />

          <Textarea 
            variant="cinematic"
            placeholder="Cinematic textarea"
          />
        </div>
      </section>

      {/* Legacy Components Still Work */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Legacy Components (Backward Compatible)</h2>
        <div className="space-y-4">
          <Card>
            <CardHeader>Original Card Still Works</CardHeader>
            <CardContent>All legacy components are preserved</CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="outline">Outline</Button>
          </div>

          <div className="flex gap-2">
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
          </div>

          <Input placeholder="Default input" />
        </div>
      </section>
    </div>
  );
}
