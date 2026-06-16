# 🎲 dicebeacon

A **standalone, publicly-verifiable dice seeder**. Derive dice from randomness
the operator *cannot control* — and let anyone re-derive them from scratch, in
their own browser, trusting no server.

It knows nothing about any game. You give it a recipe; it gives you dice and a
proof. Tensies is one consumer; it could seed anything.

```bash
node cli/beacon.mjs demo          # full commit → reveal → verify, offline
npm test                          # 14 tests, zero dependencies
```

---

## Why this exists: "the house literally cannot rig it"

That claim decomposes into four properties. **Every source is graded on all
four, honestly, and the grade ships in the commitment and the verifier output.**
This is the heart of the framework — it refuses to let a pretty-but-predictable
source masquerade as a security anchor.

| Property | The question | If you skip it… |
|---|---|---|
| **Unpredictable** | Is the value unknown to *everyone* at commit time? | Operator computes outcomes early and cherry-picks |
| **Uninfluenceable** | Can the operator *nudge* it (grind / withhold / retry)? | Bias, even without secrecy |
| **Verifiable** | Can a third party independently re-derive it? | "Trust me" |
| **Live** | Is it reliably available on demand? | Games stall |

## The architecture: anchor + garnish

Security comes from **one cryptographically-sound anchor (drand)**. Everything
else is **narrative garnish** — sources that make the seed feel cosmic and tell a
story, but are either predictable or operator-spoofable, so they ride *alongside*
the anchor and never carry the fairness guarantee.

```
EntropySource[]  →  combine()  →  expand()      →  rollDice()
  (plugins)         SHA-256       SHA-256 CTR      rejection sampling
      │             domain-sep    deterministic    (no modulo bias)
      └── each ships grade{} + verify()
                         wrapped in a commit → reveal envelope
```

Four tiny, independently-tested layers:

- **`combine(domain, parts)`** — length-prefixed, id-tagged, domain-separated
  SHA-256 over all observations → a 32-byte seed. Canonical, so a verifier
  rebuilds the exact pre-image; no source can be slid into another's field.
- **`ByteReader` / `expand`** — `block_i = SHA-256(seed ‖ i)`, a deterministic
  byte stream identical in Node and the browser.
- **`rollDice(seed, n, sides)`** — rejection sampling, so `byte % 6` bias is gone
  and every face is *exactly* equiprobable. (The bit people get wrong.)
- **commit → reveal → verify envelope** — the protocol below.

### Why SHA-256 only

So the verifier runs **client-side in any browser with zero dependencies**
(`crypto.subtle.digest('SHA-256', …)` exists everywhere). It's also the native
language of the strongest sources: drand randomness *is* `SHA-256(signature)`,
Bitcoin is `SHA-256d`.

## The commit–reveal protocol (what makes it unforgeable)

1. **Commit.** Before the game, publish a recipe: which sources, which *future*
   refs (drand round `R`, Bitcoin height `H`), the dice shape — and its hash.
   At this moment round `R` **does not exist**, so nobody, operator included,
   knows the outcome.
2. **Reveal.** After the beacon publishes `R`, fetch every source, `combine` →
   seed, `expand` → dice. The seed is now *forced*; the operator never had a free
   parameter.
3. **Verify.** Anyone re-runs the whole thing from the reveal alone and confirms
   the commitment hash, every source, the seed, and the dice.

This holds even if *every garnish is operator-spoofable*, because drand alone
supplies unpredictability + unriggability.

```bash
beacon commit --game G --drand-round 29591537 --bitcoin-height 800100 --starlink
#   → commitment.json   (publish/timestamp the printed hash NOW)
beacon reveal commitment.json > reveal.json   # after round 29591537 lands
beacon verify reveal.json <commitment-hash>   # exit 0 = provably fair
```

Open `web/verify.html`, paste a `reveal.json`, and the `<dice-verifier>` element
re-derives the dice on the visitor's own device.

## Source catalog (graded honestly)

| Source | Role | unpred. | uninfl. | verif. | Notes |
|---|---|:-:|:-:|:-:|---|
| **drand** | **anchor** | 3 | 3 | 3 | League of Entropy threshold-BLS beacon. The load-bearing source. |
| **bitcoin** | co-anchor | 3 | 2 | 3 | Future block hash; diversifies trust away from drand. Miner-withhold-grind caveat (costs a block reward/try). |
| **starlink** | garnish | **0** | 1 | 2 | Flagship flavor: hash of the live TLE set (~10k satellites). Gorgeous story — but orbits are *predictable*, so never an anchor. |
| **mock** | testing | 0 | 0 | 3 | Deterministic, offline. Demos and tests only. |

Adding a source is ~50 lines behind the `EntropySource` interface
(`src/sources/types.mjs`): `id`, an honest `grade`, `fetch(ref)`, `verify(ref,
obs)`. Garnish ideas in the backlog: space weather (NOAA SWPC), seismic (USGS),
lightning (Blitzortung), ocean buoys, pulsar timing, arXiv/HN ephemera.

### Hardening drand verify

`drand.verify()` checks `randomness == SHA-256(signature)` — offline-verifiable
from the reveal, which is what keeps the browser widget zero-trust. The
*strongest* check is full **BLS signature verification** of `signature` against
the chain's group public key (proves the League actually produced it). That needs
a BLS library and is wired as an optional enhancement, not a runtime dependency,
to keep the core install-free.

## Project layout

```
src/
  bytes.mjs       encoding helpers (browser+node, no Buffer)
  hash.mjs        SHA-256 via Web Crypto — the one primitive
  combiner.mjs    observations → 32-byte seed (canonical, domain-separated)
  expander.mjs    seed → deterministic byte stream
  mapper.mjs      stream → fair dice (rejection sampling)
  envelope.mjs    buildCommitment / reveal / verifyReveal
  sources/        EntropySource plugins: drand, bitcoin, starlink, mock
cli/beacon.mjs    commit | reveal | verify | demo
web/              <dice-verifier> custom element + verify.html
test/             node:test, zero deps
```

## Status & roadmap

- ✅ Core (combine / expand / rejection-sample) + golden tests
- ✅ Commit–reveal envelope + CLI verifier
- ✅ drand anchor (live-verified), Bitcoin co-anchor, Starlink garnish
- ✅ Browser `<dice-verifier>` (zero server trust)
- ⬜ Optional BLS hardening for drand
- ⬜ More garnishes; signed/archived snapshots to lift garnish `verifiable`
- ⬜ Thin Tensies adapter (separate concern; lives in Tensies, not here)

## License

MIT.
