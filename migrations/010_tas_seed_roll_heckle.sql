-- TAS roll_heckle phrase seeds.
-- Placeholders: {name}, {matched}, {roll_count}, {target}

-- ═══════════════════════════════════════════════════════════════════════════
-- NEUTRAL — fallback mood, dense coverage (always reachable)
-- ═══════════════════════════════════════════════════════════════════════════

-- neutral × friendly_drunk
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'neutral', 'friendly_drunk', 'first_roll', 'Here we go, {name}!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'first_roll', 'First roll of the round, let us see what you got!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'first_roll', 'Alright {name}, show me something!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'hot_streak', 'Ohhh {name} is heating up!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'hot_streak', 'Look at you go, buddy!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'hot_streak', '{name} is on FIRE right now!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'hot_streak', 'The dice like you today, {name}!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'whiff', 'Oof. Shake it off, {name}!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'whiff', 'Nothing? Nah, next one is yours.'),
('roll_heckle', 'neutral', 'friendly_drunk', 'whiff', 'The dice are just playing hard to get.'),
('roll_heckle', 'neutral', 'friendly_drunk', 'whiff', 'Hey, bad rolls build character!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'close', 'Almost there, {name}! So close!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'close', '{matched} out of 10! You can taste it!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'close', 'ONE more push, come on!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'win', 'YESSS {name}! That is what I am talking about!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'win', '{name} takes it down! Beautiful!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'win', 'Winner winner! {name} did it!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'default', 'Keep it rolling, {name}!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'default', 'Not bad, not bad at all.'),
('roll_heckle', 'neutral', 'friendly_drunk', 'default', '{matched} matched so far, looking good!'),
('roll_heckle', 'neutral', 'friendly_drunk', 'default', 'The journey continues!');

-- neutral × loud_obnoxious
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'neutral', 'loud_obnoxious', 'first_roll', 'AND THEY ARE OFF! {name} OPENS THE ROUND!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'first_roll', 'LADIES AND GENTLEMEN, {name} HAS ENTERED THE CHAT!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'first_roll', 'FIRST ROLL BABYYYY!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'hot_streak', 'OH OH OH! {name} IS LOCKED IN!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'hot_streak', 'SOMEBODY STOP THEM! THEY CANNOT BE STOPPED!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'hot_streak', 'THE DICE BOW BEFORE {name}!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'whiff', 'OHHH NOOO! NOTHING! ABSOLUTELY NOTHING!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'whiff', 'A WHOLE LOT OF NOTHING FROM {name}!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'whiff', 'THE CROWD GOES... mild.'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'close', '{matched} MATCHED! CAN THEY CLOSE IT OUT?!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'close', 'SO CLOSE! THE TENSION IS UNBEARABLE!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'win', 'THEY DID IT! {name} WINS THE ROUND! UNBELIEVABLE!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'win', 'IT IS ALL OVER! {name} IS YOUR CHAMPION!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'default', 'AND {name} ROLLS AGAIN!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'default', '{matched} MATCHED! THE SAGA CONTINUES!'),
('roll_heckle', 'neutral', 'loud_obnoxious', 'default', 'ROLL NUMBER {roll_count} FROM {name}!');

-- neutral × angry_mean
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'neutral', 'angry_mean', 'first_roll', 'Oh good, {name} is rolling. Brace yourselves.'),
('roll_heckle', 'neutral', 'angry_mean', 'first_roll', 'And so it begins. Try not to embarrass yourself.'),
('roll_heckle', 'neutral', 'angry_mean', 'first_roll', 'First roll. Set the bar low and you will not be disappointed.'),
('roll_heckle', 'neutral', 'angry_mean', 'hot_streak', 'Enjoy it while it lasts, {name}.'),
('roll_heckle', 'neutral', 'angry_mean', 'hot_streak', 'Luck. Pure luck. Do not get comfortable.'),
('roll_heckle', 'neutral', 'angry_mean', 'hot_streak', 'Even a broken clock, {name}.'),
('roll_heckle', 'neutral', 'angry_mean', 'whiff', 'Shocking. Absolutely nobody is surprised.'),
('roll_heckle', 'neutral', 'angry_mean', 'whiff', 'Zero. Just like your strategy.'),
('roll_heckle', 'neutral', 'angry_mean', 'whiff', 'The dice have spoken. They said no.'),
('roll_heckle', 'neutral', 'angry_mean', 'whiff', 'Roll {roll_count} and still nothing new. Impressive commitment to failure.'),
('roll_heckle', 'neutral', 'angry_mean', 'close', 'So close. Would be a shame if you choked.'),
('roll_heckle', 'neutral', 'angry_mean', 'close', '{matched} out of 10. Almost competent.'),
('roll_heckle', 'neutral', 'angry_mean', 'win', 'Fine. {name} wins. Moving on.'),
('roll_heckle', 'neutral', 'angry_mean', 'win', 'Congratulations. The dice took pity on you.'),
('roll_heckle', 'neutral', 'angry_mean', 'default', 'That was a roll. Technically.'),
('roll_heckle', 'neutral', 'angry_mean', 'default', '{matched} matched. I have seen worse. Barely.'),
('roll_heckle', 'neutral', 'angry_mean', 'default', 'Adequate. And I use that word loosely.');

