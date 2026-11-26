import { Section } from "../components/Shell";
import { CharacterCard } from "../components/CharacterCard";
import { TileGroup } from "../components/TileGroup";
import { characters, events, monthly, stats } from "../../lib/ui/mock";
import { formatDeadline } from "../../lib/time";

export default function PreviewPage() {
  return (
    <>
      <Section no="01" title="주간">
        {characters.map((c) => (
          <CharacterCard key={c.id} character={c} />
        ))}
      </Section>
      <Section no="02" title="월간">
        <TileGroup bosses={monthly} />
      </Section>
      <Section no="03" title="이벤트">
        {events.map((e) => (
          <div key={e.id} className="pd-event" aria-label={`${e.title} ~ ${formatDeadline(e.endsAt)}`}>
            <p className="pd-evhead">
              <span>{e.title}</span>
              <time className="pd-dim" dateTime={e.endsAt.toISOString()}>~ {formatDeadline(e.endsAt)}</time>
            </p>
            <TileGroup bosses={e.missions} />
          </div>
        ))}
      </Section>
      <Section no="04" title="통계">
        <table className="pd-table">
          <thead>
            <tr><th scope="col">직업</th><th scope="col">☑</th><th scope="col">⏱</th></tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.job}><th scope="row">{s.job}</th><td>{s.done}/{s.total}</td><td>{s.minutes}</td></tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
