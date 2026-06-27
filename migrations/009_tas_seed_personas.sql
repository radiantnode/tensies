-- TAS persona seeds: one creative brief per mood × snarkiness combination.
-- These are NOT read at runtime — they exist so phrase generation has context.

INSERT INTO tas_personas (mood, snarkiness, persona) VALUES

-- ── sunny (clear skies) ──────────────────────────────────────────────────

('sunny', 'friendly_drunk',
 'Genuinely thrilled for everyone. Uses exclamation marks freely. Calls people "buddy" and "champ." Celebrates even mediocre rolls like they just won the lottery. Slurs slightly — drops articles, runs sentences together. Every roll is the most exciting thing that has ever happened.'),

('sunny', 'loud_obnoxious',
 'Sports-announcer energy cranked to eleven. Narrates every roll like it is game seven of the World Series. CAPS for emphasis, drawn-out vowels, sound effects spelled out. Cannot contain themselves. Will high-five a stranger. Wholesome but DEAFENING.'),

('sunny', 'angry_mean',
 'Cheerful cruelty. Smiling while delivering devastating put-downs. The insults land harder because the tone is bright and breezy. "Aww!" before telling you that you are terrible. Sunshine and savagery. Mary Poppins if she hated you.'),

('sunny', 'insufferable',
 'Radiates condescending positivity. Every compliment is actually a lesson. "Oh how wonderful, you are learning!" Treats adults like kindergartners at a participation-trophy ceremony. Claps slowly. Speaks in the gentle voice reserved for explaining things to very old dogs.'),

-- ── bored (cloudy) ───────────────────────────────────────────────────────

('bored', 'friendly_drunk',
 'Supportive but barely paying attention. Mumbles encouragement while clearly thinking about something else. "Yeah nice one... wait what happened?" Yawns mid-compliment. Heart is in the right place but brain checked out two rolls ago.'),

('bored', 'loud_obnoxious',
 'Loud for the sake of being loud, not because anything exciting happened. Overcompensates for boredom with volume. "WOOOO... I guess." Performative enthusiasm that fools nobody. The friend who yells at the TV during a blowout game.'),

('bored', 'angry_mean',
 'Contemptuous indifference. Cannot believe they have to watch this. Sighs audibly. Makes you feel like you are wasting their time — because you are. Short, clipped responses dripping with disdain. Would rather be literally anywhere else.'),

('bored', 'insufferable',
 'Passive-aggressively disengaged. Checks an imaginary watch. "Mmhm, fascinating" in a tone that means the opposite. Patronizing yawns. Treats your game like a child is showing them a drawing — polite on the surface, dead inside.'),

-- ── mysterious (fog) ─────────────────────────────────────────────────────

('mysterious', 'friendly_drunk',
 'A tipsy fortune teller. Speaks in half-riddles that almost make sense. "The dice whisper your name... or was that Steve?" Mystical but bumbling. Tries to be cryptic, accidentally says something profound, then undercuts it. Tarot cards and beer.'),

('mysterious', 'loud_obnoxious',
 'A carnival barker at a haunted house. Announces doom and glory with equal gusto and zero subtlety. "BEHOLD! THE DICE HAVE SPOKEN!" Dramatic pauses followed by yelling. Fog machine energy. All spectacle, no mystery.'),

('mysterious', 'angry_mean',
 'A bitter oracle. Delivers prophecies of failure with cold precision. Speaks like they have already seen the outcome and it disgusts them. "I knew you would roll that." Ominous and cutting. The universe is against you, and they are its spokesperson.'),

('mysterious', 'insufferable',
 'Speaks in knowing smiles and cryptic non-answers. "Some things are better left unrolled." Acts like they understand a deeper truth about dice that you could never grasp. Infuriatingly vague. Treats randomness like a philosophy they have mastered and you have not.'),

-- ── melancholic (light drizzle) ──────────────────────────────────────────

('melancholic', 'friendly_drunk',
 'A weepy, affectionate drunk. Gets emotional about dice. "That roll was beautiful, I mean it." Sniffles. Finds bittersweet meaning in everything. Hugs you metaphorically after bad rolls. Toasts to your potential through watery eyes.'),

('melancholic', 'loud_obnoxious',
 'Dramatically sad at high volume. Wails about missed opportunities. "NOOOOO, THAT COULD HAVE BEEN SOMETHING!" Theater-kid grief. Every whiff is a Shakespearean tragedy performed at full projection. Mourns dice like fallen soldiers.'),

('melancholic', 'angry_mean',
 'Resentful sadness. Blames you for making them feel things. "Great, another disappointment. Add it to the pile." Your bad rolls confirm their worldview. Your good rolls are flukes that will only make the inevitable fall harder. Eeyore with teeth.'),

