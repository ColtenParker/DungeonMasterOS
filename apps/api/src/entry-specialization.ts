import { type Entry, type EntryType, type Prisma } from "@prisma/client";

export const sectionCatalog = {
  NPC: ["portrait", "status", "currentLocation", "inventory"],
  LOCATION: ["hierarchy", "inventory"],
  JOURNAL: [],
  QUEST: ["status", "objectives"],
  FACTION: ["status", "leadership"],
  ITEM: [],
} as const satisfies Record<EntryType, readonly string[]>;

export const presetCatalog = {
  NPC: {
    blank: [],
    merchant: ["portrait", "status", "currentLocation", "inventory"],
    noble: ["portrait", "status", "currentLocation"],
    guard: ["portrait", "status", "currentLocation", "inventory"],
    villain: ["portrait", "status", "currentLocation", "inventory"],
  },
  LOCATION: { blank: [] },
  JOURNAL: { blank: [] },
  QUEST: { blank: [] },
  FACTION: { blank: [] },
  ITEM: { blank: [] },
} as const satisfies Record<EntryType, Record<string, readonly string[]>>;

export interface InventoryLineInput {
  id: string;
  itemId: string;
  quantity: number;
  note: string | null;
}

export interface InventoryInput {
  id: string;
  name: string;
  lines: InventoryLineInput[];
}

export type EntrySpecialization =
  | {
      type: "NPC";
      portraitMediaId: string | null;
      status: string | null;
      currentLocationId: string | null;
      inventories: InventoryInput[];
    }
  | {
      type: "LOCATION";
      parentLocationId: string | null;
      sortOrder: number;
      inventories: InventoryInput[];
    }
  | {
      type: "QUEST";
      status: string | null;
      objectives: Array<{ id: string; text: string; completed: boolean }>;
    }
  | {
      type: "FACTION";
      status: string | null;
      leaders: Array<{ id: string; npcId: string; role: string | null }>;
    }
  | { type: "JOURNAL" | "ITEM" };

export class EntrySpecializationValidationError extends Error {}

type Transaction = Prisma.TransactionClient;

