import { z } from 'zod'

// Imported first by Gate.tsx: ES modules run imports before the importer's own code, so this must run before the
// validator's schemas are created. The site's CSP forbids eval; jitless stops zod probing for it.
z.config({ jitless: true })
