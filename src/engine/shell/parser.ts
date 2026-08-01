// トークン列 → AST(再帰下降パーサ)。
// 文法(対応範囲のみ):
//   script      := (separator* and_or separator?)*
//   and_or      := pipeline (('&&' | '||') newline* pipeline)*
//   pipeline    := simple_command ('|' newline* simple_command)*
//   simple_command := (assignment | redirect)* word? (word | redirect)*
//   separator   := ';' | '\n'
import type {
  AndOrList,
  Assignment,
  LogicalOperator,
  Pipeline,
  Redirect,
  Script,
  ScriptItem,
  ScriptItemSeparator,
  SimpleCommand,
  Word,
  WordPart,
} from "./ast";
import { ShellSyntaxError } from "./errors";
import type { OperatorValue, Token } from "./lexer";
import { tokenize } from "./lexer";

const RESERVED_WORDS = new Set([
  "if",
  "then",
  "elif",
  "else",
  "fi",
  "for",
  "in",
  "do",
  "done",
  "while",
  "until",
  "case",
  "esac",
  "function",
  "select",
  "time",
  "!",
  "{",
  "}",
]);

const ASSIGNMENT_RE = /^([A-Za-z_][A-Za-z0-9_]*)=/;

class TokenStream {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  peek(offset = 0): Token {
    const i = Math.min(this.index + offset, this.tokens.length - 1);
    return this.tokens[i];
  }

  next(): Token {
    const token = this.tokens[this.index];
    if (this.index < this.tokens.length - 1) this.index += 1;
    return token;
  }

  atEnd(): boolean {
    return this.peek().type === "EOF";
  }
}

export function parseScript(input: string): Script {
  const stream = new TokenStream(tokenize(input));
  const body: ScriptItem[] = [];

  while (!stream.atEnd()) {
    while (isSeparatorToken(stream.peek())) stream.next();
    if (stream.atEnd()) break;

    const andOr = parseAndOrList(stream);
    const t = stream.peek();
    let separator: ScriptItemSeparator | undefined;
    if (t.type === "OPERATOR" && t.value === ";") {
      stream.next();
      separator = ";";
    } else if (t.type === "NEWLINE") {
      stream.next();
      separator = "\n";
    }
    body.push(separator ? { andOr, separator } : { andOr });
  }

  return { type: "Script", body };
}

function isSeparatorToken(t: Token): boolean {
  return t.type === "NEWLINE" || (t.type === "OPERATOR" && t.value === ";");
}

function skipNewlines(stream: TokenStream): void {
  while (stream.peek().type === "NEWLINE") stream.next();
}

function parseAndOrList(stream: TokenStream): AndOrList {
  const pipelines: Pipeline[] = [parsePipeline(stream)];
  const operators: LogicalOperator[] = [];

  for (;;) {
    const t = stream.peek();
    if (t.type === "OPERATOR" && (t.value === "&&" || t.value === "||")) {
      stream.next();
      skipNewlines(stream);
      operators.push(t.value);
      pipelines.push(parsePipeline(stream));
      continue;
    }
    break;
  }

  return { type: "AndOrList", pipelines, operators };
}

function parsePipeline(stream: TokenStream): Pipeline {
  const commands: SimpleCommand[] = [parseSimpleCommand(stream)];

  for (;;) {
    const t = stream.peek();
    if (t.type === "OPERATOR" && t.value === "|") {
      stream.next();
      skipNewlines(stream);
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
  const redirects: Redirect[] = [];
  const startToken = stream.peek();
  let sawCommandWord = false;

  for (;;) {
    const t = stream.peek();

    if (t.type === "IO_NUMBER") {
      stream.next();
      redirects.push(parseRedirectAfterIoNumber(stream, t.value));
      continue;
    }

    if (t.type === "OPERATOR" && isRedirectOperator(t.value)) {
      stream.next();
      redirects.push(buildRedirect(stream, t.value, undefined));
      continue;
    }

    if (t.type === "WORD") {
      stream.next();
      if (!sawCommandWord) {
        const assignment = tryParseAssignment(t.word, t.raw);
        if (assignment) {
          assignments.push(assignment);
          continue;
        }
        sawCommandWord = true;
        checkNotReservedWord(t.raw, t.start);
      }
      words.push(t.word);
      continue;
    }

    break;
  }

  if (assignments.length === 0 && words.length === 0 && redirects.length === 0) {
    throw new ShellSyntaxError("コマンドが期待されていますが見つかりませんでした", startToken.start);
  }

  return { type: "SimpleCommand", assignments, words, redirects };
}

function checkNotReservedWord(raw: string, pos: number): void {
  if (RESERVED_WORDS.has(raw)) {
    throw new ShellSyntaxError(
      `制御構造・関数定義・予約語 "${raw}" には対応していません(本パーサのスコープ外です)`,
      pos,
    );
  }
}

function tryParseAssignment(word: Word, raw: string): Assignment | undefined {
  const match = ASSIGNMENT_RE.exec(raw);
  if (!match) return undefined;

  const name = match[1];
  const prefixLength = match[0].length;
  const firstPart = word.parts[0];
  if (firstPart.type !== "Text" || firstPart.value.length < prefixLength) {
    return undefined;
  }

  const restOfFirst = firstPart.value.slice(prefixLength);
  const remainingParts = word.parts.slice(1);
  const valueParts: WordPart[] =
    restOfFirst.length > 0 ? [{ type: "Text", value: restOfFirst }, ...remainingParts] : remainingParts;

  const value: Word = {
    type: "Word",
    parts: valueParts.length > 0 ? valueParts : [{ type: "Text", value: "" }],
  };

  return { type: "Assignment", name, value };
}

function isRedirectOperator(v: OperatorValue): boolean {
  return v === ">" || v === ">>" || v === "<" || v === ">&" || v === "<&";
}

function parseRedirectAfterIoNumber(stream: TokenStream, fd: number): Redirect {
  const t = stream.peek();
  if (t.type !== "OPERATOR" || !isRedirectOperator(t.value)) {
    throw new ShellSyntaxError("リダイレクト演算子(> >> < >& <&)が期待されています", t.start);
  }
  stream.next();
  return buildRedirect(stream, t.value, fd);
}

function buildRedirect(stream: TokenStream, op: OperatorValue, explicitFd: number | undefined): Redirect {
  const direction: "in" | "out" = op === "<" || op === "<&" ? "in" : "out";
  const append = op === ">>";
  const dup = op === ">&" || op === "<&";
  const fd = explicitFd ?? (direction === "in" ? 0 : 1);

  if (dup) {
    const t = stream.peek();
    if (t.type !== "WORD" || !/^[0-9]+$/.test(t.raw)) {
      throw new ShellSyntaxError(`${op} の後には複製先のファイルディスクリプタ番号(数字)が必要です`, t.start);
    }
    stream.next();
    return {
      type: "Redirect",
      fd,
      direction,
      append: false,
      dup: true,
      target: { kind: "fd", fd: Number(t.raw) },
    };
  }

  const t = stream.peek();
  if (t.type !== "WORD") {
    throw new ShellSyntaxError(`${op} の後にはリダイレクト先が必要です`, t.start);
  }
  stream.next();
  return {
    type: "Redirect",
    fd,
    direction,
    append,
    dup: false,
    target: { kind: "word", word: t.word },
  };
}
