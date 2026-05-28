import random

ADJECTIVES = [
    "Spicy", "Funky", "Sneaky", "Grumpy", "Lazy", "Zippy", "Wobbly",
    "Fluffy", "Cranky", "Salty", "Jumpy", "Wiggly", "Cheeky", "Dizzy",
    "Goofy", "Sassy", "Bouncy", "Zesty", "Grizzly", "Plucky", "Shifty",
    "Jolly", "Gloomy", "Wacky", "Peppy", "Stormy", "Frosty", "Rusty",
    "Dusty", "Shaky", "Lucky", "Spooky", "Fancy", "Rowdy", "Nervy",
]

NOUNS = [
    "Unicorn", "Badger", "Penguin", "Goblin", "Narwhal", "Pickle",
    "Waffle", "Noodle", "Potato", "Biscuit", "Platypus", "Muffin",
    "Cactus", "Blobfish", "Mongoose", "Turnip", "Hamster", "Salamander",
    "Toadstool", "Pretzel", "Walrus", "Capybara", "Burrito", "Otter",
    "Raccoon", "Marmot", "Porcupine", "Kumquat", "Squid", "Yak",
    "Mackerel", "Armadillo", "Chinchilla", "Dumpling", "Puffin",
]


def make_name() -> str:
    return f"{random.choice(ADJECTIVES)} {random.choice(NOUNS)}"
