#!/usr/bin/env node

console.log(`
Gaslights publish checklist

1. Run local authoring if needed:
   npm run authoring:dev

2. Verify data integrity:
   npm run validate:data

3. Verify map source config:
   npm run validate:maps

4. Run runtime tests:
   npm test

5. Review changed JSON:
   git diff -- public/data data

6. Commit and push:
   git add public/data data public/assets public/index.html docs package.json scripts
   git commit -m "Update authored case content"
   git push

7. Let Vercel redeploy the static app and hard-refresh the site.
`.trim());
