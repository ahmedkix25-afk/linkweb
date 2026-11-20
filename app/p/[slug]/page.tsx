import ProductLandingPage from '@/components/ProductLandingPage';

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProductLandingPage slug={slug} />;
}
