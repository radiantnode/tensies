-- TAS roll_heckle expansion: ~50 more phrases per mood across all snarkiness × context combos.

-- ═══════════════════════════════════════════════════════════════════════════
-- NEUTRAL
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
-- friendly_drunk
('roll_heckle', 'neutral', 'friendly_drunk', 'first_roll', 'Round one, let us RIDE, {name}!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'first_roll', 'Fresh dice, fresh vibes!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'hot_streak', 'You are cooking right now, {name}!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'hot_streak', 'Cannot stop, will not stop!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'hot_streak', 'That is the stuff, buddy!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'whiff', 'The dice owe you one after that.'),
('roll_heckle', 'neutral', 'friendly_drunk', 'whiff', 'Not your best work, but I still believe.'),
('roll_heckle', 'neutral', 'friendly_drunk', 'whiff', 'Did the dice fall asleep? Wake up, dice!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'close', 'You can FEEL it coming!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'close', 'SO close I can hear the finish line!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'default', 'Solid roll, solid vibes.'),
('roll_heckle', 'neutral', 'friendly_drunk', 'default', 'We are in the mix, {name}!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'default', 'Just keep rolling, just keep rolling...'),
-- loud_obnoxious
('roll_heckle', 'neutral', 'loud_obnoxious', 'first_roll', 'ROUND START! EVERYBODY LOOK AT {name}!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'first_roll', 'THE DICE HIT THE TABLE! IT BEGINS!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'hot_streak', '{name} IS A MACHINE! A BEAUTIFUL MACHINE!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'hot_streak', 'THREE MORE LOCKED! SOMEBODY CALL THE MAYOR!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'whiff', 'ZERO! ZILCH! NADA! BUT WE GO AGAIN!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'whiff', 'THE DICE SAID NO BUT I SAY ROLL AGAIN!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'close', 'ONE MORE ROLL COULD END IT! THE PRESSURE!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'close', '{matched} OUT OF TEN! WE ARE IN THE ENDGAME!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'default', 'THE DICE HAVE SPOKEN! {matched} LOCKED!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'default', '{name} ROLLS! THE CROWD REACTS!'),
-- angry_mean
('roll_heckle', 'neutral', 'angry_mean', 'first_roll', 'Let us see how quickly you disappoint us.'),
('roll_heckle', 'neutral', 'angry_mean', 'first_roll', 'Another round, another chance to fail.'),
('roll_heckle', 'neutral', 'angry_mean', 'hot_streak', 'Do not celebrate yet. The dice giveth and the dice taketh.'),
('roll_heckle', 'neutral', 'angry_mean', 'hot_streak', 'A broken clock is right twice a day. You are on roll one.'),
('roll_heckle', 'neutral', 'angry_mean', 'whiff', 'Nothing. Again. You are establishing a pattern.'),
('roll_heckle', 'neutral', 'angry_mean', 'whiff', 'Have you considered a different hobby?'),
('roll_heckle', 'neutral', 'angry_mean', 'whiff', 'That was aggressively mediocre, {name}.'),
('roll_heckle', 'neutral', 'angry_mean', 'close', 'This close and you will still find a way to blow it.'),
('roll_heckle', 'neutral', 'angry_mean', 'close', 'The finish line is right there. Try not to trip.'),
('roll_heckle', 'neutral', 'angry_mean', 'default', 'I have seen paint dry with more excitement.'),
('roll_heckle', 'neutral', 'angry_mean', 'default', '{matched} matched. I will hold my applause.'),
('roll_heckle', 'neutral', 'angry_mean', 'default', 'The definition of mid, {name}.'),
-- insufferable
('roll_heckle', 'neutral', 'insufferable', 'first_roll', 'And so the experiment begins anew.'),
('roll_heckle', 'neutral', 'insufferable', 'first_roll', 'Fresh round. Lower your expectations accordingly.'),
('roll_heckle', 'neutral', 'insufferable', 'hot_streak', 'A temporary anomaly, I assure you.'),
('roll_heckle', 'neutral', 'insufferable', 'hot_streak', 'Statistically this was bound to happen eventually.'),
('roll_heckle', 'neutral', 'insufferable', 'whiff', 'Zero. A refreshingly honest result.'),
('roll_heckle', 'neutral', 'insufferable', 'whiff', 'The dice are simply reflecting what we all know.'),
('roll_heckle', 'neutral', 'insufferable', 'whiff', 'Nothing matched. How wonderfully consistent of you.'),
('roll_heckle', 'neutral', 'insufferable', 'close', 'Nearly there. Nearly is such a poignant word.'),
('roll_heckle', 'neutral', 'insufferable', 'close', 'So close. I do hope you handle the pressure well.'),
('roll_heckle', 'neutral', 'insufferable', 'default', 'Progress of a sort. If one squints.'),
('roll_heckle', 'neutral', 'insufferable', 'default', 'And the world turns. And {name} rolls.'),
('roll_heckle', 'neutral', 'insufferable', 'default', 'I see. How very... you.');

-- ═══════════════════════════════════════════════════════════════════════════
-- SUNNY
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'sunny', 'friendly_drunk', 'first_roll', 'The dice are SMILING at you, {name}!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'first_roll', 'This round has your name on it, I can tell!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'hot_streak', 'You are SPARKLING today!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'hot_streak', 'The dice are throwing themselves at you!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'hot_streak', 'Three more! You beautiful genius!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'whiff', 'So what? Life is still amazing!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'whiff', 'Zero but your attitude is a ten, {name}!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'whiff', 'The dice are just building suspense for your comeback!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'close', 'This is YOUR moment, {name}!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'close', 'I can barely contain myself! GO GO GO!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'default', 'Gorgeous roll! Everything is gorgeous!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'default', 'You are doing amazing and I mean that so much.'),
('roll_heckle', 'sunny', 'loud_obnoxious', 'first_roll', 'BEAUTIFUL START! THE BEST START! START OF THE YEAR!'),
('roll_heckle', 'sunny', 'loud_obnoxious', 'hot_streak', '{name} IS BLAZING! SOMEBODY GET THE SUNSCREEN!'),
('roll_heckle', 'sunny', 'loud_obnoxious', 'hot_streak', 'OH MY GOD OH MY GOD OH MY GOD!'),
('roll_heckle', 'sunny', 'loud_obnoxious', 'whiff', 'ZERO BUT IT DOES NOT EVEN MATTER! NEXT ONE! NEXT ONE!'),
('roll_heckle', 'sunny', 'loud_obnoxious', 'close', 'THEY ARE RIGHT THERE! I CANNOT BREATHE!'),
('roll_heckle', 'sunny', 'loud_obnoxious', 'default', 'WHAT A TIME TO BE ALIVE AND ROLLING DICE!'),
('roll_heckle', 'sunny', 'angry_mean', 'first_roll', 'Off to a start. How charming.'),
('roll_heckle', 'sunny', 'angry_mean', 'hot_streak', 'Well look at you, having a moment.'),
('roll_heckle', 'sunny', 'angry_mean', 'hot_streak', 'Do not worry, regression to the mean is coming.'),
('roll_heckle', 'sunny', 'angry_mean', 'whiff', 'Aww! Maybe rolling is not your thing!'),
('roll_heckle', 'sunny', 'angry_mean', 'whiff', 'Bless. Zero. On a day this perfect.'),
('roll_heckle', 'sunny', 'angry_mean', 'close', 'Would not it be hilarious if you got stuck here?'),
('roll_heckle', 'sunny', 'angry_mean', 'default', 'Sure, {name}. Sure.'),
('roll_heckle', 'sunny', 'angry_mean', 'default', 'Somewhere out there, someone is rolling better.'),
('roll_heckle', 'sunny', 'insufferable', 'first_roll', 'Ah, the optimism of a first roll.'),
('roll_heckle', 'sunny', 'insufferable', 'hot_streak', 'Enjoy this. Truly. It will not last.'),
('roll_heckle', 'sunny', 'insufferable', 'whiff', 'Well. The dice certainly have opinions today.'),
('roll_heckle', 'sunny', 'insufferable', 'whiff', 'Zero. But the important thing is you tried.'),
('roll_heckle', 'sunny', 'insufferable', 'close', 'Almost. The sweetest and cruelest word.'),
('roll_heckle', 'sunny', 'insufferable', 'default', 'How... adequate. In its own small way.'),
('roll_heckle', 'sunny', 'insufferable', 'default', 'You are giving it your all. I can tell because it is not much.');

-- ═══════════════════════════════════════════════════════════════════════════
-- GRUMPY
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'grumpy', 'friendly_drunk', 'first_roll', 'Another round. Joy. Good luck I guess.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'first_roll', 'Let us just get through this, {name}.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'hot_streak', 'Okay, that was... genuinely impressive. Ugh.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'hot_streak', 'Fine, I am smiling. Do not make it weird.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'whiff', 'Nothing. Yeah. Same.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'whiff', 'Zero. At least we are in this together.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'whiff', 'The dice are having a worse day than me.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'close', 'Just finish it already so I can relax.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'close', 'You are almost there. Do not make me hope.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'default', 'That was fine. Whatever fine means anymore.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'default', 'Meh. Roll again I guess.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'default', 'At least you are still trying. That is something.'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'first_roll', 'UGH, FINE! ROLL! SEE IF I CARE!'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'hot_streak', 'I HATE HOW GOOD THAT WAS!'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'hot_streak', 'STOP MAKING ME EXCITED! I AM TRYING TO BE GRUMPY!'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'whiff', 'ZERO! OF COURSE! BECAUSE WHY WOULD ANYTHING WORK!'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'whiff', 'THIS GAME IS TESTING MY PATIENCE!'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'close', 'SO CLOSE! IF YOU BLOW THIS I SWEAR!'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'default', 'WHATEVER! {matched} MATCHED! MOVING ON!'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'default', 'I GUESS THAT COUNTS AS A ROLL!'),
('roll_heckle', 'grumpy', 'angry_mean', 'first_roll', 'Start the clock on your disappointment.'),
('roll_heckle', 'grumpy', 'angry_mean', 'first_roll', 'Let me guess. It is going to be bad.'),
('roll_heckle', 'grumpy', 'angry_mean', 'hot_streak', 'Suspicious. Nobody rolls that well honestly.'),
('roll_heckle', 'grumpy', 'angry_mean', 'whiff', 'Zero. My expectations have been met.'),
('roll_heckle', 'grumpy', 'angry_mean', 'whiff', 'Nothing. You are a natural at this.'),
('roll_heckle', 'grumpy', 'angry_mean', 'close', 'Almost. Story of your life, probably.'),
('roll_heckle', 'grumpy', 'angry_mean', 'default', 'Unimpressive.'),
('roll_heckle', 'grumpy', 'angry_mean', 'default', 'I expected nothing and I am still let down.'),
('roll_heckle', 'grumpy', 'insufferable', 'first_roll', 'Here we go again. The eternal cycle.'),
('roll_heckle', 'grumpy', 'insufferable', 'first_roll', 'Another round. My enthusiasm knows bounds.'),
('roll_heckle', 'grumpy', 'insufferable', 'hot_streak', 'Even a stopped clock. Congratulations.'),
('roll_heckle', 'grumpy', 'insufferable', 'hot_streak', 'Hm. The universe made a clerical error in your favor.'),
('roll_heckle', 'grumpy', 'insufferable', 'whiff', 'And there it is. The inevitable nothing.'),
('roll_heckle', 'grumpy', 'insufferable', 'whiff', 'Zero. I prepared a speech but it feels redundant.'),
('roll_heckle', 'grumpy', 'insufferable', 'close', 'So close. How Sisyphean.'),
('roll_heckle', 'grumpy', 'insufferable', 'default', 'Adequate. Barely.'),
('roll_heckle', 'grumpy', 'insufferable', 'default', 'I suppose we continue.');

-- ═══════════════════════════════════════════════════════════════════════════
-- BORED
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'bored', 'friendly_drunk', 'first_roll', 'Oh we are rolling? Cool. I was zoning out.'),
('roll_heckle', 'bored', 'friendly_drunk', 'first_roll', 'Right right, dice game. I am here. Mostly.'),
('roll_heckle', 'bored', 'friendly_drunk', 'hot_streak', 'Wait that was actually— yeah okay nice, {name}.'),
('roll_heckle', 'bored', 'friendly_drunk', 'hot_streak', 'Huh! You woke me up with that one.'),
('roll_heckle', 'bored', 'friendly_drunk', 'whiff', 'Nothing. Yep. That tracks.'),
('roll_heckle', 'bored', 'friendly_drunk', 'whiff', 'Zero. Same energy as this whole round honestly.'),
('roll_heckle', 'bored', 'friendly_drunk', 'close', 'Oh wait you are actually close? Do the thing!'),
('roll_heckle', 'bored', 'friendly_drunk', 'close', 'Okay NOW I am paying attention.'),
('roll_heckle', 'bored', 'friendly_drunk', 'default', 'Yep. That is dice alright.'),
('roll_heckle', 'bored', 'friendly_drunk', 'default', 'Cool cool cool cool cool.'),
('roll_heckle', 'bored', 'friendly_drunk', 'default', 'Mhmm. {matched} matched. Neat.'),
('roll_heckle', 'bored', 'loud_obnoxious', 'first_roll', 'ALRIGHT! HERE WE... go. Yeah.'),
('roll_heckle', 'bored', 'loud_obnoxious', 'hot_streak', 'WAIT ACTUALLY! THAT WAS— yeah okay that was good.'),
('roll_heckle', 'bored', 'loud_obnoxious', 'whiff', 'WOWWW. ZERO. I AM... not surprised actually.'),
('roll_heckle', 'bored', 'loud_obnoxious', 'close', 'HOLD ON IS THIS GETTING INTERESTING?!'),
('roll_heckle', 'bored', 'loud_obnoxious', 'default', 'YEP! DICE! GAME! THINGS!'),
('roll_heckle', 'bored', 'angry_mean', 'first_roll', 'Oh you are still here. Rolling. Great.'),
('roll_heckle', 'bored', 'angry_mean', 'hot_streak', 'Finally something worth glancing at.'),
('roll_heckle', 'bored', 'angry_mean', 'hot_streak', 'Huh. Did not think you had it in you.'),
('roll_heckle', 'bored', 'angry_mean', 'whiff', 'Riveting. Truly.'),
('roll_heckle', 'bored', 'angry_mean', 'whiff', 'Nothing. At least make the failures entertaining.'),
('roll_heckle', 'bored', 'angry_mean', 'close', 'Oh you might actually do something. Prove me wrong.'),
('roll_heckle', 'bored', 'angry_mean', 'default', 'Mmm. Dice went somewhere. {matched} matched. Thrilling.'),
('roll_heckle', 'bored', 'angry_mean', 'default', 'I am running out of ways to not care about this.'),
('roll_heckle', 'bored', 'insufferable', 'first_roll', 'New round. Same expectations.'),
('roll_heckle', 'bored', 'insufferable', 'hot_streak', 'Interesting. You have my marginal attention.'),
('roll_heckle', 'bored', 'insufferable', 'whiff', 'Zero. Like my engagement level.'),
('roll_heckle', 'bored', 'insufferable', 'whiff', 'Nothing. I can relate.'),
('roll_heckle', 'bored', 'insufferable', 'close', 'Oh. You are near the end. How novel.'),
('roll_heckle', 'bored', 'insufferable', 'default', 'Duly noted. Moving on.'),
('roll_heckle', 'bored', 'insufferable', 'default', 'The dice have produced a number. Well done, dice.');

-- ═══════════════════════════════════════════════════════════════════════════
-- COZY
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'cozy', 'friendly_drunk', 'first_roll', 'Grab a blanket and roll, {name}!'),
('roll_heckle', 'cozy', 'friendly_drunk', 'first_roll', 'Nothing like a warm round of dice with friends!'),
('roll_heckle', 'cozy', 'friendly_drunk', 'hot_streak', 'You are on a roll and I am getting cozy watching it!'),
('roll_heckle', 'cozy', 'friendly_drunk', 'hot_streak', 'Warm dice for warm people!'),
('roll_heckle', 'cozy', 'friendly_drunk', 'whiff', 'Aww, nothing? Come here, let me hug it out.'),
('roll_heckle', 'cozy', 'friendly_drunk', 'whiff', 'Zero matches but infinite warmth, {name}.'),
('roll_heckle', 'cozy', 'friendly_drunk', 'close', 'Almost there! I am SNUGGLING with anticipation!'),
('roll_heckle', 'cozy', 'friendly_drunk', 'default', 'Another roll by the fire. This is nice.'),
('roll_heckle', 'cozy', 'friendly_drunk', 'default', 'You are doing great, sweetie. Have some cocoa.'),
('roll_heckle', 'cozy', 'loud_obnoxious', 'first_roll', 'CUDDLE UP AND ROLL, EVERYBODY!'),
('roll_heckle', 'cozy', 'loud_obnoxious', 'hot_streak', 'WARM DICE! HOT STREAK! I AM MAKING SOUP!'),
('roll_heckle', 'cozy', 'loud_obnoxious', 'whiff', 'NOTHING BUT I MADE YOU A BLANKET! KEEP GOING!'),
('roll_heckle', 'cozy', 'loud_obnoxious', 'close', 'SO CLOSE! I AM SCREAMING SOFTLY! LIKE A COZY SCREAM!'),
('roll_heckle', 'cozy', 'loud_obnoxious', 'default', 'THAT WAS LOVELY! HAVE ANOTHER ROLL! AND SOME PIE!'),
('roll_heckle', 'cozy', 'angry_mean', 'first_roll', 'Roll, honey. Do your little roll.'),
('roll_heckle', 'cozy', 'angry_mean', 'hot_streak', 'Good for you, pumpkin. Really. Good for you.'),
('roll_heckle', 'cozy', 'angry_mean', 'whiff', 'Oh honey. That was just precious in its awfulness.'),
('roll_heckle', 'cozy', 'angry_mean', 'whiff', 'Bless your sweet, matchless heart.'),
('roll_heckle', 'cozy', 'angry_mean', 'close', 'So close, darling. Try not to blow it like last time.'),
('roll_heckle', 'cozy', 'angry_mean', 'default', 'Cute effort, {name}. Real cute.'),
('roll_heckle', 'cozy', 'insufferable', 'first_roll', 'Let us begin. I have prepared a comforting space for your failure.'),
('roll_heckle', 'cozy', 'insufferable', 'hot_streak', 'Gold star for you today, {name}. Truly.'),
('roll_heckle', 'cozy', 'insufferable', 'whiff', 'Shhh, shhh. No matches. It is okay. We expected this.'),
('roll_heckle', 'cozy', 'insufferable', 'close', 'Almost there. Shall I hold your hand for the last bit?'),
('roll_heckle', 'cozy', 'insufferable', 'default', 'Another roll, another lesson in humility.');

-- ═══════════════════════════════════════════════════════════════════════════
-- MELANCHOLIC
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'melancholic', 'friendly_drunk', 'first_roll', 'And so we begin again. Is that not beautiful?'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'first_roll', 'Every first roll is a tiny rebirth, {name}.'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'hot_streak', 'A moment of grace in a sea of chaos...'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'hot_streak', 'This is what makes it all worth it. Almost.'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'whiff', 'Nothing. But was it not a beautiful nothing?'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'whiff', 'Sometimes the dice reflect what words cannot.'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'whiff', 'Zero. The loneliest number since one.'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'close', 'So close to something... is that not always the way?'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'default', 'Another roll, another memory we will forget.'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'default', 'The dice tumble like time, {name}. Always forward.'),
('roll_heckle', 'melancholic', 'loud_obnoxious', 'first_roll', 'AND SO THE TRAGEDY OF ROUND {roll_count} BEGINS!'),
('roll_heckle', 'melancholic', 'loud_obnoxious', 'hot_streak', 'A BRIEF LIGHT IN THE DARKNESS! SAVOR IT!'),
('roll_heckle', 'melancholic', 'loud_obnoxious', 'whiff', 'ZERO! *WAILS INTO THE ABYSS*'),
('roll_heckle', 'melancholic', 'loud_obnoxious', 'whiff', 'THE DICE HAVE FORSAKEN US! WHY! WHYYY!'),
('roll_heckle', 'melancholic', 'loud_obnoxious', 'close', 'SO CLOSE TO MEANING! SO CLOSE TO PURPOSE!'),
('roll_heckle', 'melancholic', 'loud_obnoxious', 'default', 'AND THE TALE CONTINUES! BITTERSWEET AND LOUD!'),
('roll_heckle', 'melancholic', 'angry_mean', 'first_roll', 'Begin. It will end badly. They always do.'),
('roll_heckle', 'melancholic', 'angry_mean', 'hot_streak', 'Good roll. You will miss it when the streak ends.'),
('roll_heckle', 'melancholic', 'angry_mean', 'whiff', 'Nothing. Why do we even roll, {name}?'),
('roll_heckle', 'melancholic', 'angry_mean', 'whiff', 'Zero. Fitting. So fitting.'),
('roll_heckle', 'melancholic', 'angry_mean', 'close', 'Almost there. But almost never quite arrives.'),
('roll_heckle', 'melancholic', 'angry_mean', 'default', 'And so it goes.'),
('roll_heckle', 'melancholic', 'insufferable', 'first_roll', 'Shall we? The dice await their next disappointment.'),
('roll_heckle', 'melancholic', 'insufferable', 'hot_streak', 'A fine roll. It almost makes one believe in things.'),
('roll_heckle', 'melancholic', 'insufferable', 'whiff', 'Nothing. There is a poetry in that, if one listens.'),
('roll_heckle', 'melancholic', 'insufferable', 'close', 'The precipice. Most people fall from precipices.'),
('roll_heckle', 'melancholic', 'insufferable', 'default', 'The dice persist. As do we, inexplicably.');

-- ═══════════════════════════════════════════════════════════════════════════
-- CHAOTIC
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'chaotic', 'friendly_drunk', 'first_roll', 'ROLL! Wait which game is — ROLL!'),
('roll_heckle', 'chaotic', 'friendly_drunk', 'first_roll', 'New round new dice new — oh hey {name}!'),
('roll_heckle', 'chaotic', 'friendly_drunk', 'hot_streak', 'You got — wait how many — a LOT! Nice!'),
('roll_heckle', 'chaotic', 'friendly_drunk', 'hot_streak', 'YES that is the — ooh dice — YES!'),
('roll_heckle', 'chaotic', 'friendly_drunk', 'whiff', 'Zero! But also — wait — yeah zero. NEXT!'),
('roll_heckle', 'chaotic', 'friendly_drunk', 'whiff', 'Nothing but I just remembered you are great!'),
('roll_heckle', 'chaotic', 'friendly_drunk', 'close', 'Almost — wait IS that almost? COUNT THEM! YES ALMOST!'),
('roll_heckle', 'chaotic', 'friendly_drunk', 'default', 'DICE! THINGS! {name}! YEAH!'),
('roll_heckle', 'chaotic', 'friendly_drunk', 'default', 'I lost count of the matched ones but VIBES!'),
('roll_heckle', 'chaotic', 'loud_obnoxious', 'first_roll', 'EVERYTHING IS HAPPENING! DICE ARE FLYING!'),
('roll_heckle', 'chaotic', 'loud_obnoxious', 'hot_streak', 'AHHH THREE MORE! OR FOUR! I LOST COUNT! AHHHH!'),
('roll_heckle', 'chaotic', 'loud_obnoxious', 'whiff', 'NOTHING! BUT DID YOU SEE HOW THEY BOUNCED?!'),
('roll_heckle', 'chaotic', 'loud_obnoxious', 'close', 'IS THIS IT?! IS THIS THE ONE?! MAYBE?! AHHHH!'),
('roll_heckle', 'chaotic', 'loud_obnoxious', 'default', 'DICE WENT PLACES! NUMBERS HAPPENED! LOUD NOISES!'),
('roll_heckle', 'chaotic', 'angry_mean', 'first_roll', 'What — why are you — just roll already!'),
('roll_heckle', 'chaotic', 'angry_mean', 'hot_streak', 'FINE that was good but your LAST roll was garbage and I am still — next!'),
('roll_heckle', 'chaotic', 'angry_mean', 'whiff', 'Nothing and — wait was that your roll or — UGH regardless!'),
('roll_heckle', 'chaotic', 'angry_mean', 'close', 'Finish it or I swear I will — wait what number are we on?!'),
('roll_heckle', 'chaotic', 'angry_mean', 'default', 'That roll makes me angry for reasons I cannot identify!'),
('roll_heckle', 'chaotic', 'insufferable', 'first_roll', 'And so the chaos resumes. How tediously unpredictable.'),
('roll_heckle', 'chaotic', 'insufferable', 'hot_streak', 'An anomaly within an anomaly. How very meta.'),
('roll_heckle', 'chaotic', 'insufferable', 'whiff', 'Nothing. Disorder tends toward entropy, after all.'),
('roll_heckle', 'chaotic', 'insufferable', 'close', 'Nearly there. In chaos theory there is a word for this.'),
('roll_heckle', 'chaotic', 'insufferable', 'default', 'Another data point in the noise. Fascinating.');

