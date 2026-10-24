/** Hero plus a list of what the tab will show. Stands in until each tab gets its data. */
export function Soon({ place, title, items }: { place: string; title: string; items: string[] }) {
  return (
    <>
      <section className="hero">
        <div className="place">{place}</div>
        <div className="big">{title}</div>
        <div className="cond">No data yet</div>
      </section>
      <section className="mod">
        <div className="mod-h">Coming next</div>
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
