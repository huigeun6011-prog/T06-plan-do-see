// MOCK DATA ONLY: invented for the preview route. Nothing here comes from the database.
export type MockBoss = {
  id: string;
  title: string;
  minutes: number;
  party?: number;
  target?: number; // cumulative tile (hunting): count needed
  done?: number; // starting count for cumulative tiles
};

export type MockCharacter = { id: string; job: string; bosses: MockBoss[] };

const b = (id: string, title: string, minutes: number, extra: Partial<MockBoss> = {}): MockBoss => ({ id, title, minutes, ...extra });

export const characters: MockCharacter[] = [
  {
    id: "c1",
    job: "아크메이지",
    bosses: [
      b("1", "노말 진힐라", 12), b("2", "하드 루시드", 9), b("3", "하드 윌", 11), b("4", "카오스 더스크", 7),
      b("5", "하드 듄켈", 8), b("6", "익스트림 스우", 14, { party: 3 }), b("7", "카오스 가디언 엔젤 슬라임", 6),
      b("8", "이지 힐라", 5), b("9", "노말 반 레온", 6), b("10", "카오스 벨룸", 8),
      b("11", "카오스 핑크빈", 5), b("12", "사냥", 10, { target: 6, done: 3 }),
    ],
  },
  {
    id: "c2",
    job: "보우마스터",
    bosses: [
      b("1", "노말 진힐라", 10), b("2", "하드 루시드", 8), b("3", "하드 윌", 10), b("4", "카오스 더스크", 6),
      b("5", "하드 듄켈", 7), b("6", "카오스 벨룸", 7), b("7", "이지 힐라", 5), b("8", "카오스 핑크빈", 4),
      b("9", "노말 반 레온", 6, { party: 2 }), b("10", "카오스 가디언 엔젤 슬라임", 6), b("11", "사냥", 10, { target: 6 }),
    ],
  },
  {
    id: "c3",
    job: "나이트로드",
    bosses: [
      b("1", "노말 진힐라", 11), b("2", "노말 루시드", 8), b("3", "노말 윌", 9), b("4", "카오스 더스크", 7),
      b("5", "노말 듄켈", 7), b("6", "이지 힐라", 5), b("7", "카오스 벨룸", 8), b("8", "카오스 핑크빈", 5),
      b("9", "노말 반 레온", 6), b("10", "하드 스우", 12, { party: 2 }),
    ],
  },
  {
    id: "c4",
    job: "섀도어",
    bosses: [
      b("1", "노말 진힐라", 12), b("2", "노말 루시드", 9), b("3", "노말 윌", 10), b("4", "카오스 더스크", 8),
      b("5", "이지 힐라", 5), b("6", "카오스 벨룸", 8), b("7", "카오스 핑크빈", 5), b("8", "노말 반 레온", 7),
      b("9", "이지 스우", 8), b("10", "카오스 가디언 엔젤 슬라임", 6), b("11", "이지 데미안", 6),
    ],
  },
];

export const monthly: MockBoss[] = [b("m1", "용의 섬", 15)];

// Instants are real Dates so the screen can pass them to formatDeadline.
export const events = [
  {
    id: "e1",
    title: "여름 이벤트",
    endsAt: new Date("2026-12-10T00:00:00+09:00"),
    missions: [b("v1", "출석", 1), b("v2", "미션 A", 5), b("v3", "미션 B", 10, { target: 3 })],
  },
  {
    id: "e2",
    title: "주말 이벤트",
    endsAt: new Date("2026-11-29T02:00:00+09:00"),
    missions: [b("w1", "접속 보상", 1), b("w2", "미션", 8)],
  },
];

export const stats = characters.map((c, i) => ({
  job: c.job,
  done: [9, 7, 8, 6][i],
  total: c.bosses.length,
  minutes: [96, 71, 80, 66][i],
}));