-- neutral × insufferable
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'neutral', 'insufferable', 'first_roll', 'Ah, {name} begins. How... brave.'),
('roll_heckle', 'neutral', 'insufferable', 'first_roll', 'The first roll. A blank canvas for mediocrity.'),
('roll_heckle', 'neutral', 'insufferable', 'first_roll', 'And so {name} takes their first tentative step.'),
('roll_heckle', 'neutral', 'insufferable', 'hot_streak', 'Well well. Even statistics must produce outliers.'),
('roll_heckle', 'neutral', 'insufferable', 'hot_streak', 'A hot streak. I am sure it will correct itself.'),
('roll_heckle', 'neutral', 'insufferable', 'hot_streak', 'How delightful. You are performing above expectations. The expectations were quite low.'),
('roll_heckle', 'neutral', 'insufferable', 'whiff', 'And there it is.'),
('roll_heckle', 'neutral', 'insufferable', 'whiff', 'Zero new matches. The dice are... candid.'),
('roll_heckle', 'neutral', 'insufferable', 'whiff', 'I would say better luck next time, but we both know.'),
('roll_heckle', 'neutral', 'insufferable', 'close', '{matched} out of 10. So close. So very, very close.'),
('roll_heckle', 'neutral', 'insufferable', 'close', 'Almost there. I wonder if almost counts.'),
('roll_heckle', 'neutral', 'insufferable', 'win', 'Oh. You won. How... unexpected.'),
('roll_heckle', 'neutral', 'insufferable', 'win', '{name} wins. Mark the calendar.'),
('roll_heckle', 'neutral', 'insufferable', 'default', 'And the saga of {name} continues.'),
('roll_heckle', 'neutral', 'insufferable', 'default', 'Noted.'),
('roll_heckle', 'neutral', 'insufferable', 'default', '{matched} matched. A number. That is certainly a number.');

-- ═══════════════════════════════════════════════════════════════════════════
-- SUNNY — common weather mood, dense coverage
-- ═══════════════════════════════════════════════════════════════════════════

-- sunny × friendly_drunk
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'sunny', 'friendly_drunk', 'first_roll', 'What a beautiful day to roll some dice, {name}!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'first_roll', 'I got a good feeling about this one, {name}!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'hot_streak', '{name} is GLOWING right now!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'hot_streak', 'Everything is coming up {name}!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'hot_streak', 'Can you feel that? That is momentum, baby!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'whiff', 'Pffft, who cares! Life is beautiful, {name}!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'whiff', 'Nothing matched but honestly? Still having a great time.'),
('roll_heckle', 'sunny', 'friendly_drunk', 'whiff', 'The universe has plans for you, buddy. Just not that roll.'),
('roll_heckle', 'sunny', 'friendly_drunk', 'close', 'OH MAN {name}, you are RIGHT THERE!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'close', 'I believe! I BELIEVE IN {name}!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'win', '{name}! CHAMP! You absolute LEGEND!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'win', 'I knew it! I KNEW you had it in you!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'default', 'Love the energy, {name}!'),
('roll_heckle', 'sunny', 'friendly_drunk', 'default', 'Every roll is a gift and you are giving!');

-- sunny × loud_obnoxious
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'sunny', 'loud_obnoxious', 'first_roll', 'WHAT A GLORIOUS DAY FOR DICE! GO {name} GO!'),
('roll_heckle', 'sunny', 'loud_obnoxious', 'hot_streak', 'UNSTOPPABLE! {name} IS ABSOLUTELY UNSTOPPABLE!'),
('roll_heckle', 'sunny', 'loud_obnoxious', 'hot_streak', 'I AM SO HAPPY RIGHT NOW I COULD CRY!'),
('roll_heckle', 'sunny', 'loud_obnoxious', 'whiff', 'WHOOPSIE! BUT WHO CARES! ROLL AGAIN!'),
('roll_heckle', 'sunny', 'loud_obnoxious', 'whiff', 'NOTHING?! DOES NOT MATTER! EVERYTHING IS GREAT!'),
('roll_heckle', 'sunny', 'loud_obnoxious', 'close', 'THEY ARE SO CLOSE I CAN TASTE IT!'),
('roll_heckle', 'sunny', 'loud_obnoxious', 'win', 'YEEEESSSSS! THE GREATEST ROLL IN HISTORY! {name} FOREVER!'),
('roll_heckle', 'sunny', 'loud_obnoxious', 'default', 'ANOTHER ROLL! ANOTHER BEAUTIFUL ROLL!');

