/**
 * Every chapter data module, imported once for its side effect
 * (`registerTextbookCharts([...])` runs at module scope in each).
 *
 * Deliberately separate from `../registry.ts` — chapter modules import
 * `registerTextbookCharts` FROM registry.ts, so if registry.ts imported this
 * list itself, that would be a circular import and `registry`'s module-scope
 * `const` would still be in its temporal dead zone when a chapter module's
 * top-level `registerTextbookCharts([...])` call runs. See the comment atop
 * `../registry.ts` for the full explanation.
 *
 * `../textbook-chart.tsx` imports `../registry` (for `getTextbookChart`) and
 * this file (for the side effect) separately, in that order, so registry.ts
 * always finishes initializing before any chapter module registers.
 *
 * Add new chapters here as they're written:
 */
import './book1-a2';
import './book1-a3';
import './book1-a4';
import './book1-appendix';
import './book1-b1';
import './book1-b2';
import './book1-b3';
import './book1-b4';
import './book1-c1';
import './book1-c2';
import './book1-c3';
import './book1-c4';
import './book1-c5';
import './book1-d1';
import './book1-d2';
import './book1-e1';
import './book1-e2';
import './book1-e3';
import './book1-f1';
import './book1-g1';
import './book1-g2';
import './book1-h1';
import './book1-h2';
import './book1-h3';
import './book1-h4';
import './book1-i1';
import './book1-i2';
import './book1-i3';
import './book1-i4';
import './book1-i5';
import './book2-a1';
import './book2-a2';
import './book2-a3';
import './book2-a4';
import './book2-b1';
import './book2-b2';
import './book2-b3';
import './book2-b4';
import './book2-c1';
import './book2-c2';
import './book2-c3';
import './book2-c4';
import './book2-d1';
import './book2-d2';
import './book2-d3';
import './book2-d4';
import './book2-d5';
import './book2-e1';
import './book2-e2';
import './book2-e3';
import './book2-e4';
import './book2-e5';
import './book2-f1';
import './book2-f2';
import './book2-f3';
