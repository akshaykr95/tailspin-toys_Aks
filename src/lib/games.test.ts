import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilterFixture(db: Database): Promise<{
    strategy: { id: number };
    puzzle: { id: number };
    pubOne: { id: number };
    pubTwo: { id: number };
}> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'strategy category' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'puzzle category' })
        .returning({ id: categories.id });
    const [pubOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub one' })
        .returning({ id: publishers.id });
    const [pubTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'pub two' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        { title: 'Alpha Tactics', description: 'strategy + pub one', starRating: 4.8, categoryId: strategy.id, publisherId: pubOne.id },
        { title: 'Beta Logic', description: 'puzzle + pub one', starRating: 4.5, categoryId: puzzle.id, publisherId: pubOne.id },
        { title: 'Gamma Tactics', description: 'strategy + pub two', starRating: 4.3, categoryId: strategy.id, publisherId: pubTwo.id },
        { title: 'Delta Logic', description: 'puzzle + pub two', starRating: 4.0, categoryId: puzzle.id, publisherId: pubTwo.id },
    ]);

    return { strategy, puzzle, pubOne, pubTwo };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filters games by category', async () => {
        const { strategy } = await seedFilterFixture(db);
        const gamesByCategory = await getAllGames(db, { categoryIds: [strategy.id] });

        expect(gamesByCategory.map((game) => game.title)).toEqual(['Alpha Tactics', 'Gamma Tactics']);
    });

    it('filters games by publisher', async () => {
        const { pubOne } = await seedFilterFixture(db);
        const gamesByPublisher = await getAllGames(db, { publisherIds: [pubOne.id] });

        expect(gamesByPublisher.map((game) => game.title)).toEqual(['Alpha Tactics', 'Beta Logic']);
    });

    it('combines category and publisher filters', async () => {
        const { strategy, pubTwo } = await seedFilterFixture(db);
        const gamesByFilter = await getAllGames(db, {
            categoryIds: [strategy.id],
            publisherIds: [pubTwo.id],
        });

        expect(gamesByFilter.map((game) => game.title)).toEqual(['Gamma Tactics']);
    });

    it('lists all categories and publishers in name order', async () => {
        await seedFilterFixture(db);

        expect(await getAllCategories(db)).toEqual([
            { id: expect.any(Number), name: 'Puzzle' },
            { id: expect.any(Number), name: 'Strategy' },
        ]);
        expect(await getAllPublishers(db)).toEqual([
            { id: expect.any(Number), name: 'Pub One' },
            { id: expect.any(Number), name: 'Pub Two' },
        ]);
    });
});
