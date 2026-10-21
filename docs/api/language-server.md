# API Reference: `@zenith/language-server`

- **محیط هدف (`zenith.target`)**: `node`
- **مسیر بسته**: `packages/language-server`
- **README پکیج**: [`packages/language-server/README.md`](../../packages/language-server/README.md)

## نمادهای صادرشده (Public Surface)

| نام نماد | نوع (Kind) | سطح پایداری |
|----------|------------|-------------|
| `analyzeZenithDocument` | `function` | `@public` |
| `attachStdioTransport` | `function` | `@public` |
| `closestDirectiveName` | `function` | `@public` |
| `codeActionsFor` | `function` | `@public` |
| `completeAt` | `function` | `@public` |
| `completeDirectives` | `function` | `@public` |
| `completeSignals` | `function` | `@public` |
| `computeDiagnostics` | `function` | `@public` |
| `createDocumentStore` | `function` | `@public` |
| `createLspMessageBuffer` | `function` | `@public` |
| `createServerLifecycle` | `function` | `@public` |
| `createZenithLanguageServer` | `function` | `@public` |
| `createZenithServerCore` | `function` | `@public` |
| `decodeLspMessages` | `function` | `@public` |
| `decodeSemanticTokens` | `function` | `@public` |
| `DEPRECATED_IDENTIFIER_RENAMES` | `const` | `@public` |
| `describeDirective` | `function` | `@public` |
| `directiveBaseName` | `function` | `@public` |
| `directiveKindOf` | `function` | `@public` |
| `documentLinks` | `function` | `@public` |
| `documentSymbols` | `function` | `@public` |
| `encodeLspMessage` | `function` | `@public` |
| `findSignalDefinition` | `function` | `@public` |
| `findSignalReferences` | `function` | `@public` |
| `findSignalReferencesInDocuments` | `function` | `@public` |
| `foldingRanges` | `function` | `@public` |
| `formatDocument` | `function` | `@public` |
| `hoverAt` | `function` | `@public` |
| `isKnownDirective` | `function` | `@public` |
| `JsonRpcNotification` | `interface` | `@public` |
| `JsonRpcRequest` | `interface` | `@public` |
| `JsonRpcResponse` | `interface` | `@public` |
| `KNOWN_DIRECTIVES` | `const` | `@public` |
| `listKnownDirectives` | `function` | `@public` |
| `LSP_COMPLETION_ITEM_KIND` | `const` | `@public` |
| `LSP_DIAGNOSTIC_SEVERITY` | `const` | `@public` |
| `LSP_DIAGNOSTIC_TAG` | `const` | `@public` |
| `LSP_ERROR_CODES` | `const` | `@public` |
| `LSP_METHODS` | `const` | `@public` |
| `LSP_SEMANTIC_TOKENS_LEGEND` | `const` | `@public` |
| `LSP_SYMBOL_KIND` | `const` | `@public` |
| `LspCodeAction` | `interface` | `@public` |
| `LspCompletionItem` | `interface` | `@public` |
| `LspCompletionItemKind` | `type` | `@public` |
| `LspDiagnostic` | `interface` | `@public` |
| `LspDiagnosticSeverity` | `type` | `@public` |
| `LspDiagnosticTag` | `type` | `@public` |
| `LspDocumentLink` | `interface` | `@public` |
| `LspDocumentSymbol` | `interface` | `@public` |
| `LspDocumentUri` | `type` | `@public` |
| `LspFoldingRange` | `interface` | `@public` |
| `LspFormattingOptions` | `interface` | `@public` |
| `LspHover` | `interface` | `@public` |
| `LspInitializeResult` | `interface` | `@public` |
| `LspLocation` | `interface` | `@public` |
| `LspMarkupContent` | `interface` | `@public` |
| `LspMessageBuffer` | `interface` | `@public` |
| `lspOffsetAt` | `function` | `@public` |
| `LspPosition` | `interface` | `@public` |
| `lspPositionAt` | `function` | `@public` |
| `LspPublishDiagnosticsParams` | `interface` | `@public` |
| `LspRange` | `interface` | `@public` |
| `LspReferenceContext` | `interface` | `@public` |
| `LspSemanticTokens` | `interface` | `@public` |
| `LspSemanticTokensLegend` | `interface` | `@public` |
| `LspServerCapabilities` | `interface` | `@public` |
| `LspStdioTransport` | `interface` | `@public` |
| `LspSymbolKind` | `type` | `@public` |
| `LspTextDocumentItem` | `interface` | `@public` |
| `LspTextDocumentPositionParams` | `interface` | `@public` |
| `LspTextEdit` | `interface` | `@public` |
| `LspVersionedTextDocumentIdentifier` | `interface` | `@public` |
| `renameSignal` | `function` | `@public` |
| `scanSignalOccurrences` | `function` | `@public` |
| `scanZenithAttributes` | `function` | `@public` |
| `semanticTokensFor` | `function` | `@public` |
| `signalNameAt` | `function` | `@public` |
| `signalReferenceAtPosition` | `function` | `@public` |
| `ZenithAttributeScan` | `interface` | `@public` |
| `ZenithDecodedSemanticToken` | `interface` | `@public` |
| `ZenithDiagnosticData` | `interface` | `@public` |
| `ZenithDiagnosticsOptions` | `interface` | `@public` |
| `ZenithDirectiveInfo` | `interface` | `@public` |
| `ZenithDirectiveKind` | `type` | `@public` |
| `ZenithDocumentAnalysis` | `interface` | `@public` |
| `ZenithDocumentStore` | `interface` | `@public` |
| `ZenithFormatOptions` | `interface` | `@public` |
| `ZenithGrepMatch` | `interface` | `@public` |
| `ZenithLanguageServer` | `interface` | `@public` |
| `ZenithLanguageServerCore` | `interface` | `@public` |
| `ZenithLanguageServerOptions` | `interface` | `@public` |
| `ZenithRenameOutcome` | `type` | `@public` |
| `ZenithSignalOccurrence` | `interface` | `@public` |
| `ZenithStdioTransportOptions` | `interface` | `@public` |
| `ZenithTextDocument` | `interface` | `@public` |
| `ZenithTextDocumentChange` | `interface` | `@public` |
