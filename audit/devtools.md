# گزارش حسابرسی پکیج `devtools`
**نسخه:** v1.3.0 | **بسته:** `@zenith/devtools`

---

## ۱. خلاصه پکیج

پکیج `devtools` هوک DevTools فریم‌ورک Zenith را پیاده‌سازی می‌کند که یک شیء سراسری روی `window.__ZENITH__` قرار می‌دهد تا افزونه‌ی Chrome بتواند:
- نسخه‌ی فریم‌ورک را بخواند.
- لیست تمام سیگنال‌های فعال را بگیرد.
- Timeline تغییرات State را ببیند.
- لیست کامپوننت‌های ثبت‌شده را ببیند.
- روی تغییرات State گوش دهد.

علاوه بر این، این پکیج شامل ویژگی‌های زیر است:
- **Dependency Graph Viewer**: نمایش گراف وابستگی‌های واکنش‌گرا (Signal → Effect → Directive → DOM) در یک Viewer مبتنی بر SVG.
- **Features v1.0.0**: ردیابی zen-static fast path، Resource.destroy، cache آمار compileEffect، و SSR stores.

این پکیج به پکیج‌های `@zenith/state` و `@zenith/components` وابسته است و در محیط توسعه (Development) اجرا می‌شود؛ در SSR یا تست‌های Node، no-op است.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|----------|
| `src/index.ts` | ~41 | re-export توابع و types از `hook.ts` و `graph.ts` |
| `src/hook.ts` | ~271 | تعریف هوک DevTools (`window.__ZENITH__`) و متدهای آن |
| `src/graph.ts` | ~362 | مدیریت گراف وابستگی‌ها (Node، Edge، متدهای ثبت و بازیابی) |
| `src/graph-viewer.html` | ~668 | Viewer خودکونمющего برای نمایش گراف وابستگی (SVG + JS) |

---

## ۳. باگ‌ها و مشکلات

### BUG-DEV-01: Potential memory leak in DevTools hook during HMR
- **schwere Wassermittel:**
- **Miejsce:** `src/hook.ts` – `staticFors`, `destroyedResources`, `cacheStats.uniqueExpressions`, `activeSSRStores` collections
- **توضیح:** در حالت HMR (Hot Module Replacement)، ماژول‌های antiguos ممکن است کاملاً حذف نشوند و مراجعه‌هایشان به اینcollections باقی بماند. اینcollections به‌عنوان اعضای ماژول سطح-module هستند و هر بار ماژول بارگذاری مجدد می‌شود، نسخه جدیدی از آن‌ها ساخته می‌شود، اما نسخه قبلی اگر به procédé دیگری از کد (مثلاً از طریق `window.__ZENITH__`) ارجاع داده شود، ممکن است در حافظه بماند. این مشكلة به‐ویژه برای `staticFors` و `destroyedResources` و `cacheStats.uniqueExpressions` (که یک `Set<string>` است) relevant است،因為它们在 HMR 期间可能不会被清除，导致内存泄漏。
- **提案の修正:** HMR Ereignisse zu erkennen und diese Collections bei Bedarf zu leeren. Beispielsweise kann ein `window.addEventListener('beforeunload', ...)` verwendet werden, um die Collections zu leeren, wenn die Seite verlassen wird, oder ein spezieller HMR-Hook (z. B. von Vite) kann verwendet werden, um die Collections vor dem Neuladen des Moduls zu leeren.

### BUG-DEV-02: Inconsistent dev mode detection
- **schwere Wassermittel:**
- **Miejsce:** `src/hook.ts` – `shouldEnableDevtools()` function, lines 138-141
- **توضیح:** Die Funktion `shouldEnableDevtools()` überprüft das Flag `(globalThis as any).__ZENITH_DEVTOOLS__`, das standardmäßig auf `true` gesetzt ist (wenn nicht definiert, wird `true` zurückgegeben). Dieser Ansatz funktioniert in den meisten Fällen, aber wenn das Framework in mehreren Kontexten (z. B. Haupt-Thread und Worker) verwendet wird, können diese Flags inkonsistent gesetzt sein, was zu inkonsistenter Erkennung des Entwicklungsmodus führt.
- **提案の修正:** Eine robustere Erkennungsmechanismus für den Entwicklungsmodus implementieren, z. B. durch Verwendung eines zur Build-Zeit definierten Wertes (über einen Bundler-Plugin) oder durch Überprüfung mehrerer Signale (URL-Parameter, Hostname, benutzerdefinierte Ereignisse) als Fallback.

