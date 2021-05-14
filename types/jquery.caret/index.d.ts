interface JQuery {
  getCaretPosition: () => number;
  replaceTextAt: (
    start: number,
    end: number,
    replacementText: string
  ) => JQuery<HTMLElement>;
  insertAtCaret: (text: string, opts?: never) => false | JQuery<HTMLElement>;
  getSelectedText: () => string | Selection;
  setCaretPosition: (start: number, end: number) => JQuery<HTMLElement>;
}
