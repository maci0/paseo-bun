import ts from "typescript";

// Rewrite syntax nodes only: plugin source strings and comments must stay intact.
export function rebaseModuleUrl(source: string, relative: string): string {
  const file = ts.createSourceFile(
    relative,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const spans: Array<[number, number]> = [];
  function visit(node: ts.Node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isMetaProperty(node.expression) &&
      node.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
      node.name.text === "url"
    ) {
      spans.push([node.getStart(file), node.end]);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  for (const [start, end] of spans.toReversed()) {
    source =
      source.slice(0, start) +
      `(globalThis.paseoModuleUrl ? globalThis.paseoModuleUrl(${JSON.stringify(relative)}) : import.meta.url)` +
      source.slice(end);
  }
  return source;
}