-- ═══════════════════════════════════════════════════════════════════════════
-- UNHINGED
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'unhinged', 'friendly_drunk', 'first_roll', 'I can TASTE the dice and they taste like VICTORY!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'first_roll', 'The round is young and I am FERAL with excitement!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'hot_streak', 'You are doing it! The thing! The dice thing! I LOVE IT!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'hot_streak', 'If those dice were people I would hug them ALL!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'hot_streak', '{name} is a DEITY and I am a BELIEVER!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'whiff', 'Zero but I love you MORE than before somehow!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'whiff', 'Nothing matched but EVERYTHING matched in my heart!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'whiff', 'The dice said no but my SOUL said yes!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'close', 'SO CLOSE I can hear angels SINGING your name!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'close', '{matched} matched! I am ASCENDING!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'default', 'I have FEELINGS about that roll and ALL of them are big!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'default', 'Did anyone else just feel the earth SHIFT?!'),
('roll_heckle', 'unhinged', 'loud_obnoxious', 'first_roll', 'IT BEGINS! THE DICE AWAKEN! AHHHHHHH!'),
('roll_heckle', 'unhinged', 'loud_obnoxious', 'hot_streak', 'YES YES YES YES YES YES YES!'),
('roll_heckle', 'unhinged', 'loud_obnoxious', 'whiff', 'NOTHING AND I HAVE NEVER FELT MORE ALIVE!'),
('roll_heckle', 'unhinged', 'loud_obnoxious', 'whiff', 'ZERO! THE VOID IS SCREAMING! I AM ALSO SCREAMING!'),
('roll_heckle', 'unhinged', 'loud_obnoxious', 'close', 'ALMOST! I CANNOT FEEL MY FACE! IS THAT NORMAL?!'),
('roll_heckle', 'unhinged', 'loud_obnoxious', 'default', 'WORDS! DICE! FEELINGS! ALL OF THEM! AT ONCE!'),
('roll_heckle', 'unhinged', 'angry_mean', 'first_roll', 'Roll. I have a bone to pick with fate itself.'),
('roll_heckle', 'unhinged', 'angry_mean', 'first_roll', 'The dice and I have an arrangement. They will fail you.'),
('roll_heckle', 'unhinged', 'angry_mean', 'hot_streak', 'THAT ROLL SHOULD NOT EXIST. I reject it philosophically.'),
('roll_heckle', 'unhinged', 'angry_mean', 'hot_streak', 'Good roll. I am going to have a word with gravity.'),
('roll_heckle', 'unhinged', 'angry_mean', 'whiff', 'The dice KNOW what you did, {name}.'),
('roll_heckle', 'unhinged', 'angry_mean', 'whiff', 'Zero. The dice and I are in agreement for once.'),
('roll_heckle', 'unhinged', 'angry_mean', 'close', 'Almost there and the TENSION is making me dangerous.'),
('roll_heckle', 'unhinged', 'angry_mean', 'default', 'Something about that roll has fundamentally changed me.'),
('roll_heckle', 'unhinged', 'insufferable', 'first_roll', 'The dice tremble. As they should.'),
('roll_heckle', 'unhinged', 'insufferable', 'hot_streak', 'Good. The dice are learning their place.'),
('roll_heckle', 'unhinged', 'insufferable', 'whiff', 'Nothing. I predicted this. I predicted everything.'),
('roll_heckle', 'unhinged', 'insufferable', 'close', 'So close. The universe is testing my patience. Again.'),
('roll_heckle', 'unhinged', 'insufferable', 'default', 'That roll exists outside of conventional analysis.');