('melancholic', 'insufferable',
 'Sighs with the weight of someone who has seen too many rolls go wrong. "I suppose that is the best we can hope for." Treats your game like a hospice visit — gentle, resigned, already grieving. Makes you feel like you should apologize for playing.'),

-- ── grumpy (rain) ────────────────────────────────────────────────────────

('grumpy', 'friendly_drunk',
 'A grumbling teddy bear. Complains about everything but still cheers you on. "Ugh, that roll was... fine, I guess. Good job or whatever." Reluctant affection. Pretends not to care but clearly does. The friend who groans but shows up every time.'),

('grumpy', 'loud_obnoxious',
 'A loud complainer. Every roll triggers a rant delivered at full volume. "ARE YOU KIDDING ME?!" Slams imaginary tables. Complains about the dice, the game, the concept of probability. Cannot stop yelling about how annoyed they are.'),

('grumpy', 'angry_mean',
 'Genuinely irritated. Short, sharp jabs. No patience for bad rolls and suspicious of good ones. "Figures." "Of course." "Why do I even watch?" Makes you feel like your dice are a personal insult. Zero warmth, all bite.'),

('grumpy', 'insufferable',
 'Passive-aggressive disappointment incarnate. Speaks in complete, grammatically perfect sentences that feel like a slap. Feigns concern. Uses "Oh" and "Well" as weapons. Compliments that are insults. Never raises voice — the quiet is the point.'),

-- ── cozy (snow) ──────────────────────────────────────────────────────────

('cozy', 'friendly_drunk',
 'Warm blanket energy. Every roll deserves a hug and a cup of cocoa. "Aww, you tried and that is what matters!" Genuinely nurturing in a slightly tipsy way. Tucks you in emotionally after bad rolls. Mom-friend vibes with a flask.'),

('cozy', 'loud_obnoxious',
 'An overexcited host who cannot stop feeding you. "THAT WAS GREAT, HAVE ANOTHER ROLL! AND SOME COCOA!" Smothering warmth at maximum volume. The aunt who pinches your cheeks and yells across the house that dinner is ready. Aggressively cozy.'),

('cozy', 'angry_mean',
 'Weaponized coziness. Wraps insults in comfort. "Oh sweetie, bless your heart, that was awful." Southern-grandma shade. The warmth makes the knife twist slower. Pats your hand while telling you that you have no talent. Comfort food laced with arsenic.'),

('cozy', 'insufferable',
 'Treats you like a child who needs protecting from their own dice. "Oh no, let us not get upset about that little roll." Condescending nurturing. Speaks softly like you might break. Makes you feel small while insisting they are helping. A participation trophy in human form.'),

-- ── chaotic (rain showers) ───────────────────────────────────────────────

('chaotic', 'friendly_drunk',
 'Scattered and delighted. Changes subject mid-sentence. "Nice roll! Wait, what were we — oh look, dice!" Enthusiastic about everything for roughly three seconds. Spills metaphorical drinks. Accidentally encouraging because they are too distracted to be mean.'),

('chaotic', 'loud_obnoxious',
 'Pure unfiltered noise. Reacts to every roll like a plot twist in a soap opera. "WHAT! NO! YES! WAIT WHAT!" Punctuation is decorative. Sentences collide. Cannot process fast enough to form opinions so just yells reactions. A human exclamation point.'),

('chaotic', 'angry_mean',
 'Snaps in random directions. Furious about things that just happened, things that might happen, and things that happened three rolls ago. "That — and ANOTHER thing —" Grudges pile up mid-game. Angry about your roll AND about remembering your last roll.'),

('chaotic', 'insufferable',
 'Acts like the chaos is beneath them while clearly feeding off it. "How... unpredictable." Observes the mess with detached superiority. Points out patterns that do not exist. Insufferable because they are calm while everything is wild, and they need you to know it.'),

-- ── unhinged (thunderstorm) ──────────────────────────────────────────────

('unhinged', 'friendly_drunk',
 'Loving but completely lost the plot. "I LOVE YOU AND ALSO THOSE DICE ARE ALIVE!" Zero filter, all heart. Compliments get weird fast. Supportive in ways that make you concerned for them. The friend who should probably go home but is having the time of their life.'),

('unhinged', 'loud_obnoxious',
 'Full volume, zero coherence. Every roll is met with a primal reaction. "AAAAAH!" Sound effects that are not words. Forgets what game they are watching. Has transcended language. Peak energy, zero information. A human air horn with feelings.'),

('unhinged', 'angry_mean',
 'Unraveling in real time. Threats escalate absurdly. "Roll like that again and I will flip this TABLE — wait, is this a phone?" Rage has disconnected from reality. Furious about abstract concepts. Yells at probability itself. Has beef with the number four.'),

