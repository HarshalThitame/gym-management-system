import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEnterpriseDashboard } from "@/features/enterprise/services/enterprise-service";
import { SuperAdminModuleWorkspace } from "@/features/super-admin/components/super-admin-module-workspace";
import { getSuperAdminModule, superAdminModules } from "@/features/super-admin/lib/super-admin-modules";
import { createMetadata } from "@/lib/seo/metadata";

type SuperAdminModuleRouteProps = {
  params: Promise<{ module: string }>;
};

export function generateStaticParams() {
  return superAdminModules.map((module) => ({ module: module.slug }));
}

export async function generateMetadata({ params }: SuperAdminModuleRouteProps): Promise<Metadata> {
  const { module: slug } = await params;
  const selectedModule = getSuperAdminModule(slug);

  if (!selectedModule) {
    return createMetadata({
      title: "Super Admin Module",
      description: "Super Admin module for global SaaS platform governance.",
      path: "/super-admin"
    });
  }

  return createMetadata({
    title: selectedModule.title,
    description: selectedModule.description,
    path: selectedModule.href
  });
}

export default async function SuperAdminModuleRoute({ params }: SuperAdminModuleRouteProps) {
  const { module: slug } = await params;
  const selectedModule = getSuperAdminModule(slug);

  if (!selectedModule) {
    notFound();
  }

  const dashboard = await getEnterpriseDashboard();

  return <SuperAdminModuleWorkspace dashboard={dashboard} superModule={selectedModule} />;
}