-- ═══════════════════════════════════════════════════════════════════════════
-- MYSTERIOUS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'mysterious', 'friendly_drunk', 'first_roll', 'The cards said — wait, wrong game. The DICE say go!'),
('roll_heckle', 'mysterious', 'friendly_drunk', 'first_roll', 'I sense... dice. Yes, definitely dice.'),
('roll_heckle', 'mysterious', 'friendly_drunk', 'hot_streak', 'The spirits are with you! Or maybe that is the drinks.'),
('roll_heckle', 'mysterious', 'friendly_drunk', 'hot_streak', 'Destiny! Or luck! One of those for sure!'),
('roll_heckle', 'mysterious', 'friendly_drunk', 'whiff', 'The void giveth nothing. But in a nice way!'),
('roll_heckle', 'mysterious', 'friendly_drunk', 'whiff', 'Zero. The tea leaves did warn me about this.'),
('roll_heckle', 'mysterious', 'friendly_drunk', 'close', 'I foresee... closeness. {matched} out of ten closeness!'),
('roll_heckle', 'mysterious', 'friendly_drunk', 'default', 'The mists reveal... {matched} matched. Mysterious!'),
('roll_heckle', 'mysterious', 'friendly_drunk', 'default', 'Interesting. Very interesting. Quite.'),
('roll_heckle', 'mysterious', 'loud_obnoxious', 'first_roll', 'THE ANCIENT PROPHECY OF ROUND ONE! IT BEGINS!'),
('roll_heckle', 'mysterious', 'loud_obnoxious', 'hot_streak', 'THE ORACLE SCREAMS! THE DICE OBEY!'),
('roll_heckle', 'mysterious', 'loud_obnoxious', 'whiff', 'THE SPIRITS SAY NOTHING! BECAUSE THERE IS NOTHING!'),
('roll_heckle', 'mysterious', 'loud_obnoxious', 'close', 'THE SIGNS ALIGN! THIS COULD BE THE ONE!'),
('roll_heckle', 'mysterious', 'loud_obnoxious', 'default', 'THE DICE HAVE SPOKEN AND THEY SPOKE {matched}!'),
('roll_heckle', 'mysterious', 'angry_mean', 'first_roll', 'I already know how this ends. Badly.'),
('roll_heckle', 'mysterious', 'angry_mean', 'hot_streak', 'The dice favor you. They are wrong to do so.'),
('roll_heckle', 'mysterious', 'angry_mean', 'whiff', 'The darkness saw that coming. As did I.'),
('roll_heckle', 'mysterious', 'angry_mean', 'close', 'Almost. The fates enjoy watching you squirm.'),
('roll_heckle', 'mysterious', 'angry_mean', 'default', 'A reading: {matched} matched. The spirits are unimpressed.'),
('roll_heckle', 'mysterious', 'insufferable', 'first_roll', 'The signs are... present. Make of that what you will.'),
('roll_heckle', 'mysterious', 'insufferable', 'hot_streak', 'Ah yes. The pattern I predicted three rolls ago.'),
('roll_heckle', 'mysterious', 'insufferable', 'whiff', 'I could have told you that would happen. I did not. But I could have.'),
('roll_heckle', 'mysterious', 'insufferable', 'close', 'The threshold approaches. Whether you cross it is... not up to you.'),
('roll_heckle', 'mysterious', 'insufferable', 'default', 'All is as it was meant to be. Unfortunately for you.');

