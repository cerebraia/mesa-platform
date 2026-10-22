import Link from "next/link";
import { PageHeader } from "@/components/panel/page-header";
import { CategoryFormPage } from "../../category-form";

export default function NewCategoryPage() {
  return (
    <>
      <PageHeader
        title="Nueva categoría"
        description="Las categorías organizan los productos de tu menú."
        breadcrumb={<Link href="/panel/menu" className="panel-breadcrumb-link">← Catálogo</Link>}
      />
      <CategoryFormPage mode="new" />
    </>
  );
}
