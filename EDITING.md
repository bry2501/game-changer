# Editing the game's text on GitHub

You can change any of the game's wording yourself, right on GitHub, without running anything.
Your edit goes live by itself about two minutes after you save it.

## Where the words live

All the text is in four files in `src/data/`:

| File | What's in it |
|---|---|
| `case1.ts` | The story: the ghost's thoughts in the opening scenes, the memories of Clara and Mr. Thomas, every clue (the "I found…" line, the evidence card, the ghost's thoughts, the rating hints, the recap), and both endings. |
| `house.ts` | The room names and room thoughts, and what the ghost says when searching each piece of furniture. |
| `lessons.ts` | The lesson pages (Lesson 1: Think in stories, and so on). |
| `ui.ts` | Fixed captions: the update steps (The Priors, shrink, stretch) and the rating words. |

To find a line, open the file and press **Ctrl+F** (or **Cmd+F**) and search for a few words of it.

## How to edit

1. Open the repository on GitHub and switch to the branch **`claude/beautiful-tesla-mhfie3`** (the branch menu at the top left of the file list).
2. Open the file, for example `src/data/case1.ts`.
3. Click the **pencil icon** (Edit this file) at the top right.
4. Change only the words **between the quotes**.
5. Click **Commit changes…**, write a short note (for example "Shorter body scene line"), and commit directly to the branch.

## Three rules that keep the game working

- **Keep the quotes and the comma.** A line looks like `  'It tasted bitter tonight.',` — change the words, keep the `'` at each end and the `,` after it.
- **Use the curly apostrophe ’ inside the text,** never the straight one `'`. A straight `'` inside a quoted line ends the line early and breaks the build. Copy a `’` from a nearby line if you need one (the files already use it everywhere: `I’ve`, `Clara’s`).
- **Don't rename the suspects or change anything that isn't text between quotes** (names like `id`, the numbers, the brackets). The automatic checks rely on them.

To add a new thought to a list, copy a whole line (quotes and comma included) and change its words.

**Find and replace:** check each match before replacing. A word inside an `id: '…'` is a name the game looks things up by, not text the player sees; replacing it there hides the clue.

**Evidence cards** are written as the documents themselves. The will (`kind: 'will'`) has a title, numbered `clauses` and a pencilled `margin` note, and its signature line is drawn empty. The pharmacy receipt (`kind: 'receipt'`) has the shop, the time, the `items` with prices and the total; leave `customer: ''` and the Name line prints blank.

## Seeing the result

After you commit, open the **Actions** tab on GitHub. The "Deploy to GitHub Pages" run:

- turns **green**: your change is live; reload the game page;
- turns **red**: something in the edit broke the build. Click the run to see the error, then fix the line (usually a straight `'` or a missing quote or comma), or ask me to.

The run also adds a small follow-up commit of its own ("Rebuild docs/ after a web edit"); that's expected.

## Working together

You don't need to tell me about your edits: before I make any change I pull the branch first, so I always build on top of what you wrote. The screenplay file (`screenplay/the-clockmakers-last-hour.md`) is regenerated from these files the next time I make a change.