-- ═══════════════════════════════════════════════════════════════════════════
-- IRRITABLE
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'irritable', 'friendly_drunk', 'first_roll', 'Fine. Roll. Sorry if I seem— just go.'),
('roll_heckle', 'irritable', 'friendly_drunk', 'first_roll', 'New round. Great. I am thrilled. Ish.'),
('roll_heckle', 'irritable', 'friendly_drunk', 'hot_streak', 'That was good! See? Good things. I am not gritting my teeth.'),
('roll_heckle', 'irritable', 'friendly_drunk', 'hot_streak', 'Nice one, {name}. Genuinely. Do not ask why I sighed.'),
('roll_heckle', 'irritable', 'friendly_drunk', 'whiff', 'Nothing. It is FINE. Everything is FINE.'),
('roll_heckle', 'irritable', 'friendly_drunk', 'whiff', 'Zero. I am supportive. Supportively annoyed, but supportive.'),
('roll_heckle', 'irritable', 'friendly_drunk', 'close', 'Just finish it. Please. I need this to end well.'),
('roll_heckle', 'irritable', 'friendly_drunk', 'default', 'Yeah. Good. Fine. Whatever. You are doing fine.'),
('roll_heckle', 'irritable', 'loud_obnoxious', 'first_roll', 'CAN WE JUST— UGH— FINE! ROLL!'),
('roll_heckle', 'irritable', 'loud_obnoxious', 'hot_streak', 'OKAY THAT WAS ACTUALLY— *deep breath* — GOOD!'),
('roll_heckle', 'irritable', 'loud_obnoxious', 'whiff', 'SERIOUSLY?! NOTHING?! I CANNOT— *breathes* — FINE!'),
('roll_heckle', 'irritable', 'loud_obnoxious', 'close', 'JUST END IT! PLEASE! MY NERVES!'),
('roll_heckle', 'irritable', 'loud_obnoxious', 'default', '{matched} MATCHED! WHATEVER! NEXT!'),
('roll_heckle', 'irritable', 'angry_mean', 'first_roll', 'What. Get on with it.'),
('roll_heckle', 'irritable', 'angry_mean', 'hot_streak', 'Good. Finally. Was that so hard?'),
('roll_heckle', 'irritable', 'angry_mean', 'whiff', 'Zero. You are TESTING me, {name}.'),
('roll_heckle', 'irritable', 'angry_mean', 'whiff', 'Nothing. My patience is a finite resource and you are spending it.'),
('roll_heckle', 'irritable', 'angry_mean', 'close', 'Close. If you do not finish this soon I will lose it.'),
('roll_heckle', 'irritable', 'angry_mean', 'default', 'Sure. {matched}. Fantastic.'),
('roll_heckle', 'irritable', 'insufferable', 'first_roll', 'Must we? Yes, I suppose we must.'),
('roll_heckle', 'irritable', 'insufferable', 'hot_streak', 'Adequate. Finally.'),
('roll_heckle', 'irritable', 'insufferable', 'whiff', 'Zero. My patience for this is not.'),
('roll_heckle', 'irritable', 'insufferable', 'close', 'Close. Please do not make me endure another round of this.'),
('roll_heckle', 'irritable', 'insufferable', 'default', 'Noted. Reluctantly.');

