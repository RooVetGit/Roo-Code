Get the exercises from exercism:

````sh
gh repo clone exercism/typescript repos/typescript
# Same idea for python, ruby, go, rust, etc.
# gh repo clone exercism/python repos/python
find . -name ".vscode" | xargs rm -rf```
````

Prepare an exercise:

```sh
LANG=typescript
EXERCISE=flatten-array

cp -rf repos/$LANG/exercises/practice/$EXERCISE $LANG
sed -i 's/\bxit(/it(/g' $LANG/$EXERCISE/*.test.ts

echo "# Task

Complete the implementation in \`$EXERCISE.ts\`.

$(cat $LANG/$EXERCISE/.docs/instructions.md)

# Confirmation

To confirm that your solution is correct, run the tests with \`yarn test\`.
You might need to install the dependencies first with \`yarn install\`." > $LANG/$EXERCISE/.docs/prompt.md
```

TODO: The prompt is language dependent, so let's create a template for each language. The example above is for typescript.
