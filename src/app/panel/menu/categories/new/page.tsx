import Link from "next/link";
import { CategoryFormPage } from "../../category-form";

export default function NewCategoryPage() {
  return (
    <>
      <div className="dashboard-top">
        <span>CATÁLOGO · NUEVA CATEGORÍA</span>
        <Link href="/panel/menu" className="muted" style={{ fontSize: 12, textDecoration: "none" }}>
          ← Catálogo
        </Link>
      </div>
      <CategoryFormPage mode="new" />
    </>
  );
}