### BUG-DEV-03: Missing cleanup of DevTools hook on page unload
- **schwere Wassermittel:**
- **Miejsce:** `src/hook.ts` – `cleanupDevtools()` function, lines 258-270 (wird nur für Tests aufgerufen)
- **توضیح:** Der `cleanupDevtools()`-Function wird nur in Tests aufgerufen und entfernt den Hook sowie leert die internen Speicher. In einer Einzelseitenanwendung (SPA), in der der Benutzer zwischen Ansichten navigiert und der Rahmen möglicherweise mehrmals initialisiert wird, könnte der alte Hook nicht ordnungsgemäß entfernt werden, was zu potenziellen Speicherlecks oder veralteten Referenzen führt. Obwohl der Hook idempotent ist und ein erneutes Installieren das vorherige überschreibt, könnten die internen Speicher (wie `staticFors`, `destroyedResources`, usw.) nicht geleert werden, wenn der alte Hook weiterhin Referenzen hält.
- **提案の修正:** Einen `beforeunload` oder `visibilitychange` Event Listener hinzufügen, der `cleanupDevtools()` aufruft, wenn die Seite verlassen wird oder unsichtbar wird, um sicherzustellen, dass Ressourcen freigegeben werden. Alternativ kann ein Mechanismus bereitgestellt werden, damit das Runtime den Hook explizit löscht (z. B. über eine `destroyDevTools()` Funktion).

### BUG-DEV-04: Graph viewer does not handle extremely large graphs efficiently
- **schwere Wassermittel:**
- **Miejsce:** `src/graph-viewer.html` – Force-directed simulation and rendering logic
- **توضیح:** Der Graph-Viewer verwendet einen einfachen Force-Directed-Algorithmus zur Layoutgestaltung. Bei sehr großen Graphen (tausende von Knoten und Kanten) kann dieser Algorithmus langsam werden und die Benutzeroberfläche blockieren. Darüber hinaus rendern der aktuelle Implementierung alle Knoten und Kanten gleichzeitig, was bei großen Datensätzen zu Leistungseinbußen führen kann.
- **提案の修正:** Für große Graphen eine Zoom- und Pan-Funktion mit Virtual Rendering (nur sichtbare Knoten und Kanten rendern) implementieren. Alternativ kann eine Schwelle festgelegt werden, ab der eine vereinfachte Darstellung (z. B. nur Knoten ohne Kanten oder eine hierarchische Ansicht) verwendet wird.

### BUG-DEV-05: Lack of type safety in `graph.addEvent` method
- **schwere Wassermittel:**
- **Miejsce:** `src/graph.ts` – `addEdge` method, lines 291-295
- **توضیح:** Die Methode `addEdge` akzeptiert Parameter vom Typ `string` für `from`, `to` und `type`, überprüft jedoch nicht, ob die referenzierten Knoten tatsächlich existieren. Dies kann zu „dangling edges“ führen, die auf nicht vorhandene Knoten zeigen. Obwohl die `getGraph()`-Methode solche Kanten filtert (Zeile 308), wäre es sicherer, bei der Hinzufügung zu überprüfen.
- **提案の修正:** In `addEdge` eine Überprüfung hinzufügen, ob `from` und `to` Knoten im `this.nodes` Map existieren, und falls nicht, entweder einen Fehler werfen oder stillschweigend zurückgeben (abhängig von der gewünschten Strenge).

### BUG-DEV-06: Inconsistent error handling in graph viewer
- **schwere Wassermittel:**
- **Miejsce:** `src/graph-viewer.html` – `loadSnapshot()` function, lines 273-297
- **توضیح:** Die `loadSnapshot()`-Funktion versucht, Daten aus vier Quellen zu laden: Live-Hook, Inline-Daten, Query-String und Demo-Beispiel. Wenn alle Quellen fehlschlagen, wird `setData(null)` aufgerufen, was zu einem leeren Graphen führt. Allerdings gibt es keine Benachrichtigung für den Benutzer, warum keine Daten geladen werden konnten (z. B. weil der DevTools-Hook nicht installiert ist oder die Query-String-Daten ungültig sind). Dies kann die Fehlerbehebung erschweren.
- **提案の修正:** Fehlermeldungen protokollieren und dem Benutzer im UI anzeigen (z. B. über das `toast`-Element oder eine spezielle Fehlermeldung im Viewer), warum keine Daten geladen werden konnten.