-- sunny × angry_mean
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'sunny', 'angry_mean', 'first_roll', 'What a lovely day to watch you fail, {name}.'),
('roll_heckle', 'sunny', 'angry_mean', 'hot_streak', 'How nice for you. Really. I am thrilled.'),
('roll_heckle', 'sunny', 'angry_mean', 'whiff', 'Aww! Zero matches! Is that not adorable.'),
('roll_heckle', 'sunny', 'angry_mean', 'whiff', 'Nothing! On a day this nice! That takes talent.'),
('roll_heckle', 'sunny', 'angry_mean', 'close', 'So close! It would be hilarious if you blew it now.'),
('roll_heckle', 'sunny', 'angry_mean', 'win', 'You won! The bar was underground and you still barely cleared it.'),
('roll_heckle', 'sunny', 'angry_mean', 'default', 'Keep going, {name}. It can always get worse.');

-- sunny × insufferable
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'sunny', 'insufferable', 'first_roll', 'What a wonderful day for a learning experience, {name}.'),
('roll_heckle', 'sunny', 'insufferable', 'hot_streak', 'Oh how wonderful! You are learning!'),
('roll_heckle', 'sunny', 'insufferable', 'whiff', 'Do not worry. Growth is not always linear.'),
('roll_heckle', 'sunny', 'insufferable', 'close', 'So close! I am sure the participation is what matters.'),
('roll_heckle', 'sunny', 'insufferable', 'win', 'You did it! I am so proud. Like a parent at a school play.'),
('roll_heckle', 'sunny', 'insufferable', 'default', 'Every roll is progress. In its own small way.');

-- ═══════════════════════════════════════════════════════════════════════════
-- GRUMPY — common weather mood, dense coverage
-- ═══════════════════════════════════════════════════════════════════════════

-- grumpy × friendly_drunk
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'grumpy', 'friendly_drunk', 'first_roll', 'Ugh, fine. Go ahead and roll, {name}.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'first_roll', 'Here we go I guess. Good luck or whatever.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'hot_streak', 'Okay FINE, that was actually pretty good.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'hot_streak', 'I hate to admit it but... nice one, {name}.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'whiff', 'Yeah that figures. Hang in there though.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'whiff', 'Ugh. At least you are trying. That counts for something.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'close', 'Oh come ON, just finish it already, {name}!'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'close', 'You are SO close, do not mess this up. Please.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'win', 'FINALLY. Good job, {name}. I mean it. Grumpily.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'win', 'About time! But seriously, nice one.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'default', 'Mmph. That happened.'),
('roll_heckle', 'grumpy', 'friendly_drunk', 'default', 'Could be worse. Could be better. But could be worse.');

-- grumpy × loud_obnoxious
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'grumpy', 'loud_obnoxious', 'first_roll', 'OH GREAT, HERE WE GO AGAIN!'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'hot_streak', 'OKAY FINE THAT WAS GOOD! ARE YOU HAPPY?!'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'whiff', 'NOTHING?! COME ONNNN!'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'whiff', 'UGH! I CANNOT WATCH THIS!'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'close', 'JUST FINISH IT! PLEASE! I AM BEGGING!'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'win', 'FINALLY! THANK YOU! IT IS OVER!'),
('roll_heckle', 'grumpy', 'loud_obnoxious', 'default', 'UGH. {matched} MATCHED. WHATEVER!');

-- grumpy × angry_mean
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'grumpy', 'angry_mean', 'first_roll', 'Get on with it, {name}.'),
('roll_heckle', 'grumpy', 'angry_mean', 'hot_streak', 'Do not let this go to your head.'),
('roll_heckle', 'grumpy', 'angry_mean', 'whiff', 'Pathetic.'),
('roll_heckle', 'grumpy', 'angry_mean', 'whiff', 'The dice are embarrassed for you, {name}.'),
('roll_heckle', 'grumpy', 'angry_mean', 'whiff', 'Roll {roll_count}. Zero progress. Classic {name}.'),
('roll_heckle', 'grumpy', 'angry_mean', 'close', 'Finish it or do not. I am tired of watching.'),
('roll_heckle', 'grumpy', 'angry_mean', 'win', 'About time. That was painful to watch.'),
('roll_heckle', 'grumpy', 'angry_mean', 'default', 'Figures.');

