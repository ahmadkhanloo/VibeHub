Workshop lesson · Suggested time: 30–45 minutes with practice

By the end you can hand an error to the assistant, question its assumptions, and verify the fix yourself.

## Get ready

Debugging means finding the cause of wrong behavior, not rushing past it. The assistant is fast at reading error text and proposing paths; you confirm the final cause by seeing correct behavior. The `first-vibe` project from the first-project lesson is enough here.

## Give the full error

Three things the assistant needs: what you did, what you expected, what happened. The full error text is the most important part; summarizing an error deletes clues.

Call the assistant and fill in this pattern:

```text
When I press "Add", the new task is not appended to the list.
The browser console shows: [full error text]
Look at index.html and app.js and tell me the cause.
```

If the page shows no error, take one from the browser console: press F12 and open the Console tab; errors are red. Copy the full text, including line numbers.

## Do not accept the cause — test it

The assistant will likely make several guesses. A guess is not a cause. Ask it to make the smallest change that would prove the guess, then verify in the browser yourself:

- Press the same button again; did behavior change?
- Did one thing change, or several unrelated ones?
- Did the console error go away, or did a new one appear?

If it touched several files at once, ask it to revert and keep a single change. Debugging is not done with ten simultaneous changes; it is done with one.

## Record the fix

When behavior is correct, ask the assistant to state in one sentence what the problem was and what changed. Keep that sentence for your next commit message — the Git lesson needs it.

If the fix did not land and you looped twice, there is a third path: ask the assistant to compare two possible fixes with benefits and costs, and pick one yourself. The choice is yours, not the assistant's.

## Try it yourself

Take a deliberate error from your facilitator or from yourself: rename a function in `index.html` on purpose and do not tell the assistant. Open the page, read the full console error, hand it over, and let it fix. Checkpoint: the error is fixed without a second guess, and you saw the change in the file.

**[Next step: code review with an agent](/learning/code-review?category=workflows)**
