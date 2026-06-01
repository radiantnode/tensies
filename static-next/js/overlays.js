// Winner/loser overlay. The real overlay is built with the winner view; these
// stubs let the roll choreography (which can finish on a winning roll) complete
// without it. hideWinner is real so a stray open dialog can always be closed.
export function hideWinner() {
  const w = document.getElementById('winner-overlay');
  if (w && w.open) w.close();
}

export function showWinner(/* name, target, round, isLoser */) {
  // Built in the winner view.
}