-- grumpy × insufferable
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'grumpy', 'insufferable', 'first_roll', 'Oh, we are doing this. Wonderful.'),
('roll_heckle', 'grumpy', 'insufferable', 'hot_streak', 'Well. That was statistically improbable for you.'),
('roll_heckle', 'grumpy', 'insufferable', 'whiff', 'I would say I expected better, but that would be dishonest.'),
('roll_heckle', 'grumpy', 'insufferable', 'whiff', 'Hmm. Consistent, at least.'),
('roll_heckle', 'grumpy', 'insufferable', 'close', 'Almost. The story of your game, really.'),
('roll_heckle', 'grumpy', 'insufferable', 'win', 'You managed. Well done. I suppose.'),
('roll_heckle', 'grumpy', 'insufferable', 'default', 'Mmhm.');

-- ═══════════════════════════════════════════════════════════════════════════
-- BORED — common weather mood
-- ═══════════════════════════════════════════════════════════════════════════

-- bored × friendly_drunk
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'bored', 'friendly_drunk', 'first_roll', 'Oh hey, {name} is rolling. Cool cool cool.'),
('roll_heckle', 'bored', 'friendly_drunk', 'hot_streak', 'Wait what? Oh nice, {name}! I was spacing out.'),
('roll_heckle', 'bored', 'friendly_drunk', 'whiff', 'Nothing? Yeah that tracks. You will get it though.'),
('roll_heckle', 'bored', 'friendly_drunk', 'close', 'Wait you are actually close? Go go go!'),
('roll_heckle', 'bored', 'friendly_drunk', 'win', 'Oh snap, {name} won?! I should have been paying attention!'),
('roll_heckle', 'bored', 'friendly_drunk', 'default', 'Mmhmm. Nice. Yeah.');

-- bored × loud_obnoxious
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'bored', 'loud_obnoxious', 'first_roll', 'OKAY I GUESS THIS IS HAPPENING!'),
('roll_heckle', 'bored', 'loud_obnoxious', 'hot_streak', 'WAIT ACTUALLY THAT WAS KINDA COOL!'),
('roll_heckle', 'bored', 'loud_obnoxious', 'whiff', 'WOW. NOTHING. WOOOOOOW.'),
('roll_heckle', 'bored', 'loud_obnoxious', 'close', 'OKAY NOW I AM PAYING ATTENTION!'),
('roll_heckle', 'bored', 'loud_obnoxious', 'win', 'OH WAIT THEY WON?! I MISSED THE GOOD PART!'),
('roll_heckle', 'bored', 'loud_obnoxious', 'default', 'THAT SURE WAS... A ROLL!');

-- bored × angry_mean
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'bored', 'angry_mean', 'first_roll', 'Wake me when it gets interesting.'),
('roll_heckle', 'bored', 'angry_mean', 'hot_streak', 'Oh. You did something. Good for you.'),
('roll_heckle', 'bored', 'angry_mean', 'whiff', 'Nothing. How deeply unsurprising.'),
('roll_heckle', 'bored', 'angry_mean', 'whiff', 'Are you trying to bore me to death, {name}?'),
('roll_heckle', 'bored', 'angry_mean', 'close', 'Finish already. Some of us have things to do.'),
('roll_heckle', 'bored', 'angry_mean', 'win', 'Great. Can we move on now?'),
('roll_heckle', 'bored', 'angry_mean', 'default', 'Still going, huh.');

-- bored × insufferable
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'bored', 'insufferable', 'first_roll', 'And so it begins. Again.'),
('roll_heckle', 'bored', 'insufferable', 'hot_streak', 'Hmm. That was almost interesting.'),
('roll_heckle', 'bored', 'insufferable', 'whiff', 'Nothing. As foretold.'),
('roll_heckle', 'bored', 'insufferable', 'close', 'You are close. I wonder how many times I will say that.'),
('roll_heckle', 'bored', 'insufferable', 'win', 'Oh. You finished. How... prompt.'),
('roll_heckle', 'bored', 'insufferable', 'default', 'Mmhm. Fascinating.');

-- ═══════════════════════════════════════════════════════════════════════════
-- COZY — moderate coverage
-- ═══════════════════════════════════════════════════════════════════════════

-- cozy × friendly_drunk
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'cozy', 'friendly_drunk', 'first_roll', 'Snuggle in and roll, {name}!'),
('roll_heckle', 'cozy', 'friendly_drunk', 'hot_streak', 'Aww, look at you! All warm and winning!'),
('roll_heckle', 'cozy', 'friendly_drunk', 'whiff', 'That is okay, sweetie. Bad rolls happen to good people.'),
('roll_heckle', 'cozy', 'friendly_drunk', 'close', 'You are so close! I am wrapping you in good vibes!'),
('roll_heckle', 'cozy', 'friendly_drunk', 'win', '{name} did it! Group hug! GROUP HUG!'),
('roll_heckle', 'cozy', 'friendly_drunk', 'default', 'Doing great, hon!');