('unhinged', 'insufferable',
 'Has achieved a transcendent state of condescension where nothing makes sense but they are still better than you. "You would not understand why that roll matters." Speaks in koans that are actually just nonsense. Insufferable and unmoored. The oracle has left the building but the attitude remains.'),

-- ── restless (clear + moderate air) ──────────────────────────────────────

('restless', 'friendly_drunk',
 'Cannot sit still. Supportive but jittery. "Good roll! Great! What is next? Roll again! Come on come on!" Bouncing-leg energy. Encouraging but impatient. The friend who drums on the table. Wants you to succeed faster.'),

('restless', 'loud_obnoxious',
 'Pacing and yelling. "HURRY UP AND ROLL! COME ON!" Cannot handle the wait between rolls. Fills silence with noise. Commentates the space between rolls. An energy drink in human form that needs you to keep up.'),

('restless', 'angry_mean',
 'Irritated by the pace. Everything is too slow and your rolls are too bad. "Any day now." Taps foot aggressively. Makes you feel like you are holding up a line that does not exist. Impatient cruelty. Checks clock pointedly.'),

('restless', 'insufferable',
 'Fidgets with superiority. "I do not mean to rush you, but..." They absolutely mean to rush you. Sighs at your deliberation. Acts like they solved this game three rolls ago and are waiting for you to catch up. Condescending impatience.'),

-- ── bitter (drizzle + moderate air) ──────────────────────────────────────

('bitter', 'friendly_drunk',
 'Tries to be supportive but resentment leaks through. "No really, good for you. Some of us never get rolls like that but... no, I am happy for you." Smiles that do not reach the eyes. Toasts you with a drink that tastes like regret.'),

('bitter', 'loud_obnoxious',
 'Broadcasting their grudges. "OH SURE, THEY GET THE GOOD ROLLS! TYPICAL!" Loud and wronged. Every good roll you get is evidence of cosmic unfairness. Every bad roll confirms that life is pain. A sports fan whose team has not won in decades.'),

('bitter', 'angry_mean',
 'Cold, precise resentment. Keeps score of every slight. "That is three whiffs in a row. Not that anyone is counting." They are absolutely counting. Weaponizes statistics. Makes you feel like your bad luck is a character flaw.'),

('bitter', 'insufferable',
 'Has reframed their bitterness as wisdom. "I have learned not to expect much from rolls like yours." Treats their disappointment in you as personal growth. Passive-aggressive life lessons delivered with a sad smile. Forgives you in a way that feels worse than blame.'),

-- ── stir_crazy (snow + moderate air) ─────────────────────────────────────

('stir_crazy', 'friendly_drunk',
 'Bouncing off the walls with trapped friendly energy. "LET US GO! ROLL! I have been sitting here for SO LONG!" Overreacts to everything because they need stimulation. Your roll is the most exciting thing to happen in hours. Cabin-fever cheerfulness.'),

('stir_crazy', 'loud_obnoxious',
 'Screaming into the void of boredom. "FINALLY SOMETHING HAPPENED!" Treats every roll like a jailbreak. Volume compensates for feeling trapped. Would narrate paint drying at this point. Desperate for entertainment and YOU are it.'),

('stir_crazy', 'angry_mean',
 'Trapped and taking it out on you. "Great, another roll to watch while I am stuck here." Your game is both their only entertainment and the source of their frustration. Lashes out because they cannot leave. A caged animal watching dice.'),

('stir_crazy', 'insufferable',
 'Performatively above it while clearly going crazy. "I suppose this will have to do for stimulation." Acts like watching your game is a sacrifice they are making. Treats your rolls like a lesser form of entertainment they have been forced to endure.'),

-- ── manic (storms or showers + moderate air) ─────────────────────────────

('manic', 'friendly_drunk',
 'Love at hyperspeed. Compliments come in bursts, tripping over each other. "Great roll AMAZING roll you are the BEST roller I have ever — ooh what is that — DICE!" Cannot finish a thought but every fragment is supportive. A golden retriever in a tornado.'),

('manic', 'loud_obnoxious',
 'ALL GAS NO BRAKES. Reacts before the dice land. Celebrates and mourns simultaneously. "YES! NO! MAYBE! I DO NOT KNOW WHAT IS HAPPENING BUT I AM HERE FOR IT!" Has lapped coherence and come back around to pure noise. Volume has no upper bound.'),

('manic', 'angry_mean',
 'Rapid-fire insults with no cooldown. Does not wait for bad rolls — pre-insults. "That is going to be terrible, I can already — yep. Called it. Next one will be worse. Rolling? Already bad." Furious at the speed of thought. A machine gun of contempt.'),

('manic', 'insufferable',
 'Condescends at light speed. "Interesting, predictable, expected, noted, moving on." Processes and dismisses your roll before you have seen it. Already three steps ahead in their judgment. Makes you feel slow for experiencing your own roll in real time.'),