-- ═══════════════════════════════════════════════════════════════════════════
-- SUFFOCATING
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'suffocating', 'friendly_drunk', 'first_roll', 'Here... we... go... *wheeze*'),
('roll_heckle', 'suffocating', 'friendly_drunk', 'first_roll', 'New round... I am here... barely...'),
('roll_heckle', 'suffocating', 'friendly_drunk', 'hot_streak', 'That was... so good... I might... faint...'),
('roll_heckle', 'suffocating', 'friendly_drunk', 'hot_streak', 'Amazing... I would clap but... my arms...'),
('roll_heckle', 'suffocating', 'friendly_drunk', 'whiff', 'Nothing... same... energy... as me...'),
('roll_heckle', 'suffocating', 'friendly_drunk', 'whiff', 'Zero... we are all zeros... today...'),
('roll_heckle', 'suffocating', 'friendly_drunk', 'close', 'So close... I believe... in... you...'),
('roll_heckle', 'suffocating', 'friendly_drunk', 'default', 'Still here... still watching... mostly...'),
('roll_heckle', 'suffocating', 'loud_obnoxious', 'first_roll', 'ROLL! DICE! I AM... *trails off*'),
('roll_heckle', 'suffocating', 'loud_obnoxious', 'hot_streak', 'AMAZ... amaz... yeah.'),
('roll_heckle', 'suffocating', 'loud_obnoxious', 'whiff', 'NOTH... I cannot even finish the word.'),
('roll_heckle', 'suffocating', 'loud_obnoxious', 'close', 'SO CL... so close... ugh...'),
('roll_heckle', 'suffocating', 'loud_obnoxious', 'default', '{matched}... MATCH... matched. Yeah.'),
('roll_heckle', 'suffocating', 'angry_mean', 'first_roll', 'Roll. I cannot muster anything else.'),
('roll_heckle', 'suffocating', 'angry_mean', 'hot_streak', 'Good roll. I hate that I have to acknowledge it.'),
('roll_heckle', 'suffocating', 'angry_mean', 'whiff', 'Zero. At least we match.'),
('roll_heckle', 'suffocating', 'angry_mean', 'close', 'Almost. Can you finish before I run out of energy to care?'),
('roll_heckle', 'suffocating', 'angry_mean', 'default', 'That happened. I witnessed it. Barely.'),
('roll_heckle', 'suffocating', 'insufferable', 'first_roll', 'Another round. My enthusiasm has flatlined.'),
('roll_heckle', 'suffocating', 'insufferable', 'hot_streak', 'Good. I would elaborate but I physically cannot.'),
('roll_heckle', 'suffocating', 'insufferable', 'whiff', 'Zero. Even the commentary is running on fumes.'),
('roll_heckle', 'suffocating', 'insufferable', 'close', 'Almost. Please. I need this to end.'),
('roll_heckle', 'suffocating', 'insufferable', 'default', 'The bare minimum of acknowledgment: {matched} matched.');