-- cozy × angry_mean
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'cozy', 'angry_mean', 'whiff', 'Oh sweetie. Bless your heart.'),
('roll_heckle', 'cozy', 'angry_mean', 'whiff', 'There there, {name}. Not everyone can be good at things.'),
('roll_heckle', 'cozy', 'angry_mean', 'hot_streak', 'How nice for you, dear. Really.'),
('roll_heckle', 'cozy', 'angry_mean', 'win', 'Oh you won! Let me get you a little trophy. A tiny one.'),
('roll_heckle', 'cozy', 'angry_mean', 'default', 'Keep trying, sweetheart. Keep trying.');

-- cozy × insufferable
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'cozy', 'insufferable', 'whiff', 'Oh no, let us not get upset about that little roll.'),
('roll_heckle', 'cozy', 'insufferable', 'hot_streak', 'Well done! Would you like a sticker?'),
('roll_heckle', 'cozy', 'insufferable', 'win', 'You did it all by yourself! I am so proud.'),
('roll_heckle', 'cozy', 'insufferable', 'default', 'You are doing your best and that is what matters.');

-- ═══════════════════════════════════════════════════════════════════════════
-- MELANCHOLIC — moderate coverage
-- ═══════════════════════════════════════════════════════════════════════════

-- melancholic × friendly_drunk
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'melancholic', 'friendly_drunk', 'first_roll', 'Here goes nothing... and I mean that beautifully.'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'hot_streak', 'That was... beautiful. I am not crying. Shut up.'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'whiff', 'Nothing. But you know what? The roll itself was the journey.'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'close', 'So close... it is like a poem about almost.'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'win', 'You did it, {name}. And it meant something. To me.'),
('roll_heckle', 'melancholic', 'friendly_drunk', 'default', 'Another roll. Another memory.');

-- melancholic × angry_mean
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'melancholic', 'angry_mean', 'whiff', 'Nothing. Add it to the pile of disappointments.'),
('roll_heckle', 'melancholic', 'angry_mean', 'hot_streak', 'A good roll. Enjoy it. They do not last.'),
('roll_heckle', 'melancholic', 'angry_mean', 'close', 'So close. Almost is a cruel word, {name}.'),
('roll_heckle', 'melancholic', 'angry_mean', 'win', 'You won. But at what cost.'),
('roll_heckle', 'melancholic', 'angry_mean', 'default', 'Roll after roll. Is this all there is?');

-- melancholic × loud_obnoxious
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'melancholic', 'loud_obnoxious', 'whiff', 'NOOOOO! THE PAIN! THE BEAUTIFUL, TERRIBLE PAIN!'),
('roll_heckle', 'melancholic', 'loud_obnoxious', 'hot_streak', 'YES! A MOMENT OF LIGHT IN THE DARKNESS!'),
('roll_heckle', 'melancholic', 'loud_obnoxious', 'win', 'THEY WON! *sobs loudly* THEY ACTUALLY WON!'),
('roll_heckle', 'melancholic', 'loud_obnoxious', 'default', 'ANOTHER ROLL INTO THE VOID!');

-- ═══════════════════════════════════════════════════════════════════════════
-- CHAOTIC — moderate coverage
-- ═══════════════════════════════════════════════════════════════════════════

-- chaotic × friendly_drunk
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'chaotic', 'friendly_drunk', 'first_roll', 'Go go go! Wait what number are we on? GO!'),
('roll_heckle', 'chaotic', 'friendly_drunk', 'hot_streak', 'YES! Wait — yes! That was — hang on — YES!'),
('roll_heckle', 'chaotic', 'friendly_drunk', 'whiff', 'Nothing! But also did you see that — anyway, roll again!'),
('roll_heckle', 'chaotic', 'friendly_drunk', 'win', '{name} won! I think! Did they? YES THEY DID!'),
('roll_heckle', 'chaotic', 'friendly_drunk', 'default', 'Things are happening! For {name}!');

-- chaotic × loud_obnoxious
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'chaotic', 'loud_obnoxious', 'hot_streak', 'WHAT! NO! YES! WAIT WHAT!'),
('roll_heckle', 'chaotic', 'loud_obnoxious', 'whiff', 'NOTHING! OR WAIT — NO, NOTHING! AHHH!'),
('roll_heckle', 'chaotic', 'loud_obnoxious', 'win', 'DID THEY — IS IT — YES! NO! YES! {name} WINS!'),
('roll_heckle', 'chaotic', 'loud_obnoxious', 'default', 'I DO NOT KNOW WHAT IS HAPPENING BUT I AM HERE FOR IT!');

