const HINTS: Record<string, string> = {
  title: "제목은 1~100자로 입력하세요",
  clear_minutes: "분은 1~10000 사이 숫자입니다",
  party_size: "인원은 1~99 사이 숫자입니다",
  reward_meso: "보상 금액을 확인하세요",
  doping: "도핑은 1~100자로 입력하세요",
  memo: "메모는 500자 이하입니다",
  target_count: "횟수는 1~1000 사이 숫자입니다",
  tags: "태그를 확인하세요",
  name: "직업명은 1~30자로 입력하세요",
  line: "줄 번호를 확인하세요",
  text: "붙여넣은 내용을 확인하세요",
  character_id: "캐릭터를 확인하세요",
  root_id: "항목을 확인하세요",
};

const GENERIC = "입력을 확인하세요";

// Server messages are mostly English: show a short Korean hint, keep the server text when it is already Korean.
export function koMessage(field: string | undefined, message: string): string {
  if (/[가-힣]/.test(message)) return message;
  if (field === "title" && /already exists|earlier line/i.test(message)) return "이미 있는 제목입니다";
  return (field !== undefined && Object.hasOwn(HINTS, field) ? HINTS[field] : undefined) ?? GENERIC;
}
