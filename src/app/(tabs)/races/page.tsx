import { loadRecords, WINDOWS } from "@/lib/records";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { Module } from "../ui";

const time = (secs?: number) => {
  if (!secs) return "–";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = String(Math.round(secs % 60)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

function Table({
  rows,
  show,
}: {
  rows: { label: string; values: (number | undefined)[] }[];
  show: (v?: number) => string;
}) {
  return (
    <table className="records num">
      <thead>
        <tr>
          <th scope="col">
            <span className="sr">Effort</span>
          </th>
          {WINDOWS.map(([id, label]) => (
            <th key={id} scope="col">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row">{r.label}</th>
            {r.values.map((v, i) => (
              <td key={WINDOWS[i]?.[0]} className={i === 0 ? "pb" : undefined}>
                {show(v)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function RacesPage() {
  const r = await loadRecords();
  const pb5k = r.run[0]?.values[0];
  return (
    <Sky state="go">
      <Hero place="Races" word={pb5k ? time(pb5k) : "Records"} sub="5 km best">
        <div className="cond">Your best efforts, then and now</div>
        <div className="hl num">
          FTP {r.ftpSet ?? "–"} W set <span>·</span> {r.ftpModel ?? "–"} W from the last 6 weeks
        </div>
      </Hero>

      <Module title="Run · best times">
        <div className="mod-b">
          <Table rows={r.run} show={time} />
          <p className="say dim">
            Fastest stretch of any run at that distance, so a 10 km PB can sit inside a half
            marathon.
          </p>
        </div>
      </Module>

      <Module title="Ride · best power">
        <div className="mod-b">
          <Table rows={r.power} show={(v) => (v ? `${v} W` : "–")} />
          <p className="say dim">
            Power data starts in 2025. FTP {r.ftpSet ?? "–"} W is the value set in intervals.icu;{" "}
            {r.ftpModel ?? "–"} W is intervals.icu's estimate from your last 6 weeks.
          </p>
        </div>
      </Module>

      <Module title="Coming next">
        <ul>
          <li>5 km to marathon estimates from critical speed, next to COROS</li>
          <li>Running and cycling VO₂max, swim CSS</li>
          <li>Long-ride estimate from a GPX route</li>
          <li>A/B/C race countdown, gear</li>
        </ul>
      </Module>
    </Sky>
  );
}
