import { cookies } from "next/headers";
import Platform from "@/components/platform";
import { demoEnabled } from "@/lib/runtime";
export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <Platform
      demoAllowed={demoEnabled()}
      hasSession={(await cookies()).has("bagdar_session")}
    />
  );
}