### BUG-DEV-07: Potential XSS in graph viewer via node labels
- **schwere Wassermittel:**
- **Miejsce:** `src/graph-viewer.html` – `render()` function, lines 449-451 and 455-456
- **توضیح:** Die Knotenbezeichnungen werden direkt als `textContent` von SVG-Text-Elementen gesetzt (Zeile 451: `lbl.textContent = n.label;` und Zeile 456: `sub.textContent = TYPE_FA[n.type] || n.type;`). Obwohl `textContent` grundsätzlich sicher ist und keine HTML-Interpretation zulässt, könnten schädliche Skripte in anderen Teilen des SVG (z. B. in Attributen) eingefügt werden, wenn die Bezeichnung irgendwie in ein Attribut kopiert wird. Derzeit scheint dies nicht der Fall zu sein, aber zukünftige Änderungen könnten dieses Risiko einführen.
- **提案の修正:** Obwohl das aktuelle Risiko gering ist, wäre es gute Praxis, die Bezeichnungen zu säubern, bevor sie verwendet werden, insbesondere wenn sie je nach Verwendungskontext in Attribute gelangen könnten. Eine einfache Funktion zur Escape von HTML-Entitäten könnte hinzugefügt werden.

### BUG-DEV-08: DevTools hook does not clean up event listeners on uninstall
- **schwere Wassermittel:**
- **Miejsce:** `src/hook.ts` – `cleanupDevtools()` function, lines 258-270
- **توضیح:** Die `cleanupDevtools()`-Funktion löscht den Hook von `window.__ZENITH__` und löscht die internen Speicher, entfernt jedoch keine Event Listener, die möglicherweise über das Hook registriert wurden (z. B. über `onStateChange`). Obwohl der Hook selbst entfernt wird, könnten die über `onStateChange` registrierten Callback-Funktionen weiterhin im Speicher gehalten werden, wenn sie irgendwo anders referenziert werden.
- **提案の修正:** Die `cleanupDevtools()`-Funktion erweitern, um alle über das Hook registrierten Event Listener zu entfernen. Dies könnte durch Speichern der Registrierungen in einer internen Struktur und anschließendem Entfernen während der Aufräumung erreicht werden.

---

## ۴. پیشنهادات ارتقا

### IMP-DEV-01: HMR-Unterstützung verbessern
- **دلیل:** Speicherlecks während Hot Module Replacement verhindern.
- **پیاده‌سازی:** MecHANismus zur Erkennung von HMR-Ereignissen (z. B. über `import.meta.hot` bei Vite) implementieren und bei Bedarf die internen Collections (`staticFors`, `destroyedResources`, `cacheStats`, `activeSSRStores`) leeren.

### IMP-DEV-02: Robuste Erkennung des Entwicklungsmodus
- **دلیل:** Konsistente Erkennung des Entwicklungsmodus über verschiedene Umgebungen hinweg sicherstellen.
- **پیاده‌سازی:** Eine Build-Zeit-Variable (z. B. über `define:` von Vite oder `DefinePlugin` von Webpack) verwenden, um den Entwicklungsmodus zu bestimmen, mit Fallbacks auf mehrere Signale wie URL-Parameter oder Hostname-Überprüfung.

### IMP-DEV-03: Automatische Bereinigung beim Seitenwechsel
- **دلیل:** Sicherstellen, dass Ressourcen freigegeben werden, wenn die Seite verlassen wird oder unsichtbar wird.
- **پیاده‌سازی:** Ein `beforeunload` oder `visibilitychange` Event Listener hinzufügen, der `cleanupDevtools()` aufruft, wenn die Seite verlassen wird oder unsichtbar wird.

### IMP-DEV-04: Leistung des Graph-Viewers für große Graphen verbessern
- **دلیل:** Benutzererfahrung bei der Visualisierung großer Abhängigkeitsgraphen verbessern.
- **پیاده‌سازی:** Zoom- und Pan-Funktionen mit virtuellem Rendern (nur sichtbare Knoten und Kanten rendern) implementieren. Alternativ eine Schwelle einführen, ab der eine vereinfachte Darstellung verwendet wird.

### IMP-DEV-05: Type Safety im Graph erhöhen
- **دلیل:** „Dangling edges“ verhindern und die Robustheit erhöhen.
- **پیاده‌سازی:** In `addEdge` eine Überprüfung hinzufügen, ob die referenzierten Knoten existieren, und entsprechend reagieren.

### IMP-DEV-06: Besseres Fehler-Handling im Graph-Viewer
- **دلیل:** Fehlerbehebung erleichtern und dem Benutzer klare Rückmeldung geben.
- **پیاده‌سازی:** Fehlermeldungen protokollieren und im UI anzeigen (z. B. über ein Toast-Element oder eine spezielle Fehlermeldung), warum keine Daten geladen werden konnten.

