import { ShellSyntaxError } from "./errors";
import { tokenize } from "./lexer";
import type { Token, OperatorValue } from "./lexer";
import type {
  Assignment,
  AndOrList,
  LogicalOperator,
  Pipeline,
  RedirectOperator,
  Redirection,
  RedirectionTarget,
  Script,
  SimpleCommand,
  Word,
  WordPart,
} from "./ast";

const REDIRECT_OPERATORS: ReadonlySet<OperatorValue> = new Set([">", ">>", "<", ">&", "<&"]);
const ASSIGNMENT_NAME = /^([A-Za-z_][A-Za-z0-9_]*)=/;

function describeToken(token: Token): string {
  switch (token.type) {
    case "Word":
      return `単語(${wordToDebugString(token.word)})`;
    case "IoNumber":
      return `IOナンバー(${token.value})`;
    case "Operator":
      return `演算子'${token.value}'`;
    case "Newline":
      return "改行";
    case "EOF":
      return "入力の終端";
  }
}

function wordToDebugString(word: Word): string {
  return word.parts
    .map((part) => {
      switch (part.type) {
        case "Literal":
          return part.value;
        case "SingleQuoted":
          return `'${part.value}'`;
        case "DoubleQuoted":
          return '"..."';
        case "Variable":
          return part.braced ? `\${${part.name}}` : "$" + part.name;
        case "CommandSubstitution":
          return "$(...)";
        case "ArithmeticExpansion":
          return "$((...))";
      }
    })
    .join("");
}

class TokenStream {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  peek(): Token {
    return this.tokens[this.pos];
  }

  next(): Token {
    return this.tokens[this.pos++];
  }

  skipNewlines(): void {
    while (this.peek().type === "Newline") this.next();
  }

  expectEOF(): void {
    const token = this.peek();
    if (token.type !== "EOF") {
      throw new ShellSyntaxError(`予期しないトークンです: ${describeToken(token)}`, token.position);
    }
  }
}

/** シェルスクリプトの文字列を解析し、ASTのルートである `Script` を返す。 */
export function parseScript(source: string): Script {
  const tokens = tokenize(source, parseScript);
  const stream = new TokenStream(tokens);
  const script = parseScriptBody(stream);
  stream.expectEOF();
  return script;
}

function parseScriptBody(stream: TokenStream): Script {
  const commands: AndOrList[] = [];
  stream.skipNewlines();

  while (stream.peek().type !== "EOF") {
    commands.push(parseAndOrList(stream));

    const token = stream.peek();
    if (token.type === "Operator" && token.value === ";") {
      stream.next();
      stream.skipNewlines();
      continue;
    }
    if (token.type === "Newline") {
      stream.skipNewlines();
      continue;
    }
    break;
  }

  return { type: "Script", commands };
}

function parseAndOrList(stream: TokenStream): AndOrList {
  const pipelines: Pipeline[] = [parsePipeline(stream)];
  const operators: LogicalOperator[] = [];

  while (true) {
    const token = stream.peek();
    if (token.type === "Operator" && (token.value === "&&" || token.value === "||")) {
      stream.next();
      stream.skipNewlines();
      operators.push(token.value);
      pipelines.push(parsePipeline(stream));
      continue;
    }
    break;
  }

  return { type: "AndOrList", pipelines, operators };
}

function parsePipeline(stream: TokenStream): Pipeline {
  const commands: SimpleCommand[] = [parseSimpleCommand(stream)];

  while (true) {
    const token = stream.peek();
    if (token.type === "Operator" && token.value === "|") {
      stream.next();
      stream.skipNewlines();
      commands.push(parseSimpleCommand(stream));
      continue;
    }
    break;
  }

  return { type: "Pipeline", commands };
}

function parseSimpleCommand(stream: TokenStream): SimpleCommand {
  const assignments: Assignment[] = [];
  const words: Word[] = [];
  const redirections: Redirection[] = [];
  let seenCommandName = false;

  while (true) {
    const token = stream.peek();

    if (token.type === "IoNumber" || (token.type === "Operator" && REDIRECT_OPERATORS.has(token.value))) {
      redirections.push(parseRedirection(stream));
      continue;
    }
    if (token.type === "Word") {
      if (!seenCommandName) {
        const assignment = tryParseAssignment(token.word);
        if (assignment) {
          assignments.push(assignment);
          stream.next();
          continue;
        }
      }
      words.push(token.word);
      seenCommandName = true;
      stream.next();
      continue;
    }
    break;
  }

  if (words.length === 0 && assignments.length === 0 && redirections.length === 0) {
    const token = stream.peek();
    throw new ShellSyntaxError(`コマンドが必要です: ${describeToken(token)}`, token.position);
  }

  return { type: "SimpleCommand", assignments, words, redirections };
}

function tryParseAssignment(word: Word): Assignment | null {
  const first = word.parts[0];
  if (!first || first.type !== "Literal") return null;

  const match = ASSIGNMENT_NAME.exec(first.value);
  if (!match) return null;

  const name = match[1];
  const restOfFirst = first.value.slice(match[0].length);
  const valueParts: WordPart[] = [];
  if (restOfFirst.length > 0) valueParts.push({ type: "Literal", value: restOfFirst });
  valueParts.push(...word.parts.slice(1));

  return { type: "Assignment", name, value: { type: "Word", parts: valueParts } };
}

function parseRedirection(stream: TokenStream): Redirection {
  let fd: number | null = null;
  if (stream.peek().type === "IoNumber") {
    const token = stream.next();
    if (token.type === "IoNumber") fd = token.value;
  }

  const opToken = stream.next();
  if (opToken.type !== "Operator" || !REDIRECT_OPERATORS.has(opToken.value)) {
    throw new ShellSyntaxError(`リダイレクト演算子が必要です: ${describeToken(opToken)}`, opToken.position);
  }
  const operator = opToken.value as RedirectOperator;
  const defaultFd = operator === "<" || operator === "<&" ? 0 : 1;

  const targetToken = stream.next();
  if (targetToken.type !== "Word") {
    throw new ShellSyntaxError(
      `リダイレクト先が必要です: ${describeToken(targetToken)}`,
      targetToken.position,
    );
  }

  const target = resolveRedirectionTarget(operator, targetToken.word, targetToken.position);
  return { type: "Redirection", fd: fd ?? defaultFd, operator, target };
}

function resolveRedirectionTarget(
  operator: RedirectOperator,
  word: Word,
  position: number,
): RedirectionTarget {
  if (operator !== ">&" && operator !== "<&") {
    return { type: "File", word };
  }

  const plainLiteral =
    word.parts.length === 1 && word.parts[0].type === "Literal" ? word.parts[0].value : null;
  if (plainLiteral !== null && /^\d+$/.test(plainLiteral)) {
    return { type: "FdDuplicate", fd: Number(plainLiteral) };
  }

  throw new ShellSyntaxError(
    `'${operator}'の対象はファイルディスクリプタ番号である必要があります: ${wordToDebugString(word)}`,
    position,
  );
}
