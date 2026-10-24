import { connection } from "next/server";
import { TabBar } from "./TabBar";

export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  // Rendered per request: the tabs show today's date and live data, never a build-time copy.
  await connection();
  return (
    <div className="screen">
      <main className="app">{children}</main>
      <TabBar />
    </div>
  );
}