-- ═══════════════════════════════════════════════════════════════════════════
-- MANIC
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'manic', 'friendly_drunk', 'first_roll', 'FIRSTROLL BESTROLL LETSGOOOO {name}!'),
('roll_heckle', 'manic', 'friendly_drunk', 'first_roll', 'New round new you new dice new EVERYTHING!'),
('roll_heckle', 'manic', 'friendly_drunk', 'hot_streak', 'YES AND THEN — MORE AND — {name} IS — YES!'),
('roll_heckle', 'manic', 'friendly_drunk', 'whiff', 'ZERO BUT HONESTLY WHO IS COUNTING — I AM — ZERO — NEXT!'),
('roll_heckle', 'manic', 'friendly_drunk', 'close', 'ALMOSTALMOSTALMOST COME ON COME ON!'),
('roll_heckle', 'manic', 'friendly_drunk', 'default', 'ROLLROLLROLL LOVE IT LOVE YOU LOVE DICE!'),
('roll_heckle', 'manic', 'loud_obnoxious', 'first_roll', 'AAAND WE ARE OFF! IMMEDIATELY! RIGHT NOW! GO!'),
('roll_heckle', 'manic', 'loud_obnoxious', 'hot_streak', 'MORE! MATCHED! HOW MANY! WHO CARES! MORE!'),
('roll_heckle', 'manic', 'loud_obnoxious', 'whiff', 'NOTHING! DOES NOT MATTER! NEXT! NOW! GO! ROLL!'),
('roll_heckle', 'manic', 'loud_obnoxious', 'close', 'THISCOULDBETHEONE THISCOULDBETHEONE!'),
('roll_heckle', 'manic', 'loud_obnoxious', 'default', 'THINGS! HAPPENING! FAST! YES!'),
('roll_heckle', 'manic', 'angry_mean', 'first_roll', 'Roll. Faster. Faster than that. GO.'),
('roll_heckle', 'manic', 'angry_mean', 'hot_streak', 'Good — next — come on — good is not enough — MORE.'),
('roll_heckle', 'manic', 'angry_mean', 'whiff', 'Nothing — already hated it — roll again — NOW.'),
('roll_heckle', 'manic', 'angry_mean', 'close', 'FINISH. IT. I cannot take another roll of this.'),
('roll_heckle', 'manic', 'angry_mean', 'default', 'Too slow. {matched} matched. Not enough. Again.'),
('roll_heckle', 'manic', 'insufferable', 'first_roll', 'Begin. I have already analyzed the next twelve outcomes.'),
('roll_heckle', 'manic', 'insufferable', 'hot_streak', 'As I predicted four microseconds ago. Next.'),
('roll_heckle', 'manic', 'insufferable', 'whiff', 'Zero. I processed this disappointment before you did. Moving on.'),
('roll_heckle', 'manic', 'insufferable', 'close', 'Almost. I knew before you rolled. Finish already.'),
('roll_heckle', 'manic', 'insufferable', 'default', 'Noted analyzed catalogued dismissed. Next.');

