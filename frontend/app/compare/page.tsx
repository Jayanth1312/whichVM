import { ComparePage } from "@/components/instance-compare";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ComparePage />
    </Suspense>
  );
}
