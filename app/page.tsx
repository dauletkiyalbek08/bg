import Platform from "@/components/platform";
import { demoEnabled } from "@/lib/store";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Platform demoAllowed={demoEnabled()} />;
}