### IMP-DEV-07: Schutz vor potenziellen XSS im Graph-Viewer
- **دلیل:** Zukünftige Änderungen sicherer machen.
- **پیاده‌سازی:** Obwohl das aktuelle Risiko gering ist, die Knotenbezeichnungen vor der Verwendung säubern (z. B. mit einer einfachen HTML-Escape-Funktion), falls sie jemals in Attributen verwendet werden könnten.

### IMP-DEV-08: Ereignis-Listener beim Deinstallieren bereinigen
- **دلیل:** Sicherstellen, dass keine verwaisten Rückrufspeicher im Speicher verbleiben.
- **پیاده‌سازی:** Die `cleanupDevtools()`-Funktion erweitern, um alle über das Hook registrierten Ereignis-Listener zu entfernen (z. B. durch Speichern der Registrierungen in einer internen Struktur).

### IMP-DEV-09: Einheitliches Logging und Debugging hinzufügen
- **دلیل:** Entwicklern beim Debuggen von DevTools-Problemen helfen.
- **پیاده‌سازی:** Ein optionales Logging-System hinzufügen, das über eine Konfigurationsvariable aktiviert werden kann, um wichtige Vorgänge (wie das Hinzufügen von Knoten/Kanten, das Löschen des Graphen usw.) zu protokollieren.

### IMP-DEV-10: Unterstützung für benutzerdefinierte Themen im Graph-Viewer
- **دلیل:** Benutzern ermöglichen, das Erscheinungsbild des Viewers an ihre Präferenzen anzupassen.
- **پیاده‌سازی:** CSS-Variablen für Farben usw. bereits verwendet werden; eine Möglichkeit hinzufügen, diese Variablen über URL-Parameter oder eine Einstellungsseite zu überschreiben.

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **state** | `getAllSignals`, `getStateTimeline`, `onStateChange` verwendet | ✅ esencial |
| **components** | `componentRegistry` wird verwendet | ✅ esencial |
| **runtime** | Der Hook wird über `window.__ZENITH__` vom Runtime und der Erweiterung verwendet | ✅ esencial |
| **compiler** | Der Compiler generiert Code, der den Hook verwendet (z. B. für `recordRead` usw.) | ✅ esencial |
| **ssr** | Der Hook wird in SSR-Umgebungen nicht verwendet (no-op), aber SSR-bezogene Funktionen wie `recordSSRStore` existieren | ✅ optional |
| **events** | Der Hook verwendet keine Ereignisdelegation direkt, aber das Runtime verwendet die Ereignisdelegation, um Ereignisse an den Hook zu melden | ✅ indirect |
| **actions** | Der Hook bietet keine direkte Aktion-Verarbeitung, aber Aktionen können Zustandsänderungen auslösen, die dann, die dann vom Haas getracked werden | ✅ indirect |
| **devtools-extension** | Diese Erweiterung hängt direkt von diesem Paket ab (verwendet `window.__ZENITH__`) | ✅ esencial |
| **vite-plugin** | Das Vite-Plugin könnte dieses Paket verwenden, um devtools-spezifische Funktionalität hinzuzufügen | ✅ optional |

---

## ۶. نتیجه‌گیری کلی

پکیج `devtools` یک peças کلیدی در مجموعة أدوات توسعه‌دهنده Zenith است که امکان监视和调试状态、组件和依赖关系图提供します。このパッケージは well 構造化されており、明確な関心の分離（フック、グラフ管理、ビューアー）があり、本番環境でのオーバーヘッドがゼロであるという点で優れています。

このパッケージの長所：
- 良好な構造とモジュール設計
- 本番環境でのオーバーヘッドゼロ（DevTools が無効な場合）
- 包括的な機能セット（シグナル、エフェクト、ディレクティブ、DOM、v1.0 の機能）
- 良いドキュメントとコメント（特に機能とバグ修正のコメント）
- 慎重な設計（例えば、SSR セーフ、冪等性）

主要な改善点：
- HMR 中のメモリリークの防止
- 開発モード検出の堅牢化
- ページアンロード時の自動クリーンアップ
- 大規模グラフのためのパフォーマンス最適化
- グラフの型安全性の向上
- ビューアのエラーハンドリングの改善
- 潜在的な XSS への保護
- イベントリスナーのクリーンアップ
- 统一된 로깅 및 디버깅 지원
- 그래프 뷰어의 사용자 지정 테마 지원

**امتیاز کلی: 8/۱۰** (بسيك ആभ arquitectura é bo にスペースが改善と最適化のためにある)

---
*گزارش توسط Claude Code - تاریخ: 2026-07-01*