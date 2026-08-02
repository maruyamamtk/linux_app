// トークン列 → AST(再帰下降パーサ)。
// 文法(対応範囲のみ):
//   script      := (separator* and_or separator?)*
//   and_or      := pipeline (('&&' | '||') newline* pipeline)*
//   pipeline    := command ('|' newline* command)*
//   command     := simple_command | if_clause | for_clause | while_clause | case_clause | function_def
//   simple_command := (assignment | redirect)* word? (word | redirect)*
//   compound_list := (separator* and_or separator?)+   ※終端キーワードの手前まで
//   if_clause   := 'if' compound_list 'then' compound_list
//                  ('elif' compound_list 'then' compound_list)*
//                  ('else' compound_list)? 'fi'
//   for_clause  := 'for' NAME ('in' word*)? separator* 'do' compound_list 'done'
//   while_clause := 'while' compound_list 'do' compound_list 'done'
//   case_clause := 'case' word 'in' ('(' ? word ('|' word)* ')' compound_list ';;'?)* 'esac'
//   function_def := NAME '(' ')' brace_group | 'function' NAME ('(' ')')? brace_group
//   brace_group := '{' compound_list '}'
//   separator   := ';' | '\n'
import type {
  AndOrList,
  Assignment,
  CaseClause,
  CaseItem,
  Command,
  ForClause,
  FunctionDefinition,
  IfBranch,
  IfClause,
  LogicalOperator,
  Pipeline,
  Redirect,
  Script,
  ScriptItem,
  ScriptItemSeparator,
  SimpleCommand,
  WhileClause,
  Word,
  WordPart,
} from "./ast";
import { ShellSyntaxError } from "./errors";
import type { OperatorValue, Token, WordToken } from "./lexer";
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
  const commands: Command[] = [parseCommand(stream)];

  for (;;) {
    const t = stream.peek();
    if (t.type === "OPERATOR" && t.value === "|") {
      stream.next();
      skipNewlines(stream);
      commands.push(parseCommand(stream));
      continue;
    }
    break;
  }

  return { type: "Pipeline", commands };
}

/** パイプラインの1段を構成する要素をパースする(単純コマンド・制御構造・関数定義)。 */
function parseCommand(stream: TokenStream): Command {
  const t = stream.peek();
  if (t.type === "WORD") {
    switch (t.raw) {
      case "if":
        return parseIfClause(stream);
      case "for":
        return parseForClause(stream);
      case "while":
        return parseWhileClause(stream);
      case "case":
        return parseCaseClause(stream);
      case "function":
        return parseFunctionDefinition(stream);
      default:
        break;
    }
    if (isFunctionDefLookahead(stream)) return parseFunctionDefinition(stream);
  }
  return parseSimpleCommand(stream);
}

/** 現在位置が `NAME ( )` の並びであるかを判定する(関数定義の短縮形)。 */
function isFunctionDefLookahead(stream: TokenStream): boolean {
  const t = stream.peek();
  if (t.type !== "WORD" || RESERVED_WORDS.has(t.raw) || !isValidName(t.raw)) return false;
  return isOperator(stream, "(", 1) && isOperator(stream, ")", 2);
}

function isValidName(s: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
}

/** 現在位置のトークンが、クォートされていない特定のキーワード(予約語)であるかを判定する。 */
function peekKeyword(stream: TokenStream, keyword: string): boolean {
  const t = stream.peek();
  return t.type === "WORD" && t.raw === keyword;
}

/** 現在位置のキーワードを検証して読み進める。異なる場合は構文エラー。 */
function expectKeyword(stream: TokenStream, keyword: string): void {
  const t = stream.peek();
  if (!(t.type === "WORD" && t.raw === keyword)) {
    throw new ShellSyntaxError(`"${keyword}" が必要です`, t.start);
  }
  stream.next();
}

function expectOperator(stream: TokenStream, value: OperatorValue): void {
  const t = stream.peek();
  if (!(t.type === "OPERATOR" && t.value === value)) {
    throw new ShellSyntaxError(`"${value}" が必要です`, t.start);
  }
  stream.next();
}

function isOperator(stream: TokenStream, value: OperatorValue, offset = 0): boolean {
  const t = stream.peek(offset);
  return t.type === "OPERATOR" && t.value === value;
}

/**
 * `;` または改行で区切られた文の並び(compound_list)をパースする。
 * `wordTerminators` に含まれるキーワード(`then` `do` `fi` 等)の手前、または
 * `stopAtDoubleSemi` が true の場合は `;;` の手前で読み進めを止める(いずれも消費しない)。
 */