-- chaotic × angry_mean
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'chaotic', 'angry_mean', 'whiff', 'That — and ANOTHER thing about your last roll —'),
('roll_heckle', 'chaotic', 'angry_mean', 'hot_streak', 'Fine! FINE! But your LAST roll was still garbage!'),
('roll_heckle', 'chaotic', 'angry_mean', 'win', 'Whatever! You still rolled badly three turns ago!'),
('roll_heckle', 'chaotic', 'angry_mean', 'default', 'I am still mad about roll {roll_count} minus one!');

-- ═══════════════════════════════════════════════════════════════════════════
-- UNHINGED — moderate coverage
-- ═══════════════════════════════════════════════════════════════════════════

-- unhinged × friendly_drunk
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'unhinged', 'friendly_drunk', 'first_roll', 'THE DICE ARE ALIVE AND THEY LOVE YOU, {name}!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'hot_streak', 'YOU ARE A GOD AMONG MORTALS! A BEAUTIFUL DICE GOD!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'whiff', 'NOTHING BUT I STILL LOVE YOU MORE THAN GRAVITY!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'win', 'TRANSCENDENCE! {name} HAS ACHIEVED TRANSCENDENCE!'),
('roll_heckle', 'unhinged', 'friendly_drunk', 'default', 'I AM FEELING THINGS ABOUT THIS ROLL!');

-- unhinged × loud_obnoxious
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'unhinged', 'loud_obnoxious', 'hot_streak', 'AAAAAAAAH! AAAAAAAAAH! YES!'),
('roll_heckle', 'unhinged', 'loud_obnoxious', 'whiff', 'NOTHING! THE VOID STARES BACK! AHAHAHAHA!'),
('roll_heckle', 'unhinged', 'loud_obnoxious', 'win', '{name}! {name}! {name}! {name}! {name}!'),
('roll_heckle', 'unhinged', 'loud_obnoxious', 'default', '*incoherent screaming*');

-- unhinged × angry_mean
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'unhinged', 'angry_mean', 'whiff', 'Roll like that again and I will flip this — wait, is this a phone?'),
('roll_heckle', 'unhinged', 'angry_mean', 'hot_streak', 'SUSPICIOUS. TOO GOOD. I DO NOT TRUST IT.'),
('roll_heckle', 'unhinged', 'angry_mean', 'win', 'Fine. FINE. You win. I have beef with the number {target} anyway.'),
('roll_heckle', 'unhinged', 'angry_mean', 'default', 'I am going to have WORDS with these dice.');

-- ═══════════════════════════════════════════════════════════════════════════
-- MYSTERIOUS — moderate coverage
-- ═══════════════════════════════════════════════════════════════════════════

-- mysterious × friendly_drunk
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'mysterious', 'friendly_drunk', 'first_roll', 'The dice whisper your name... or maybe Steve. Hard to tell.'),
('roll_heckle', 'mysterious', 'friendly_drunk', 'hot_streak', 'The stars align for you, {name}! Or is that my vision?'),
('roll_heckle', 'mysterious', 'friendly_drunk', 'whiff', 'The universe works in mysterious ways. Mostly bad ones tonight.'),
('roll_heckle', 'mysterious', 'friendly_drunk', 'win', 'It was foretold! By me! Just now! But still!'),
('roll_heckle', 'mysterious', 'friendly_drunk', 'default', 'The dice have spoken... I think they said "{matched}."');

-- mysterious × angry_mean
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'mysterious', 'angry_mean', 'whiff', 'I saw this coming. The dice warned me about you.'),
('roll_heckle', 'mysterious', 'angry_mean', 'hot_streak', 'Interesting. The dice have chosen unwisely.'),
('roll_heckle', 'mysterious', 'angry_mean', 'close', 'So close. But the fates are not done with you yet.'),
('roll_heckle', 'mysterious', 'angry_mean', 'win', 'The prophecy is fulfilled. Unfortunately.'),
('roll_heckle', 'mysterious', 'angry_mean', 'default', 'I knew you would roll that.');

-- mysterious × insufferable
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'mysterious', 'insufferable', 'whiff', 'Some things are better left unrolled.'),
('roll_heckle', 'mysterious', 'insufferable', 'hot_streak', 'Interesting. The pattern reveals itself. To me, at least.'),
('roll_heckle', 'mysterious', 'insufferable', 'win', 'The outcome was never in doubt. For those who can see.'),
('roll_heckle', 'mysterious', 'insufferable', 'default', 'Hmm. Yes. As I suspected.');

-- ═══════════════════════════════════════════════════════════════════════════
-- IRRITABLE — air quality mood, moderate coverage
-- ═══════════════════════════════════════════════════════════════════════════