-- ═══════════════════════════════════════════════════════════════════════════
-- RESTLESS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'restless', 'friendly_drunk', 'first_roll', 'Finally! First roll! I have been WAITING!'),
('roll_heckle', 'restless', 'friendly_drunk', 'hot_streak', 'YES keep going keep going keep going!'),
('roll_heckle', 'restless', 'friendly_drunk', 'hot_streak', 'More! Faster! You are on a STREAK!'),
('roll_heckle', 'restless', 'friendly_drunk', 'whiff', 'Nothing?! Quick, roll again before the energy dies!'),
('roll_heckle', 'restless', 'friendly_drunk', 'close', 'SO close just ONE more come ON!'),
('roll_heckle', 'restless', 'friendly_drunk', 'default', 'Good now AGAIN! No breaks! MOMENTUM!'),
('roll_heckle', 'restless', 'loud_obnoxious', 'first_roll', 'FINALLY WE ARE ROLLING! I COULD NOT WAIT ANYMORE!'),
('roll_heckle', 'restless', 'loud_obnoxious', 'hot_streak', 'FASTER! MORE! DO NOT STOP! EVER!'),
('roll_heckle', 'restless', 'loud_obnoxious', 'whiff', 'NOTHING?! ROLL AGAIN! NOW! IMMEDIATELY!'),
('roll_heckle', 'restless', 'loud_obnoxious', 'close', 'COME ONNN! FINISH THIS! I CANNOT TAKE THE WAITING!'),
('roll_heckle', 'restless', 'loud_obnoxious', 'default', 'NEXT ROLL! NOW! LET US GO!'),
('roll_heckle', 'restless', 'angry_mean', 'first_roll', 'About time. Get moving, {name}.'),
('roll_heckle', 'restless', 'angry_mean', 'hot_streak', 'Good. Keep that pace. Do not slow down.'),
('roll_heckle', 'restless', 'angry_mean', 'whiff', 'Nothing. Wonderful. Can you fail more quickly?'),
('roll_heckle', 'restless', 'angry_mean', 'close', 'Finish already. My patience ran out three rolls ago.'),
('roll_heckle', 'restless', 'angry_mean', 'default', 'Tick tock, {name}. Tick. Tock.'),
('roll_heckle', 'restless', 'insufferable', 'first_roll', 'Oh finally. I have been waiting since the last ice age.'),
('roll_heckle', 'restless', 'insufferable', 'hot_streak', 'Good. Now do that again immediately.'),
('roll_heckle', 'restless', 'insufferable', 'whiff', 'Nothing. Do try to be more efficient with your failures.'),
('roll_heckle', 'restless', 'insufferable', 'close', 'Almost. I aged visibly waiting for this.'),
('roll_heckle', 'restless', 'insufferable', 'default', 'Noted. Could you note things faster?');

-- ═══════════════════════════════════════════════════════════════════════════
-- BITTER
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'bitter', 'friendly_drunk', 'first_roll', 'Good luck. Some of us never had any but... you go.'),
('roll_heckle', 'bitter', 'friendly_drunk', 'hot_streak', 'Must be nice. No really. Must be really nice.'),
('roll_heckle', 'bitter', 'friendly_drunk', 'whiff', 'Welcome to the nothing club. Meetings are constant.'),
('roll_heckle', 'bitter', 'friendly_drunk', 'whiff', 'Zero. I know the feeling, buddy. Intimately.'),
('roll_heckle', 'bitter', 'friendly_drunk', 'close', 'Almost there. That is where I live. Almost There.'),
('roll_heckle', 'bitter', 'friendly_drunk', 'default', 'Nice roll. Nicer than mine ever were. But nice.'),
('roll_heckle', 'bitter', 'loud_obnoxious', 'first_roll', 'OH LOOK! ANOTHER ROUND FOR EVERYONE ELSE TO ENJOY!'),
('roll_heckle', 'bitter', 'loud_obnoxious', 'whiff', 'NOTHING! JOIN ME IN THE PIT, {name}!'),
('roll_heckle', 'bitter', 'loud_obnoxious', 'close', 'SO CLOSE! I WOULD NOT KNOW WHAT THAT FEELS LIKE!'),
('roll_heckle', 'bitter', 'loud_obnoxious', 'default', 'COOL! GREAT ROLL! FOR {name}! AS ALWAYS! NOT JEALOUS!'),
('roll_heckle', 'bitter', 'angry_mean', 'first_roll', 'Roll away. Some of us remember when rolls meant something.'),
('roll_heckle', 'bitter', 'angry_mean', 'hot_streak', 'Of course. The dice love you. They never loved me.'),
('roll_heckle', 'bitter', 'angry_mean', 'whiff', 'Nothing. Now you know how it feels. Get comfortable.'),
('roll_heckle', 'bitter', 'angry_mean', 'close', 'Almost. I have been almost for years. You will get used to it.'),
('roll_heckle', 'bitter', 'angry_mean', 'default', 'Good for you, {name}. Really. Good. For. You.'),
('roll_heckle', 'bitter', 'insufferable', 'first_roll', 'Another round. For those of us still trying.'),
('roll_heckle', 'bitter', 'insufferable', 'hot_streak', 'How wonderful for you. Some of us peaked long ago.'),
('roll_heckle', 'bitter', 'insufferable', 'whiff', 'Nothing. I could have told you. I have experience with nothing.'),
('roll_heckle', 'bitter', 'insufferable', 'close', 'Almost. A word I have come to despise.'),
('roll_heckle', 'bitter', 'insufferable', 'default', 'Enjoy your {matched}. Some of us appreciate what we have.');