function parseCompoundList(
  stream: TokenStream,
  wordTerminators: ReadonlySet<string>,
  stopAtDoubleSemi = false,
): ScriptItem[] {
  const body: ScriptItem[] = [];

  for (;;) {
    while (isSeparatorToken(stream.peek())) stream.next();

    const t = stream.peek();
    if (t.type === "EOF") {
      throw new ShellSyntaxError(
        `入力の終わりに達しましたが、"${[...wordTerminators].join('" / "')}" が必要です`,
        t.start,
      );
    }
    if (t.type === "WORD" && wordTerminators.has(t.raw)) break;
    if (stopAtDoubleSemi && t.type === "OPERATOR" && t.value === ";;") break;

    const andOr = parseAndOrList(stream);
    const sepTok = stream.peek();
    let separator: ScriptItemSeparator | undefined;
    if (sepTok.type === "OPERATOR" && sepTok.value === ";") {
      stream.next();
      separator = ";";
    } else if (sepTok.type === "NEWLINE") {
      stream.next();
      separator = "\n";
    }
    body.push(separator ? { andOr, separator } : { andOr });
  }

  return body;
}

function parseIfClause(stream: TokenStream): IfClause {
  expectKeyword(stream, "if");
  const branches: IfBranch[] = [parseIfBranch(stream)];

  while (peekKeyword(stream, "elif")) {
    stream.next();
    branches.push(parseIfBranch(stream));
  }

  let elseBody: ScriptItem[] | undefined;
  if (peekKeyword(stream, "else")) {
    stream.next();
    elseBody = parseCompoundList(stream, new Set(["fi"]));
  }

  expectKeyword(stream, "fi");
  return { type: "IfClause", branches, elseBody };
}

function parseIfBranch(stream: TokenStream): IfBranch {
  const condition = parseCompoundList(stream, new Set(["then"]));
  expectKeyword(stream, "then");
  const body = parseCompoundList(stream, new Set(["elif", "else", "fi"]));
  return { condition, body };
}

function parseForClause(stream: TokenStream): ForClause {
  expectKeyword(stream, "for");
  const nameTok = stream.next();
  if (nameTok.type !== "WORD" || !isValidName(nameTok.raw)) {
    throw new ShellSyntaxError("forの変数名が不正です", nameTok.start);
  }

  skipNewlines(stream);

  let words: Word[] | undefined;
  if (peekKeyword(stream, "in")) {
    stream.next();
    words = [];
    while (stream.peek().type === "WORD") {
      words.push((stream.next() as WordToken).word);
    }
  }

  while (isSeparatorToken(stream.peek())) stream.next();

  const body = parseDoGroup(stream);
  return { type: "ForClause", varName: nameTok.raw, words, body };
}

function parseWhileClause(stream: TokenStream): WhileClause {
  expectKeyword(stream, "while");
  const condition = parseCompoundList(stream, new Set(["do"]));
  const body = parseDoGroup(stream);
  return { type: "WhileClause", condition, body };
}

function parseDoGroup(stream: TokenStream): ScriptItem[] {
  expectKeyword(stream, "do");
  const body = parseCompoundList(stream, new Set(["done"]));
  expectKeyword(stream, "done");
  return body;
}

function parseCaseClause(stream: TokenStream): CaseClause {
  expectKeyword(stream, "case");
  const wordTok = stream.next();
  if (wordTok.type !== "WORD") {
    throw new ShellSyntaxError("caseの対象語が必要です", wordTok.start);
  }
  skipNewlines(stream);
  expectKeyword(stream, "in");
  skipNewlines(stream);

  const items: CaseItem[] = [];
  while (!peekKeyword(stream, "esac")) {
    items.push(parseCaseItem(stream));
  }
  expectKeyword(stream, "esac");

  return { type: "CaseClause", word: wordTok.word, items };
}

function parseCaseItem(stream: TokenStream): CaseItem {
  if (isOperator(stream, "(")) stream.next();

  const patterns: Word[] = [];
  for (;;) {
    const t = stream.next();
    if (t.type !== "WORD") {
      throw new ShellSyntaxError("caseのパターンが必要です", t.start);
    }
    patterns.push(t.word);
    if (isOperator(stream, "|")) {
      stream.next();
      continue;
    }
    break;
  }
  expectOperator(stream, ")");
  skipNewlines(stream);

  const body = parseCompoundList(stream, new Set(["esac"]), true);

  if (isOperator(stream, ";;")) {
    stream.next();
    skipNewlines(stream);
  }

  return { patterns, body };
}

function parseFunctionDefinition(stream: TokenStream): FunctionDefinition {
  let usedKeyword = false;
  if (peekKeyword(stream, "function")) {
    stream.next();
    usedKeyword = true;
  }

  const nameTok = stream.next();
  if (nameTok.type !== "WORD" || RESERVED_WORDS.has(nameTok.raw) || !isValidName(nameTok.raw)) {
    throw new ShellSyntaxError("関数名が不正です", nameTok.start);
  }

  const hasParens = isOperator(stream, "(") && isOperator(stream, ")", 1);
  if (hasParens) {
    stream.next();
    stream.next();
  } else if (!usedKeyword) {
    throw new ShellSyntaxError("関数定義には () が必要です", nameTok.start);
  }

  skipNewlines(stream);
  const body = parseBraceGroupBody(stream);
  return { type: "FunctionDefinition", name: nameTok.raw, body };
}

function parseBraceGroupBody(stream: TokenStream): ScriptItem[] {
  expectKeyword(stream, "{");
  const body = parseCompoundList(stream, new Set(["}"]));
  expectKeyword(stream, "}");
  return body;
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