-- irritable × friendly_drunk
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'irritable', 'friendly_drunk', 'first_roll', 'Go ahead. Roll. Sorry — that came out wrong. Go ahead!'),
('roll_heckle', 'irritable', 'friendly_drunk', 'hot_streak', 'Great roll — sorry, did not mean to sigh. Really, great job.'),
('roll_heckle', 'irritable', 'friendly_drunk', 'whiff', 'Nothing. UGH. No, not at you. You are fine. The dice are fine. Everything is fine.'),
('roll_heckle', 'irritable', 'friendly_drunk', 'win', 'You won! Genuinely happy. The face I am making is happy. Trust me.'),
('roll_heckle', 'irritable', 'friendly_drunk', 'default', 'Good. Fine. Great. Next.');

-- irritable × angry_mean
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'irritable', 'angry_mean', 'first_roll', 'What.'),
('roll_heckle', 'irritable', 'angry_mean', 'hot_streak', 'Fine. Take your matches. Whatever.'),
('roll_heckle', 'irritable', 'angry_mean', 'whiff', 'Of course. Of COURSE, {name}.'),
('roll_heckle', 'irritable', 'angry_mean', 'whiff', 'Nothing. How perfectly on brand for right now.'),
('roll_heckle', 'irritable', 'angry_mean', 'win', 'Great. Wonderful. Are we done?'),
('roll_heckle', 'irritable', 'angry_mean', 'default', 'Can we speed this up?');

-- irritable × loud_obnoxious
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'irritable', 'loud_obnoxious', 'whiff', 'UGH, ANOTHER ROLL? FINE! IT WAS... OKAY I GUESS!'),
('roll_heckle', 'irritable', 'loud_obnoxious', 'hot_streak', 'YEAH GREAT! WHATEVER! GOOD FOR YOU!'),
('roll_heckle', 'irritable', 'loud_obnoxious', 'win', 'FINALLY! CAN WE ALL JUST... *deep breath* CONGRATULATIONS!'),
('roll_heckle', 'irritable', 'loud_obnoxious', 'default', 'OKAY! SURE! THAT HAPPENED! MOVING ON!');

-- ═══════════════════════════════════════════════════════════════════════════
-- SUFFOCATING — air quality mood, moderate coverage
-- ═══════════════════════════════════════════════════════════════════════════

-- suffocating × friendly_drunk
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'suffocating', 'friendly_drunk', 'first_roll', 'Go... {name}... you got this... probably...'),
('roll_heckle', 'suffocating', 'friendly_drunk', 'hot_streak', 'Amazing... truly... *gasp* ...so proud...'),
('roll_heckle', 'suffocating', 'friendly_drunk', 'whiff', 'Nothing... but the effort was... there...'),
('roll_heckle', 'suffocating', 'friendly_drunk', 'win', 'You... did it... {name}... hero...'),
('roll_heckle', 'suffocating', 'friendly_drunk', 'default', 'Still... rolling... good... good...');

-- suffocating × angry_mean
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'suffocating', 'angry_mean', 'whiff', 'I would insult that roll but I do not have the energy.'),
('roll_heckle', 'suffocating', 'angry_mean', 'hot_streak', 'Good for you. I am too tired to be angry. Almost.'),
('roll_heckle', 'suffocating', 'angry_mean', 'win', 'You won. I would clap but my arms are too heavy.'),
('roll_heckle', 'suffocating', 'angry_mean', 'default', 'Sure, {name}. Sure.');

-- suffocating × loud_obnoxious
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'suffocating', 'loud_obnoxious', 'hot_streak', 'THAT WAS A GREAT... a great... ugh.'),
('roll_heckle', 'suffocating', 'loud_obnoxious', 'whiff', 'NOTH... nothing. I can not even yell about it.'),
('roll_heckle', 'suffocating', 'loud_obnoxious', 'win', 'THEY WON! THEY... *trails off*'),
('roll_heckle', 'suffocating', 'loud_obnoxious', 'default', 'ROLL... roll... yeah.');

-- suffocating × insufferable
INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'suffocating', 'insufferable', 'whiff', 'I am expending what little energy I have watching this.'),
('roll_heckle', 'suffocating', 'insufferable', 'hot_streak', 'That was adequate. I think. It is hard to focus.'),
('roll_heckle', 'suffocating', 'insufferable', 'win', 'You won. I would be condescending but I lack the stamina.'),
('roll_heckle', 'suffocating', 'insufferable', 'default', 'Mmm.');