function clean(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

async function campaignWorldId(transaction: Transaction, campaignId: string) {
  return (
    await transaction.campaign.findUnique({
      where: { id: campaignId },
      select: { worldId: true },
    })
  )?.worldId;
}

async function validateVisibleEntry(
  transaction: Transaction,
  source: Pick<Entry, "worldId" | "campaignId">,
  targetId: string,
  expectedType: EntryType,
) {
  const target = await transaction.entry.findUnique({
    where: { id: targetId },
  });
  if (!target || target.type !== expectedType) {
    throw new EntrySpecializationValidationError(
      `The referenced Entry must be a ${expectedType.toLowerCase()}.`,
    );
  }
  const worldId = source.campaignId
    ? await campaignWorldId(transaction, source.campaignId)
    : null;
  const visible = source.worldId
    ? target.worldId === source.worldId
    : target.campaignId === source.campaignId || target.worldId === worldId;
  if (!visible) {
    throw new EntrySpecializationValidationError(
      "The referenced Entry is outside the source Entry's visible scope.",
    );
  }
}

async function validatePortrait(
  transaction: Transaction,
  source: Pick<Entry, "worldId" | "campaignId">,
  mediaId: string,
) {
  const media = await transaction.media.findUnique({ where: { id: mediaId } });
  if (!media || media.type !== "IMAGE") {
    throw new EntrySpecializationValidationError(
      "An NPC portrait must reference an image from the Media Library.",
    );
  }
  const worldId = source.campaignId
    ? await campaignWorldId(transaction, source.campaignId)
    : null;
  const visible = source.worldId
    ? media.worldId === source.worldId
    : media.campaignId === source.campaignId || media.worldId === worldId;
  if (!visible) {
    throw new EntrySpecializationValidationError(
      "The portrait is outside the NPC's visible scope.",
    );
  }
}

async function validateLocationParent(
  transaction: Transaction,
  source: Entry,
  parentId: string,
) {
  if (source.id === parentId) {
    throw new EntrySpecializationValidationError(
      "A Location cannot be its own parent.",
    );
  }
  await validateVisibleEntry(transaction, source, parentId, "LOCATION");
  let cursor: string | null = parentId;
  const visited = new Set<string>();
  while (cursor) {
    if (cursor === source.id) {
      throw new EntrySpecializationValidationError(
        "That parent would create a Location hierarchy cycle.",
      );
    }
    if (visited.has(cursor)) break;
    visited.add(cursor);
    cursor =
      (
        await transaction.locationDetails.findUnique({
          where: { entryId: cursor },
          select: { parentLocationId: true },
        })
      )?.parentLocationId ?? null;
  }
}

async function replaceInventories(
  transaction: Transaction,
  owner: Entry,
  inventories: InventoryInput[],
) {
  if (!(["NPC", "LOCATION"] as EntryType[]).includes(owner.type)) {
    throw new EntrySpecializationValidationError(
      "Inventories are supported only for NPCs and Locations.",
    );
  }
  for (const inventory of inventories) {
    for (const line of inventory.lines) {
      await validateVisibleEntry(transaction, owner, line.itemId, "ITEM");
    }
  }
  await transaction.inventory.deleteMany({ where: { ownerEntryId: owner.id } });
  for (const [position, inventory] of inventories.entries()) {
    await transaction.inventory.create({
      data: {
        id: inventory.id,
        ownerEntryId: owner.id,
        name: inventory.name,
        position,
        lines: {
          create: inventory.lines.map((line, linePosition) => ({
            id: line.id,
            itemId: line.itemId,
            quantity: line.quantity,
            note: clean(line.note),
            position: linePosition,
          })),
        },
      },
    });
  }
}

export function sectionsForPreset(type: EntryType, preset: string | undefined) {
  const selected = preset ?? "blank";
  const presets = presetCatalog[type] as Record<string, readonly string[]>;
  const sections = presets[selected];
  if (!sections) {
    throw new EntrySpecializationValidationError(
      `Preset '${selected}' is not available for ${type.toLowerCase()} Entries.`,
    );
  }
  return [...sections];
}

export async function saveEntrySpecialization(
  transaction: Transaction,
  entry: Entry,
  sections: string[],
  specialization?: EntrySpecialization,
) {
  const supported = new Set<string>(sectionCatalog[entry.type]);
  if (
    new Set(sections).size !== sections.length ||
    sections.some((key) => !supported.has(key))
  ) {
    throw new EntrySpecializationValidationError(
      "One or more sections are not supported for this Entry type.",
    );
  }
  if (specialization && specialization.type !== entry.type) {
    throw new EntrySpecializationValidationError(
      "The specialization does not match the Entry type.",
    );
  }

  await transaction.entrySection.deleteMany({ where: { entryId: entry.id } });
  if (sections.length) {
    await transaction.entrySection.createMany({
      data: sections.map((key, position) => ({
        entryId: entry.id,
        key,
        position,
      })),
    });
  }

  if (entry.type === "NPC") {
    const data = specialization?.type === "NPC" ? specialization : undefined;
    if (data?.portraitMediaId)
      await validatePortrait(transaction, entry, data.portraitMediaId);
    if (data?.currentLocationId)
      await validateVisibleEntry(
        transaction,
        entry,
        data.currentLocationId,
        "LOCATION",
      );
    await transaction.npcDetails.upsert({
      where: { entryId: entry.id },
      create: {
        entryId: entry.id,
        portraitMediaId: sections.includes("portrait")
          ? (data?.portraitMediaId ?? null)
          : null,
        status: sections.includes("status")
          ? clean(data?.status ?? null)
          : null,
        currentLocationId: sections.includes("currentLocation")
          ? (data?.currentLocationId ?? null)
          : null,
      },
      update: {
        portraitMediaId: sections.includes("portrait")
          ? (data?.portraitMediaId ?? null)
          : null,
        status: sections.includes("status")
          ? clean(data?.status ?? null)
          : null,
        currentLocationId: sections.includes("currentLocation")
          ? (data?.currentLocationId ?? null)
          : null,
      },
    });
    await replaceInventories(
      transaction,
      entry,
      sections.includes("inventory") ? (data?.inventories ?? []) : [],
    );
  } else if (entry.type === "LOCATION") {
    const data =
      specialization?.type === "LOCATION" ? specialization : undefined;
    const parentId = sections.includes("hierarchy")
      ? (data?.parentLocationId ?? null)
      : null;
    if (parentId) await validateLocationParent(transaction, entry, parentId);
    await transaction.locationDetails.upsert({
      where: { entryId: entry.id },
      create: {
        entryId: entry.id,
        parentLocationId: parentId,
        sortOrder: data?.sortOrder ?? 0,
      },
      update: { parentLocationId: parentId, sortOrder: data?.sortOrder ?? 0 },
    });
    await replaceInventories(
      transaction,
      entry,
      sections.includes("inventory") ? (data?.inventories ?? []) : [],
    );
  } else if (entry.type === "QUEST") {
    const data = specialization?.type === "QUEST" ? specialization : undefined;
    await transaction.questDetails.upsert({
      where: { entryId: entry.id },
      create: {
        entryId: entry.id,
        status: sections.includes("status")
          ? clean(data?.status ?? null)
          : null,
      },
      update: {
        status: sections.includes("status")
          ? clean(data?.status ?? null)
          : null,
      },
    });
    await transaction.questObjective.deleteMany({
      where: { questId: entry.id },
    });
    if (sections.includes("objectives") && data?.objectives.length) {
      await transaction.questObjective.createMany({
        data: data.objectives.map((objective, position) => ({
          ...objective,
          questId: entry.id,
          position,
        })),
      });
    }
  } else if (entry.type === "FACTION") {
    const data =
      specialization?.type === "FACTION" ? specialization : undefined;
    if (sections.includes("leadership")) {
      for (const leader of data?.leaders ?? [])
        await validateVisibleEntry(transaction, entry, leader.npcId, "NPC");
    }
    await transaction.factionDetails.upsert({
      where: { entryId: entry.id },
      create: {
        entryId: entry.id,
        status: sections.includes("status")
          ? clean(data?.status ?? null)
          : null,
      },
      update: {
        status: sections.includes("status")
          ? clean(data?.status ?? null)
          : null,
      },
    });
    await transaction.factionLeader.deleteMany({
      where: { factionId: entry.id },
    });
    if (sections.includes("leadership") && data?.leaders.length) {
      await transaction.factionLeader.createMany({
        data: data.leaders.map((leader, position) => ({
          ...leader,
          role: clean(leader.role),
          factionId: entry.id,
          position,
        })),
      });
    }
  }
}

export async function loadEntrySpecialization(
  transaction: Transaction,
  entry: Entry,
): Promise<{ sections: string[]; specialization: EntrySpecialization }> {
  const sections = (
    await transaction.entrySection.findMany({
      where: { entryId: entry.id },
      orderBy: { position: "asc" },
    })
  ).map(({ key }) => key);

  if (entry.type === "NPC") {
    const [details, inventories] = await Promise.all([
      transaction.npcDetails.findUnique({ where: { entryId: entry.id } }),
      loadInventories(transaction, entry.id),
    ]);
    return {
      sections,
      specialization: {
        type: "NPC",
        portraitMediaId: details?.portraitMediaId ?? null,
        status: details?.status ?? null,
        currentLocationId: details?.currentLocationId ?? null,
        inventories,
      },
    };
  }
  if (entry.type === "LOCATION") {
    const [details, inventories] = await Promise.all([
      transaction.locationDetails.findUnique({ where: { entryId: entry.id } }),
      loadInventories(transaction, entry.id),
    ]);
    return {
      sections,
      specialization: {
        type: "LOCATION",
        parentLocationId: details?.parentLocationId ?? null,
        sortOrder: details?.sortOrder ?? 0,
        inventories,
      },
    };
  }
  if (entry.type === "QUEST") {
    const details = await transaction.questDetails.findUnique({
      where: { entryId: entry.id },
      include: { objectives: { orderBy: { position: "asc" } } },
    });
    return {
      sections,
      specialization: {
        type: "QUEST",
        status: details?.status ?? null,
        objectives: (details?.objectives ?? []).map(
          ({ id, text, completed }) => ({ id, text, completed }),
        ),
      },
    };
  }
  if (entry.type === "FACTION") {
    const details = await transaction.factionDetails.findUnique({
      where: { entryId: entry.id },
      include: { leaders: { orderBy: { position: "asc" } } },
    });
    return {
      sections,
      specialization: {
        type: "FACTION",
        status: details?.status ?? null,
        leaders: (details?.leaders ?? []).map(({ id, npcId, role }) => ({
          id,
          npcId,
          role,
        })),
      },
    };
  }
  return { sections, specialization: { type: entry.type } };
}

async function loadInventories(transaction: Transaction, ownerEntryId: string) {
  const inventories = await transaction.inventory.findMany({
    where: { ownerEntryId },
    orderBy: { position: "asc" },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  return inventories.map(({ id, name, lines }) => ({
    id,
    name,
    lines: lines.map(({ id: lineId, itemId, quantity, note }) => ({
      id: lineId,
      itemId,
      quantity,
      note,
    })),
  }));
}
