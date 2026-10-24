import { connection } from "next/server";
import { TabBar } from "./TabBar";

export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  // Rendered per request: the tabs show today's date and live data, never a build-time copy.
  await connection();
  // data-state (go | mid | stop) will follow readiness once data arrives.
  return (
    <div className="screen" data-state="go">
      <div className="sky" aria-hidden="true" />
      <main className="app">{children}</main>
      <TabBar />
    </div>
  );
}
