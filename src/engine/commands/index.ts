export type { CommandContext, CommandHandler, CommandResult, MockProcess } from "./types";
export { commandRegistry, executeCommand, isKnownCommand, resolveCommand } from "./registry";
export { awkCommand } from "./awk";
export {
  cdCommand,
  cpCommand,
  lnCommand,
  lsCommand,
  mkdirCommand,
  mvCommand,
  pwdCommand,
  rmCommand,
  rmdirCommand,
  touchCommand,
} from "./fileOps";
export { sedCommand } from "./sed";
export { findCommand, helpCommand, locateCommand, manCommand, whichCommand } from "./search";
export { chmodCommand, parseMode, suCommand, sudoCommand } from "./permissions";
export { bgCommand, fgCommand, jobsCommand, killCommand, psCommand } from "./process";
export { grepCommand } from "./grep";
export {
  cutCommand,
  diffCommand,
  headCommand,
  sortCommand,
  tailCommand,
  trCommand,
  uniqCommand,
  wcCommand,
} from "./textProc";
