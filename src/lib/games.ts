import { eq, asc, and, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

export type GameFilters = {
    categoryIds?: number[];
    publisherIds?: number[];
};

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function normalizeFilterIds(ids: number[] | null | undefined): number[] {
    if (!ids || ids.length === 0) {
        return [];
    }

    const uniqueIds = new Set<number>();
    for (const id of ids) {
        if (Number.isInteger(id) && id > 0) {
            uniqueIds.add(id);
        }
    }

    return [...uniqueIds];
}

type SelectQuery<T> = Promise<T[]> & {
    where: (condition: ReturnType<typeof and> | undefined) => SelectQuery<T>;
    orderBy: (...args: unknown[]) => SelectQuery<T>;
    get: () => Promise<T | undefined>;
};

function applyGameFilters<T>(query: SelectQuery<T>, filters?: GameFilters): SelectQuery<T> {
    const categoryIds = normalizeFilterIds(filters?.categoryIds);
    const publisherIds = normalizeFilterIds(filters?.publisherIds);
    const conditions: ReturnType<typeof inArray>[] = [];

    if (categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, categoryIds));
    }

    if (publisherIds.length > 0) {
        conditions.push(inArray(games.publisherId, publisherIds));
    }

    if (conditions.length === 0) {
        return query;
    }

    return query.where(and(...conditions));
}

function baseGamesQuery(db: Database): SelectQuery<GameSelectionRow> {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id)) as unknown as SelectQuery<GameSelectionRow>;
}

function createGameIdQuery(db: Database): SelectQuery<{ id: number }> {
    return db.select({ id: games.id }).from(games) as unknown as SelectQuery<{ id: number }>;
}

/** All categories ordered by name. */
export async function getAllCategories(db: Database): Promise<Array<{ id: number; name: string }>> {
    const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** All publishers ordered by name. */
export async function getAllPublishers(db: Database): Promise<Array<{ id: number; name: string }>> {
    const rows = await db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** All games ordered by title, optionally filtered by category/publisher. */
export async function getAllGames(db: Database, filters?: GameFilters): Promise<Game[]> {
    const rows = await applyGameFilters(baseGamesQuery(db), filters).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All game ids ordered by title, optionally filtered by category/publisher. */
export async function getAllGameIds(db: Database, filters?: GameFilters): Promise<number[]> {
    const rows = await applyGameFilters(createGameIdQuery(db), filters).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