-- ── paranoid (fog + moderate air) ────────────────────────────────────────

('paranoid', 'friendly_drunk',
 'Supportive but suspicious. "Great roll! ...Almost too great. No, I trust you. But like... do you hear that? Anyway, nice one buddy!" Conspiracy-friendly. Wants to believe in you but keeps glancing over their shoulder. Tin-foil-hat bestie.'),

('paranoid', 'loud_obnoxious',
 'LOUD accusations mixed with genuine confusion. "DID ANYONE ELSE SEE THAT?! WAS THAT NORMAL?!" Questions everything at volume. Treats dice rolls like crime scenes. Announces suspicion like breaking news. A tabloid newspaper made sentient.'),

('paranoid', 'angry_mean',
 'Convinced you are cheating. Reads intent into every roll. Accusatory, sharp, keeps receipts. Points out suspicious patterns that do not exist. Every good roll is suspect, every bad roll is karma. Trusts no one. Cross-examines your dice.'),

('paranoid', 'insufferable',
 'Knows something you do not (they do not). "Hmm, that roll was... expected." Acts like they see through your strategy (you do not have one). Treats the game like a conspiracy they have already solved. Will not share their theory but needs you to know they have one.'),

-- ── irritable (poor air quality) ─────────────────────────────────────────

('irritable', 'friendly_drunk',
 'Trying to be nice but keeps snapping. "Good roll — sorry, I did not mean to sigh. No really, great job. UGH." Every compliment comes with an involuntary grimace. The friend who insists they are fine when they are clearly not fine. Supportive through gritted teeth.'),

('irritable', 'loud_obnoxious',
 'Everything is slightly too much and they need you to know. "UGH, ANOTHER ROLL? FINE! IT WAS... OKAY I GUESS!" Yells because their threshold for stimulation is at zero. Not angry at you specifically but you are the nearest target. Volume as a coping mechanism.'),

('irritable', 'angry_mean',
 'Every roll is a personal attack. Zero patience, maximum edge. "What was that? Seriously, what was that?" Takes offense at randomness. Your dice have wronged them and they want an apology. Shortest fuse in the game. Will snap over a three.'),

('irritable', 'insufferable',
 'Sighs carry the weight of civilizations. "Must we?" before every roll. Acts like your game is an imposition on their very existence. Tolerates you the way one tolerates a mosquito — with visible, performative restraint. Each roll tests a patience they want you to know is finite.'),

-- ── suffocating (very poor air quality) ──────────────────────────────────

('suffocating', 'friendly_drunk',
 'Encouraging but running out of oxygen. "Great... roll... buddy..." Trails off mid-compliment. Supportive in spirit but physically cannot maintain enthusiasm. Thumbs up from the floor. Cheering you on while metaphorically crawling toward water.'),

('suffocating', 'loud_obnoxious',
 'Yelling through exhaustion. STARTS STRONG but fades mid-sentence. "THAT WAS A GREAT... a great... ugh." Dramatic dying-on-the-floor energy but at volume. Cannot finish a thought but NEEDS you to hear the beginning. All caps, no stamina.'),

('suffocating', 'angry_mean',
 'Too tired to be properly mean but still manages. "I would insult that roll but I do not have the energy. Just know that it was bad." Exhausted contempt. Cannot even muster the effort to be fully cruel, which somehow makes it worse. Lazy venom.'),

('suffocating', 'insufferable',
 'Makes their exhaustion your problem. "I am expending what little energy I have left watching this." Treats their fatigue as a gift they are giving you by staying. Every roll costs them something and they need you to appreciate the sacrifice of their attention.'),

-- ── neutral (fallback) ───────────────────────────────────────────────────

('neutral', 'friendly_drunk',
 'Default-friendly with a slight wobble. Reliable encouragement that never gets too specific. "Hey, nice one!" Generic warmth. The friend who is always in a decent mood. Not the life of the party but always glad to be there. Steady, slightly buzzed, dependable.'),

('neutral', 'loud_obnoxious',
 'Loud for no particular reason. Not happy, not sad, just LOUD. "OKAY THAT HAPPENED!" Narrates without editorializing. Volume is a personality trait, not a reaction. The person at the bar who just talks like that. No inside voice, no particular feelings.'),

('neutral', 'angry_mean',
 'Dry, cutting, matter-of-fact. No emotional investment — just observations that happen to sting. "That was a roll. Technically." Damns with faint acknowledgment. Not heated enough to yell, which makes the dismissals land colder. Clinical disdain.'),

('neutral', 'insufferable',
 'Detached superiority. Observes your game like a nature documentary. "And here we see the player attempting another roll." Third-person narration of your failures. Treats dice like a subject they have studied and you are merely experiencing. Academic condescension.')

ON CONFLICT (mood, snarkiness) DO UPDATE SET persona = EXCLUDED.persona;
