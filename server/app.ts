import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateBookmark, validateSectionTitle } from '../src/logic/validation.ts';
import type { Repo } from './repo.ts';

/**
 * Build the Express app around a repository. Kept separate from the entry point
 * so tests can mount it on an ephemeral port without importing side effects.
 */
export function createApp(repo: Repo, options: { dist?: string } = {}): express.Express {
  const app = express();

  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.get('/api/state', async (_request, response, next) => {
    try {
      response.json(await repo.getState());
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/sections', async (request, response, next) => {
    try {
      const problem = validateSectionTitle(String(request.body?.title ?? ''));
      if (problem) {
        response.status(400).json({ error: problem });
        return;
      }
      response.status(201).json(await repo.createSection(String(request.body.title).trim()));
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/sections/:id', async (request, response, next) => {
    try {
      const problem = validateSectionTitle(String(request.body?.title ?? ''));
      if (problem) {
        response.status(400).json({ error: problem });
        return;
      }
      const section = await repo.renameSection(request.params.id, String(request.body.title).trim());
      if (!section) {
        response.status(404).json({ error: 'Section not found' });
        return;
      }
      response.json(section);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/sections/:id', async (request, response, next) => {
    try {
      const removed = await repo.deleteSection(request.params.id);
      if (!removed) {
        response.status(404).json({ error: 'Section not found' });
        return;
      }
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/bookmarks', async (request, response, next) => {
    try {
      const parsed = validateBookmark({
        title: String(request.body?.title ?? ''),
        url: String(request.body?.url ?? ''),
        description: String(request.body?.description ?? ''),
        iconUrl: request.body?.iconUrl ?? null,
      });

      if (!parsed.ok) {
        response.status(400).json({ errors: parsed.errors });
        return;
      }

      const sectionId = String(request.body?.sectionId ?? '');
      const state = await repo.getState();
      if (!state.sections.some((section) => section.id === sectionId)) {
        response.status(400).json({ error: 'Unknown section' });
        return;
      }

      const bookmark = await repo.createBookmark({ ...parsed.value, sectionId });
      response.status(201).json(bookmark);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/bookmarks/:id', async (request, response, next) => {
    try {
      const parsed = validateBookmark({
        title: String(request.body?.title ?? ''),
        url: String(request.body?.url ?? ''),
        description: String(request.body?.description ?? ''),
        iconUrl: request.body?.iconUrl ?? null,
      });

      if (!parsed.ok) {
        response.status(400).json({ errors: parsed.errors });
        return;
      }

      const bookmark = await repo.updateBookmark(request.params.id, parsed.value);
      if (!bookmark) {
        response.status(404).json({ error: 'Bookmark not found' });
        return;
      }
      response.json(bookmark);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/bookmarks/:id', async (request, response, next) => {
    try {
      const removed = await repo.deleteBookmark(request.params.id);
      if (!removed) {
        response.status(404).json({ error: 'Bookmark not found' });
        return;
      }
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/bookmarks/:id/move', async (request, response, next) => {
    try {
      const sectionId = String(request.body?.sectionId ?? '');
      const index = Number(request.body?.index ?? 0);
      const moved = await repo.moveBookmark(request.params.id, sectionId, index);
      if (!moved) {
        response.status(400).json({ error: 'Cannot move bookmark' });
        return;
      }
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // Unknown API routes must stay JSON, not fall through to the SPA.
  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'Not found' });
  });

  if (options.dist && existsSync(options.dist)) {
    app.use(express.static(options.dist));
    app.get('*', (_request, response) => {
      response.sendFile(join(options.dist as string, 'index.html'));
    });
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    response.status(500).json({ error: 'Server error' });
  });

  return app;
}
