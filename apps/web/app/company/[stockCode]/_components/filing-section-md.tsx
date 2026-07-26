/**
 * 사업보고서 섹션 원문의 최소 렌더러.
 *
 * content 는 dart_doc.py 가 생성한 텍스트로, `## 헤딩` 과 `| 표 | 행 |` 형식의 마크다운이
 * 섞여 있다(줄바꿈으로 문단이 구분됨). 별도 마크다운 라이브러리를 새로 설치하지 않고
 * 빈 줄 기준 블록 파싱만으로 헤딩·표·문단을 구분한다 — 정교한 CommonMark 파서가 아니라
 * "정보가 보이는" 최소 렌더다. 표 서식이 원문과 다를 수 있으니 수치 인용 전 원문 대조가 원칙.
 */

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'para'; lines: string[] };

const TABLE_SEP_RE = /^\|?[\s:|-]+\|?$/;

function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((cell) => cell.trim());
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2].trim() });
      i++;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const header = tableLines[0] ? splitTableRow(tableLines[0]) : [];
      const bodyLines = tableLines.slice(1).filter((l) => !TABLE_SEP_RE.test(l.trim()));
      blocks.push({ type: 'table', header, rows: bodyLines.map(splitTableRow) });
      continue;
    }
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().startsWith('|') && !/^#{1,6}\s/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'para', lines: paraLines });
  }
  return blocks;
}

export function FilingSectionMarkdown({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className="prose-sm max-w-none space-y-3 text-sm leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          const Tag = (block.level <= 2 ? 'h3' : 'h4') as 'h3' | 'h4';
          return (
            <Tag key={idx} className={block.level <= 2 ? 'text-base font-semibold' : 'text-sm font-semibold'}>
              {block.text}
            </Tag>
          );
        }
        if (block.type === 'table') {
          return (
            <div key={idx} className="overflow-x-auto rounded-lg border border-fd-border">
              <table className="w-full min-w-[420px] text-xs">
                {block.header.length > 0 && (
                  <thead className="bg-fd-muted/50 text-fd-muted-foreground">
                    <tr>
                      {block.header.map((cell, ci) => (
                        <th key={ci} className="px-2 py-1.5 text-left font-medium">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-fd-border">
                  {block.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1.5 align-top">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <div key={idx} className="space-y-2">
            {block.lines.map((line, li) => (
              <p key={li} className="whitespace-pre-wrap">
                {line}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
