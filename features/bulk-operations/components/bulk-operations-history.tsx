"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBulkOperationsAction } from "../actions/bulk-operations-actions";
import type { BulkOperation } from "../services/bulk-operations-service";

export function BulkOperationsHistory() {
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOperations();
  }, []);

  const loadOperations = async () => {
    setIsLoading(true);
    try {
      const data = await getBulkOperationsAction({ limit: 10 });
      setOperations(data);
    } catch (error) {
      console.error("Failed to load bulk operations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="size-4 text-success" />;
      case "failed":
        return <XCircle className="size-4 text-destructive" />;
      case "processing":
        return <Loader2 className="size-4 animate-spin text-accent" />;
      case "cancelled":
        return <AlertCircle className="size-4 text-warning" />;
      default:
        return <Clock className="size-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "destructive" | "accent" | "warning" | "outline"> = {
      completed: "success",
      failed: "destructive",
      processing: "accent",
      cancelled: "warning",
      pending: "outline"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatOperationType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bulk Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (operations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bulk Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground py-8">
            No bulk operations yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Operations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {operations.map(operation => (
            <div
              key={operation.id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(operation.status)}
                <div>
                  <p className="text-sm font-medium">
                    {formatOperationType(operation.operation_type)} {operation.entity_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {operation.success_count}/{operation.total_count} successful
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(operation.status)}
                <span className="text-xs text-muted-foreground">
                  {new Date(operation.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
