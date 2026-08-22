import { SparkleIcon } from '@phosphor-icons/react/dist/ssr';
import type { AnalysisBoardMeta } from '@/lib/analysis';

/**
 * 정성 판정 화면의 빈 상태.
 *
 * "데이터 없음"이 아니라 **"에이전트가 무엇을 써 줄 것인가"**를 말한다 — 이 단계들은
 * DB 가 못 채우는 게 결함이 아니라 설계다(로드맵: 정형은 무료·즉시, 정성은 에이전트 생성).
 * 그래서 이 자리가 곧 제품의 판매 지점이기도 하다.
 *
 * 서버 컴포넌트로 두려고 phosphor 의 `/dist/ssr` 진입점을 쓴다 — 기본 진입점은
 * 내부에서 React context 를 만들어 클라이언트 경계를 요구한다.
 */
export function AgentCta({ board }: { board: AnalysisBoardMeta }) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center sm:p-10">
      <span className="mx-auto flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <SparkleIcon className="size-4.5" weight="fill" />
      </span>
      <h2 className="mt-3 text-sm font-semibold">{board.question}</h2>
      {board.agentPromise && (
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          {board.agentPromise}
        </p>
      )}
      <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-muted-foreground">
        이 단계는 공시 숫자만으로는 판정할 수 없어 정성 분석이 필요합니다. 아래 위젯은
        무엇을 채워야 하는지를 보여주는 골격입니다.
      </p>
    </section>
  );
}
