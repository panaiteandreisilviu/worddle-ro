/**
 * Help-screen examples. Every guess/answer must exist in ro_RO/{n}.txt.
 * Focus tile must illustrate the case named in `title`.
 */
export const HELP_EXAMPLES = [
  {
    title: "Verde — loc corect",
    answer: "carte",
    guess: "carte",
    focus: 0,
    text: "Litera este exactă și pe poziția corectă. Exemplu: C din CARTE.",
  },
  {
    title: "Galben — altă poziție",
    answer: "carte",
    guess: "actor",
    focus: 0,
    text: "Litera există în cuvânt, dar pe altă poziție. Exemplu: A din ACTOR vs CARTE.",
  },
  {
    title: "Violet — diacritic pe loc",
    answer: "pâine",
    guess: "parte",
    focus: 1,
    text: "A pe locul lui Â: același grup diacritic, forma greșită. Exemplu: A din PARTE vs Â din PÂINE.",
  },
  {
    title: "Gri — absent",
    answer: "carte",
    guess: "noroc",
    focus: 0,
    text: "Litera nu apare deloc în cuvânt (nici ca variantă cu diacritic). Exemplu: N din NOROC vs CARTE.",
  },
  {
    title: "Gri + badge violet",
    answer: "pâine",
    guess: "abate",
    focus: 0,
    text: "A nu e pe loc și nu apare exact, dar Â din același grup e în altă parte → gri cu +1 violet.",
  },
  {
    title: "Galben + badge galben",
    answer: "abate",
    guess: "acela",
    focus: 4,
    text: "Galben acoperă prima apariție în altă parte; +N galben sunt aparițiile în plus. A din ACELA vs ABATE → +1.",
  },
  {
    title: "Galben + badge violet",
    answer: "tăiat",
    guess: "pastă",
    focus: 4,
    text: "Ă există exact în altă parte (galben) și e înrudit cu A din răspuns (+1 violet).",
  },
  {
    title: "Violet + badge galben",
    answer: "tăiat",
    guess: "pastă",
    focus: 1,
    text: "A pe locul lui Ă (violet) și mai există un A exact în altă parte (+1 galben).",
  },
  {
    title: "Violet + badge violet",
    answer: "seară",
    guess: "adânc",
    focus: 2,
    text: "Â pe locul lui A (violet) și Ă din același grup e în altă parte (+1 violet).",
  },
  {
    title: "Violet + badge-uri galben și violet",
    answer: "amară",
    guess: "plăti",
    focus: 2,
    text: "Ă pe locul lui A (violet), mai există un Ă exact în altă parte (+1 galben) și un A înrudit (+1 violet).",
  },
  {
    title: "Verde + badge galben",
    answer: "asalt",
    guess: "amant",
    focus: 0,
    text: "A e corect pe loc (verde) și mai apare exact în altă parte (+1 galben).",
  },
  {
    title: "Verde + badge violet",
    answer: "mânia",
    guess: "sânge",
    focus: 1,
    text: "Â e corect pe loc (verde) și Ă din același grup e în altă parte (+1 violet).",
  },
  {
    title: "Verde + badge-uri galben și violet",
    answer: "alamă",
    guess: "aliat",
    focus: 0,
    text: "A e corect pe loc (verde), mai există un A exact în altă parte (+1 galben) și un Ă înrudit (+1 violet).",
  },
  {
    title: "Galben + badge-uri galben și violet",
    answer: "alamă",
    guess: "iarnă",
    focus: 1,
    text: "A e pe altă poziție (galben); +1 galben = încă o apariție exactă, +1 violet = Ă înrudit în altă parte.",
  },
];
