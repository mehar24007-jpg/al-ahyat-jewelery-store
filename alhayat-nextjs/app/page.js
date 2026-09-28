import { getProductsWithVariants } from "@/lib/db";
import StoreClient from "./components/StoreClient";

export const dynamic = "force-dynamic"; // always show live stock, never a stale cached page

export default async function HomePage() {
  let products = [];
  let loadError = null;
  try {
    products = await getProductsWithVariants();
  } catch (err) {
    loadError = err.message;
  }

  return <StoreClient initialProducts={products} loadError={loadError} />;
}