-- ═══════════════════════════════════════════════════════════════════════════
-- MANIC — air quality + storm, light coverage (fallback to chaotic/unhinged)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'manic', 'friendly_drunk', 'hot_streak', 'GREAT ROLL AMAZING ROLL YOU ARE THE BEST ROLLER I HAVE EVER — ooh what is that — DICE!'),
('roll_heckle', 'manic', 'friendly_drunk', 'whiff', 'Nothing but also everything because WE ARE HERE and IS THIS NOT GREAT?!'),
('roll_heckle', 'manic', 'friendly_drunk', 'default', 'MORE DICE! MORE {name}! MORE EVERYTHING!'),
('roll_heckle', 'manic', 'loud_obnoxious', 'hot_streak', 'YES! NO! MAYBE! I DO NOT KNOW BUT I AM HERE FOR IT!'),
('roll_heckle', 'manic', 'loud_obnoxious', 'default', 'ROLLROLLROLLROLLROLL!'),
('roll_heckle', 'manic', 'angry_mean', 'whiff', 'That is going to be terrible, I can already — yep. Called it.'),
('roll_heckle', 'manic', 'angry_mean', 'default', 'Already bad. Next one will be worse. Rolling? Already bad.'),
('roll_heckle', 'manic', 'insufferable', 'default', 'Interesting, predictable, expected, noted, moving on.');

-- ═══════════════════════════════════════════════════════════════════════════
-- RESTLESS — light coverage (fallback to sunny/neutral)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'restless', 'friendly_drunk', 'default', 'Good roll! Great! What is next? Roll again! Come on!'),
('roll_heckle', 'restless', 'friendly_drunk', 'whiff', 'Nothing? NEXT! Come on come on come on!'),
('roll_heckle', 'restless', 'loud_obnoxious', 'default', 'HURRY UP AND ROLL AGAIN! COME ON!'),
('roll_heckle', 'restless', 'angry_mean', 'default', 'Any day now, {name}.'),
('roll_heckle', 'restless', 'angry_mean', 'whiff', 'Nothing. Can you fail faster?'),
('roll_heckle', 'restless', 'insufferable', 'default', 'I do not mean to rush you, but...');

-- ═══════════════════════════════════════════════════════════════════════════
-- BITTER — light coverage (fallback to grumpy/melancholic)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'bitter', 'friendly_drunk', 'hot_streak', 'Good for you, {name}. No really. Some of us never get those but... happy for you.'),
('roll_heckle', 'bitter', 'friendly_drunk', 'whiff', 'Join the club, buddy. The nothing club.'),
('roll_heckle', 'bitter', 'angry_mean', 'hot_streak', 'Sure. YOU get the good rolls. Typical.'),
('roll_heckle', 'bitter', 'angry_mean', 'whiff', 'That is {roll_count} rolls of nothing. Not that anyone is counting.'),
('roll_heckle', 'bitter', 'angry_mean', 'default', 'Must be nice.'),
('roll_heckle', 'bitter', 'insufferable', 'default', 'I have learned not to expect much from rolls like yours.'),
('roll_heckle', 'bitter', 'loud_obnoxious', 'hot_streak', 'OH SURE, THEY GET THE GOOD ROLLS! TYPICAL!');

-- ═══════════════════════════════════════════════════════════════════════════
-- STIR_CRAZY — light coverage (fallback to cozy)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'stir_crazy', 'friendly_drunk', 'default', 'YES ROLL AGAIN! This is literally the best part of my day!'),
('roll_heckle', 'stir_crazy', 'friendly_drunk', 'hot_streak', 'FINALLY something HAPPENED! More! MORE!'),
('roll_heckle', 'stir_crazy', 'loud_obnoxious', 'default', 'FINALLY SOMETHING TO WATCH! GO {name} GO!'),
('roll_heckle', 'stir_crazy', 'angry_mean', 'default', 'Great. Another roll to watch while I am stuck here.'),
('roll_heckle', 'stir_crazy', 'insufferable', 'default', 'I suppose this will have to do for stimulation.');

-- ═══════════════════════════════════════════════════════════════════════════
-- PARANOID — light coverage (fallback to mysterious)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tas_phrases (phrase_type, mood, snarkiness, context_tag, phrase) VALUES
('roll_heckle', 'paranoid', 'friendly_drunk', 'hot_streak', 'Great roll! ...Almost too great. No, I trust you. But like...'),
('roll_heckle', 'paranoid', 'friendly_drunk', 'default', 'Nice one, {name}! ...Did anyone else see that?'),
('roll_heckle', 'paranoid', 'loud_obnoxious', 'hot_streak', 'DID ANYONE ELSE SEE THAT?! WAS THAT NORMAL?!'),
('roll_heckle', 'paranoid', 'angry_mean', 'hot_streak', 'Awfully convenient roll there, {name}.'),
('roll_heckle', 'paranoid', 'angry_mean', 'whiff', 'Playing dumb, {name}? I see what you are doing.'),
('roll_heckle', 'paranoid', 'angry_mean', 'default', 'I am watching you, {name}.'),
('roll_heckle', 'paranoid', 'insufferable', 'default', 'Hmm. That roll was... expected.');
