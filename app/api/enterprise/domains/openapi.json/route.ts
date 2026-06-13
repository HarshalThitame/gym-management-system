import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Super Admin Domain Management API",
    description: "Enterprise domain lifecycle management endpoints. All endpoints require super_admin role.",
    version: "1.0.0",
  },
  servers: [{ url: "/api/enterprise/domains", description: "Domain management API" }],
  paths: {
    "/check": {
      post: {
        summary: "Run DNS + SSL + ownership verification",
        operationId: "checkDomain",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["domainId"], properties: { domainId: { type: "string", format: "uuid" } } } } } },
        responses: { "200": { description: "Check completed" }, "400": { description: "Invalid input" }, "429": { description: "Rate limited" } },
      },
    },
    "/provision": {
      post: {
        summary: "Execute Vercel provider operation",
        operationId: "provisionDomain",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["domainId", "action"], properties: { domainId: { type: "string", format: "uuid" }, action: { type: "string", enum: ["add", "sync", "verify", "remove"] } } } } } },
        responses: { "200": { description: "Operation completed" }, "400": { description: "Invalid input" } },
      },
    },
    "/history": {
      get: {
        summary: "Get verification and provider event history",
        operationId: "getDomainHistory",
        parameters: [{ name: "domainId", in: "query", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Checks and provider events arrays" } },
      },
    },
    "/events": {
      get: {
        summary: "SSE endpoint for real-time domain check updates",
        operationId: "streamDomainEvents",
        parameters: [{ name: "domainId", in: "query", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Server-Sent Events stream" } },
      },
    },
    "/zone-export": {
      get: {
        summary: "Export BIND zone file",
        operationId: "exportZoneFile",
        parameters: [{ name: "domainId", in: "query", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Zone file as text/plain" } },
      },
    },
    "/bulk-routing": {
      patch: {
        summary: "Bulk update routing mode",
        operationId: "bulkUpdateRouting",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["domainIds", "routingMode"], properties: { domainIds: { type: "array", items: { type: "string" } }, routingMode: { type: "string", enum: ["organization", "branch", "gym"] } } } } } },
        responses: { "200": { description: "Bulk update result" } },
      },
    },
    "/transfer": {
      post: {
        summary: "Transfer domain to another organization",
        operationId: "transferDomain",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["domainId", "targetOrganizationId"], properties: { domainId: { type: "string", format: "uuid" }, targetOrganizationId: { type: "string", format: "uuid" } } } } } },
        responses: { "200": { description: "Transfer result" } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}