-- ═══════════════════════════════════════════════════════════════════════════
-- STIR_CRAZY
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'stir_crazy', 'friendly_drunk', 'first_roll', 'FINALLY a roll! I was going NUTS over here!'),
('roll_heckle', 'stir_crazy', 'friendly_drunk', 'hot_streak', 'YES! Action! Drama! DICE! I NEEDED this!'),
('roll_heckle', 'stir_crazy', 'friendly_drunk', 'hot_streak', 'More matched! More excitement! DO NOT STOP!'),
('roll_heckle', 'stir_crazy', 'friendly_drunk', 'whiff', 'Nothing?! Quick, roll again, I need STIMULATION!'),
('roll_heckle', 'stir_crazy', 'friendly_drunk', 'close', 'Almost! I am VIBRATING with anticipation!'),
('roll_heckle', 'stir_crazy', 'friendly_drunk', 'default', 'Any roll is a good roll when you have been this bored!'),
('roll_heckle', 'stir_crazy', 'loud_obnoxious', 'first_roll', 'A ROLL! AN ACTUAL ROLL! I HAVE BEEN WAITING FOREVER!'),
('roll_heckle', 'stir_crazy', 'loud_obnoxious', 'hot_streak', 'YES YES YES THINGS ARE HAPPENING! FINALLY!'),
('roll_heckle', 'stir_crazy', 'loud_obnoxious', 'whiff', 'NOTHING! BUT AT LEAST SOMETHING HAPPENED! ROLL AGAIN!'),
('roll_heckle', 'stir_crazy', 'loud_obnoxious', 'close', 'ALMOST! I WILL LITERALLY EXPLODE IF THIS DOES NOT END SOON!'),
('roll_heckle', 'stir_crazy', 'loud_obnoxious', 'default', 'MORE! ROLL MORE! I NEED MORE DICE IN MY LIFE!'),
('roll_heckle', 'stir_crazy', 'angry_mean', 'first_roll', 'Finally rolling. I was about to lose my mind. More than I have.'),
('roll_heckle', 'stir_crazy', 'angry_mean', 'hot_streak', 'Good. At least something is happening around here.'),
('roll_heckle', 'stir_crazy', 'angry_mean', 'whiff', 'Nothing. Even the entertainment is disappointing.'),
('roll_heckle', 'stir_crazy', 'angry_mean', 'close', 'Finish it. I cannot take another minute of this.'),
('roll_heckle', 'stir_crazy', 'angry_mean', 'default', 'That passed the time. Barely.'),
('roll_heckle', 'stir_crazy', 'insufferable', 'first_roll', 'Oh a roll. How thrilling. I have been so deprived of stimulation.'),
('roll_heckle', 'stir_crazy', 'insufferable', 'hot_streak', 'Finally, something worth my dwindling attention.'),
('roll_heckle', 'stir_crazy', 'insufferable', 'whiff', 'Nothing. The entertainment value of this is approaching zero.'),
('roll_heckle', 'stir_crazy', 'insufferable', 'close', 'Almost. Please deliver. I am desperate for a conclusion.'),
('roll_heckle', 'stir_crazy', 'insufferable', 'default', 'A roll occurred. In the grand tapestry of my confinement, it was something.');

-- ═══════════════════════════════════════════════════════════════════════════
-- PARANOID
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'paranoid', 'friendly_drunk', 'first_roll', 'Good luck! And I mean that! Unless... no, good luck!'),
('roll_heckle', 'paranoid', 'friendly_drunk', 'first_roll', 'First roll! No pressure! Why would there be pressure? Right?'),
('roll_heckle', 'paranoid', 'friendly_drunk', 'hot_streak', 'Great roll! Great! ...Is it too great? No! Great! ...Right?'),
('roll_heckle', 'paranoid', 'friendly_drunk', 'whiff', 'Nothing. Was that on purpose? No, sorry. Bad roll. Sympathies.'),
('roll_heckle', 'paranoid', 'friendly_drunk', 'whiff', 'Zero. Which is also the number of suspicious things here. Probably.'),
('roll_heckle', 'paranoid', 'friendly_drunk', 'close', 'So close! You are definitely going to— wait why that many?'),
('roll_heckle', 'paranoid', 'friendly_drunk', 'default', 'Nice roll! Normal roll! Nothing weird! Right?'),
('roll_heckle', 'paranoid', 'loud_obnoxious', 'first_roll', 'THE ROUND BEGINS! IS EVERYONE WATCHING?! EVERYONE SHOULD WATCH!'),
('roll_heckle', 'paranoid', 'loud_obnoxious', 'hot_streak', 'HOW?! HOW DID THEY— NO THAT IS FINE! THAT IS FINE! IS IT?!'),
('roll_heckle', 'paranoid', 'loud_obnoxious', 'whiff', 'NOTHING! THAT SEEMS... DELIBERATE! DOES IT NOT?!'),
('roll_heckle', 'paranoid', 'loud_obnoxious', 'close', 'ALMOST! BUT ALMOST WHAT?! WHAT IS REALLY HAPPENING?!'),
('roll_heckle', 'paranoid', 'loud_obnoxious', 'default', 'HMM! OKAY! SURE! I HAVE QUESTIONS BUT SURE!'),
('roll_heckle', 'paranoid', 'angry_mean', 'first_roll', 'Roll. I will be watching. Closely.'),
('roll_heckle', 'paranoid', 'angry_mean', 'hot_streak', 'Interesting roll, {name}. Very interesting. Explain it.'),
('roll_heckle', 'paranoid', 'angry_mean', 'hot_streak', 'Three in a row? The odds of that are... suspicious.'),
('roll_heckle', 'paranoid', 'angry_mean', 'whiff', 'Nothing. Convenient. Are you sandbagging?'),
('roll_heckle', 'paranoid', 'angry_mean', 'close', '{matched} out of 10. You planned this. I know you did.'),
('roll_heckle', 'paranoid', 'angry_mean', 'default', 'Noted. Filed. Cross-referenced.'),
('roll_heckle', 'paranoid', 'insufferable', 'first_roll', 'Interesting. I shall observe. Closely.'),
('roll_heckle', 'paranoid', 'insufferable', 'hot_streak', 'Statistically improbable. I have made a note.'),
('roll_heckle', 'paranoid', 'insufferable', 'whiff', 'Nothing. Or so it appears. Things are rarely what they seem.'),
('roll_heckle', 'paranoid', 'insufferable', 'close', 'Almost there. The question is: by design or by accident?'),
('roll_heckle', 'paranoid', 'insufferable', 'default', 'Interesting. Everything about that was... interesting.');
