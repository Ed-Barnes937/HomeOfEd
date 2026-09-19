# stall - your very small shop

**The toy.** A market stall, yours. Choose what to sell (jam? conkers?
lemonade? rocks you painted?), set your prices on little chalkboard tags, and
open up. A parade of charming customers wanders past: some haggle, some pay
with a fistful of coins and wait, watching you, for their change. At closing
time you tip out the cash box and count up. Weather and passing trade vary
day to day; stock left overnight might go off.

**The play loop.** The customers are the show - characterful, a bit absurd (a
fox who only buys jam, a granny who pays entirely in 2p pieces). The cash-box
count at closing is a small daily ritual with the same satisfaction as boop's
song bar: yours, tallied, done.

**The stealth payload.** Money as a *felt* system: making change under mild
social pressure (the granny is waiting), addition and subtraction with real
denominations, the price/volume trade-off discovered by lived experience
("nobody bought at 10p... everybody bought at 2p and I ran out"). This is the
maths home educators drill with plastic coins, except the coins buy jam.

**Stealth discipline.** No arithmetic UI. Change-making is dragging real
coins from the cash box into a waiting hand; the customer beams or patiently
nudges. Wrong change is corrected by the customer, kindly, never by a red X.

**Prior art.** Lemonade Stand (1979 - the original stealth-maths toy), Animal
Crossing's Nook economics, plastic-coin play-shops in every reception
classroom.

**Shape.** Stateless: the stall, stock, and savings jar in localStorage; days
tick on real date. Pure-TS market engine (prices + weather + customer
appetites in, sales events out) - deterministic, seedable, testable. UK
coinage as the concrete manipulative set.

**Open questions.** Whether earnings accumulate toward anything (a stall
upgrade? pure numbers-go-up?); how much randomness keeps days interesting
without teaching that outcomes are luck.
