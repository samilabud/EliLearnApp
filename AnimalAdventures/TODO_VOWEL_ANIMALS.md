# TODO: add vowel-starting animals

## Why

The new "Guess the First Letter" game (`components/games/first-letter.game.component.jsx`)
teaches vowels first, then consonants. Its early levels only draw from
animals whose name starts with a vowel.

Right now that pool is thin:
- English: only **Owl**
- Spanish: only **Oveja**, **Oso**, **Abeja**

The game currently copes by reusing those few animals across the early
levels (the 3 letter choices still shuffle each round, so it isn't the
exact same screen every time), but a bigger pool would make those levels
feel less repetitive.

## What to add

No code changes are needed to use these once the assets exist — the game
detects "starts with a vowel" automatically from each animal's name, so
adding entries to `components/animals/animal.list.js` is enough.

Suggested animals (chosen so the name starts with a vowel in **both**
languages):

| Animal (EN) | Animal (ES) | Suggested id |
|---|---|---|
| Elephant | Elefante | `elephant` |
| Iguana | Iguana | `iguana` |
| Eagle | Águila | `eagle` |

Optional extras if you want more variety later: Ostrich/Avestruz, Orca/Orca,
Armadillo/Armadillo, Anteater/Oso hormiguero.

## Assets needed per animal

Following the pattern already used for every existing animal in
`animal.list.js`:

1. **Lottie animation** (idle/looping cartoon of the animal) →
   `assets/animations/animals/<id>.json`
2. **Sound effect** (the animal's characteristic sound - trumpet, hiss,
   screech, etc.) → `assets/sounds/animals/<Name>.mp3`
3. **English voice clip** (someone saying the animal's name) →
   `assets/sounds/voices/english/<name>.mp3`
4. **Spanish voice clip** (someone saying the animal's name) →
   `assets/sounds/voices/spanish/<Nombre>.mp3`

## Where to add it

Add one object per animal to the `animalList` array in
`components/animals/animal.list.js`, following the exact shape of the
existing entries, e.g.:

```js
{
  id: 'elephant',
  name: 'Elephant',
  spanish_name: 'Elefante',
  animation_path: require(`${animation_path}elephant.json`),
  sound: require(`${sound_path}/Elephant-Trumpet.mp3`),
  voice: require(`${english_folder}/elephant.mp3`),
  spanish_voice: require(`${spanish_folder}/elefante.mp3`),
},
```

Once added, the new animal automatically:
- Shows up in Learn, Guess the Animal, Memory, and the Album (they all
  read from `animalList`).
- Joins the vowel-only pool in the first-letter game's early levels.
